import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RealtimeService } from '../../realtime/realtime.service';
import { AuditService } from '../audit/audit.service';
import { DynamicFormValidator, FieldDefinition } from '../services/dynamic-form-validator';
import { FilesService } from '../files/files.service';
import { toMinor, toMajor } from '../../common/utils/money';
import { AuditAction, DOMAIN_EVENTS, REQUEST_CONFIG, RequestStatus } from '@caffenet/shared';
import {
  AddAttachmentDto,
  CancelRequestDto,
  CreateRequestDto,
  RequestQueryDto,
} from './dto/request.dto';
import { RequestStatusMachine } from './request-status-machine';

type Tx = Prisma.TransactionClient;

export interface ActorInfo {
  id: string;
  roles: string[];
}

/**
 * Requests service — request core (Phase 4.1).
 *
 * Responsibilities:
 *  - Create requests with SERVER-SIDE dynamic-form validation (never trust client)
 *  - Tracking code generation (CF-YYYY-NNNNNN, collision-safe via unique + retry)
 *  - Role-aware listing (customer: own / operator: mine|all / admin: all)
 *    with page-based AND cursor-based pagination (high-volume friendly — 3.2.7)
 *  - Lookup by tracking code / id with authorization
 *  - Customer cancellation with status rules
 *  - File attachments (RequestAttachment ↔ FileUpload)
 *
 * Money convention: laborFeeSnapshot/finalTotal are BigInt RIAL (minor) in DB;
 * DTOs and API responses use Toman (major) via toMinor()/toMajor().
 */
@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
    private readonly formValidator: DynamicFormValidator,
    private readonly files: FilesService,
  ) {}

  // ==================== CREATE (4.1.5 – 4.1.7) ====================

  /**
   * Create a request on behalf of the authenticated customer.
   * Fully transactional: request + field values + cost snapshot + initial
   * history entry + attachments all succeed or fail together.
   */
  async create(dto: CreateRequestDto, userId: string): Promise<Record<string, unknown>> {
    // 1) Load service (must be active + not deleted)
    const service = await this.prisma.service.findFirst({
      where: { id: BigInt(dto.serviceId), active: true, deletedAt: null },
      include: { category: true },
    });
    if (!service) throw new NotFoundException('خدمت موردنظر یافت نشد یا غیرفعال است');

    // 2) Load active form fields for this service
    const fields = await this.prisma.serviceField.findMany({
      where: { serviceId: service.id, active: true },
      orderBy: { sortOrder: 'asc' },
    });

    // 3) SERVER-SIDE dynamic form validation — single source of truth
    const fieldDefs: FieldDefinition[] = fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type as FieldDefinition['type'],
      required: f.required,
      validationRules: (f.validationRules as FieldDefinition['validationRules']) ?? undefined,
      options: (f.options as FieldDefinition['options']) ?? undefined,
    }));
    const submitted = dto.formData ?? {};
    const hasFileField = fieldDefs.some((f) => f.type === 'file' || f.type === 'image');
    if (fieldDefs.length > 0 && (Object.keys(submitted).length > 0 || hasFileField)) {
      const result = this.formValidator.validate({ values: submitted, fields: fieldDefs });
      if (!result.valid) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'مقادیر فرم نامعتبر است',
          details: result.errors,
        });
      }
      Object.assign(submitted, result.sanitizedValues);
    } else if (
      fieldDefs.length > 0 &&
      Object.keys(submitted).length === 0 &&
      hasRequiredFields(fieldDefs)
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'مقادیر فیلدهای الزامی فرم ارسال نشده است',
      });
    }

    // 4) Contact method resolution
    const contact = await this.resolveContact(dto, userId);
    if (!contact.value) {
      throw new BadRequestException('روش تماس یا مقدار تماس مشخص نشده است');
    }

    // 5) Validate uploaded files exist and belong to the user (before tx)
    const fileRecords = await this.validateFileIds(dto.fileIds ?? [], userId, submitted, fields);

    // 6) Create everything in one Serializable transaction (tracking-code collision-safe)
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const created = await this.prisma.$transaction(
          async (tx) => {
            const trackingCode = await this.generateTrackingCode(tx);

            const request = await tx.request.create({
              data: {
                trackingCode,
                customerId: BigInt(userId),
                serviceId: service.id,
                status: RequestStatus.PENDING,
                description: dto.description,
                laborFeeSnapshot: service.laborFee,
                finalTotal: service.laborFee,
                currency: service.currency,
                estimatedDurationMin: service.estimatedDurationMin,
                contactMethodId: contact.methodId,
                contactValue: contact.value,
              },
            });

            // Field values (string-serialized; arrays as JSON; files as file id)
            const valueRows = this.buildFieldValueRows(request.id, submitted, fields);
            if (valueRows.length > 0) {
              await tx.requestFieldValue.createMany({ data: valueRows });
            }

            // Price snapshot (labor fee only at this stage — Phase 5 completes it)
            await tx.requestCost.create({
              data: {
                requestId: request.id,
                laborFee: service.laborFee,
                materialCost: 0n,
                additionalCost: 0n,
                discountAmount: 0n,
                finalTotal: service.laborFee,
                currency: service.currency,
              },
            });

            // Initial status history entry
            await tx.requestStatusHistory.create({
              data: {
                requestId: request.id,
                previousStatus: null,
                newStatus: RequestStatus.PENDING,
                userId: BigInt(userId),
                note: 'ثبت درخواست توسط مشتری',
              },
            });

            // Attachments (general + file-type field values)
            if (fileRecords.length > 0) {
              await tx.requestAttachment.createMany({
                data: fileRecords.map((f) => ({
                  requestId: request.id,
                  fileId: f.id,
                  uploadedBy: BigInt(userId),
                })),
              });
            }

            return request;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        this.logger.log(`Request created: ${created.trackingCode} (customer ${userId})`);

        // 7) Post-commit side effects — fire-and-forget, never block the caller
        await this.events.emit(DOMAIN_EVENTS.REQUEST_CREATED, {
          requestId: created.id.toString(),
          trackingCode: created.trackingCode,
          customerId: userId,
          serviceId: service.id.toString(),
          serviceName: service.name,
          laborFeeToman: toMajor(Number(service.laborFee)),
        });
        this.realtime
          .notifyAdmins('RequestCreated', {
            requestId: created.id.toString(),
            trackingCode: created.trackingCode,
            serviceName: service.name,
          })
          .catch(() => undefined);

        await this.audit.log({
          userId,
          action: AuditAction.CREATE,
          entity: 'request',
          entityId: created.trackingCode,
          newData: { trackingCode: created.trackingCode, serviceId: service.id.toString() },
        });

        return this.serialize(created);
      } catch (err) {
        // Unique violation on trackingCode → retry with next sequence
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 5
        ) {
          this.logger.warn(`Tracking code collision (attempt ${attempt}/5) — retrying`);
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException('خطا در تولید کد رهگیری — دوباره تلاش کنید');
  }

  // ==================== LIST (4.1.8) ====================

  /**
   * Role-aware list:
   *  - customer → only own requests
   *  - operator → scope=mine (default): assigned to me; scope=all: everything
   *  - admin    → everything
   * Supports page-based AND cursor-based pagination (cursor wins).
   */
  async list(query: RequestQueryDto, actor: ActorInfo): Promise<Record<string, unknown>> {
    const isCustomer = actor.roles.includes('customer') && !actor.roles.includes('admin');
    const isOperator = actor.roles.includes('operator');
    const perPage = Math.min(query.perPage ?? 20, 100);

    const statusFilter = query.status
      ? query.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const where: Prisma.RequestWhereInput = {
      ...(isCustomer ? { customerId: BigInt(actor.id) } : {}),
      ...(isCustomer === false && isOperator && query.scope !== 'all'
        ? { assignedOperatorId: BigInt(actor.id) }
        : {}),
      ...(statusFilter.length > 0 ? { status: { in: statusFilter } } : {}),
      ...(query.serviceId ? { serviceId: BigInt(query.serviceId) } : {}),
      ...(query.search
        ? {
            OR: [
              { trackingCode: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    // ---- Cursor-based (high volume) ----
    if (query.cursor) {
      const cursorId = this.decodeCursor(query.cursor);
      const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
      const rows = await this.prisma.request.findMany({
        where: {
          ...where,
          ...(cursorId ? { id: sortDir === 'desc' ? { lt: cursorId } : { gt: cursorId } } : {}),
        },
        orderBy: { id: sortDir },
        take: perPage + 1,
        include: this.listInclude(),
      });
      const hasMore = rows.length > perPage;
      const items = hasMore ? rows.slice(0, perPage) : rows;
      const last = items[items.length - 1];
      return {
        items: items.map((r) => this.serialize(r)),
        meta: {
          cursor: hasMore && last ? this.encodeCursor(last.id) : null,
          hasMore,
          limit: perPage,
        },
      };
    }

    // ---- Page-based ----
    const page = query.page ?? 1;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        orderBy: [{ createdAt: sortDir }, { id: sortDir }],
        skip: (page - 1) * perPage,
        take: perPage,
        include: this.listInclude(),
      }),
      this.prisma.request.count({ where }),
    ]);

    return {
      items: items.map((r) => this.serialize(r)),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  // ==================== LOOKUP (4.1.9, 4.1.10) ====================

  /** Find by tracking code — customer: own only; operator: assigned; admin: any. */
  async findByTrackingCode(trackingCode: string, actor: ActorInfo) {
    const request = await this.prisma.request.findUnique({
      where: { trackingCode: trackingCode.toUpperCase() },
      include: this.detailInclude(),
    });
    if (!request) throw new NotFoundException('درخواستی با این کد رهگیری یافت نشد');
    this.assertCanView(request, actor);
    return this.serializeDetail(request);
  }

  /** Find by numeric id — same authorization rules as tracking code. */
  async findById(id: string, actor: ActorInfo) {
    const request = await this.prisma.request.findUnique({
      where: { id: this.toId(id) },
      include: this.detailInclude(),
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertCanView(request, actor);
    return this.serializeDetail(request);
  }

  // ==================== CANCEL (4.1.11) ====================

  /**
   * Customer/admin cancellation.
   *  - customer: only own + status in CANCEL_ALLOWED_STATUSES
   *  - admin: any non-terminal status reachable to 'cancelled' per state machine
   */
  async cancel(id: string, dto: CancelRequestDto, actor: ActorInfo) {
    const request = await this.prisma.request.findUnique({ where: { id: this.toId(id) } });
    if (!request) throw new NotFoundException('درخواست یافت نشد');

    const isAdmin = actor.roles.includes('admin');
    if (!isAdmin && request.customerId.toString() !== actor.id) {
      throw new ForbiddenException('شما به این درخواست دسترسی ندارید');
    }

    const cancellable = isAdmin
      ? RequestStatusMachine.canTransition(request.status, RequestStatus.CANCELLED)
      : (REQUEST_CONFIG.CANCEL_ALLOWED_STATUSES as readonly string[]).includes(request.status) &&
        RequestStatusMachine.canTransition(request.status, RequestStatus.CANCELLED);

    if (!cancellable) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `درخواست در وضعیت «${RequestStatusMachine.faLabel(request.status)}» قابل لغو نیست`,
      });
    }

    const previousStatus = request.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
        },
      });
      await tx.requestStatusHistory.create({
        data: {
          requestId: request.id,
          previousStatus,
          newStatus: RequestStatus.CANCELLED,
          userId: BigInt(actor.id),
          note: dto.reason,
        },
      });
      return r;
    });

    await this.events.emit(DOMAIN_EVENTS.REQUEST_STATUS_CHANGED, {
      requestId: updated.id.toString(),
      trackingCode: updated.trackingCode,
      previousStatus,
      newStatus: RequestStatus.CANCELLED,
      userId: actor.id,
      reason: dto.reason,
    });
    await this.realtime.notifyRequestStatusChanged(updated.id.toString(), {
      requestId: updated.id.toString(),
      previousStatus,
      status: RequestStatus.CANCELLED,
      note: dto.reason,
      at: updated.updatedAt,
    });

    this.logger.log(`Request ${updated.trackingCode} cancelled by ${actor.id}`);
    return this.serialize(updated);
  }

  // ==================== ATTACHMENTS (4.1.12) ====================

  async listAttachments(requestId: string, actor: ActorInfo, withUrls = true) {
    const request = await this.prisma.request.findUnique({
      where: { id: this.toId(requestId) },
      include: {
        attachments: { include: { file: true, uploader: { select: { fullName: true } } } },
      },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    this.assertCanView(request, actor);

    const attachments = await Promise.all(
      request.attachments.map(async (a) => {
        const url =
          withUrls && a.file && !a.file.deletedAt
            ? await this.files
                .getSignedUrl(String(a.fileId), actor.id)
                .then((r) => r.url)
                .catch(() => null)
            : null;
        return {
          id: a.id.toString(),
          fileId: a.fileId.toString(),
          originalName: a.file?.originalName,
          mimeType: a.file?.mimeType,
          sizeBytes: a.file ? Number(a.file.size) : undefined,
          visibility: a.file?.visibility,
          uploadedBy: a.uploadedBy.toString(),
          uploadedByName: a.uploader?.fullName ?? null,
          url,
          createdAt: a.createdAt,
        };
      }),
    );
    return { items: attachments };
  }

  async addAttachment(requestId: string, dto: AddAttachmentDto, actor: ActorInfo) {
    const request = await this.prisma.request.findUnique({ where: { id: this.toId(requestId) } });
    if (!request) throw new NotFoundException('درخواست یافت نشد');

    // Only the owner customer (while not terminal) or staff can attach
    const isOwner = request.customerId.toString() === actor.id;
    const isStaff = actor.roles.includes('admin') || actor.roles.includes('operator');
    if (!isOwner && !isStaff) throw new ForbiddenException('شما به این درخواست دسترسی ندارید');
    if (isOwner && RequestStatusMachine.isTerminal(request.status)) {
      throw new ConflictException('به درخواست‌های پایان‌یافته نمی‌توان فایل افزود');
    }

    const file = await this.prisma.fileUpload.findFirst({
      where: { id: BigInt(dto.fileId), deletedAt: null },
    });
    if (!file) throw new NotFoundException('فایل یافت نشد — ابتدا آن را آپلود کنید');

    const duplicate = await this.prisma.requestAttachment.findFirst({
      where: { requestId: request.id, fileId: file.id },
    });
    if (duplicate) throw new ConflictException('این فایل قبلاً به درخواست پیوست شده است');

    const attachment = await this.prisma.requestAttachment.create({
      data: { requestId: request.id, fileId: file.id, uploadedBy: BigInt(actor.id) },
      include: { file: true },
    });

    // Timeline note entry
    await this.prisma.requestStatusHistory.create({
      data: {
        requestId: request.id,
        previousStatus: request.status,
        newStatus: request.status,
        userId: BigInt(actor.id),
        note: `پیوست فایل: ${file.originalName}`,
      },
    });

    this.realtime
      .notifyRequestStatusChanged(request.id.toString(), {
        event: 'AttachmentAdded',
        attachmentId: attachment.id.toString(),
        originalName: file.originalName,
      })
      .catch(() => undefined);

    return {
      id: attachment.id.toString(),
      fileId: attachment.fileId.toString(),
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.size),
      createdAt: attachment.createdAt,
    };
  }

  // ==================== HELPERS ====================

  private listInclude(): Prisma.RequestInclude {
    return {
      service: { select: { id: true, name: true, slug: true, icon: true, categoryId: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      operator: { select: { id: true, fullName: true, phone: true } },
      _count: { select: { attachments: true } },
    };
  }

  private detailInclude(): Prisma.RequestInclude {
    return {
      service: { include: { category: { select: { id: true, name: true, slug: true } } } },
      customer: { select: { id: true, fullName: true, phone: true, email: true } },
      operator: { select: { id: true, fullName: true, phone: true } },
      contactMethod: { select: { id: true, name: true, slug: true } },
      fieldValues: {
        include: { field: { select: { id: true, name: true, label: true, type: true } } },
      },
      attachments: { include: { file: true } },
      statusHistories: { orderBy: { createdAt: 'asc' } },
      assignments: { orderBy: { createdAt: 'desc' } },
    };
  }

  private async generateTrackingCode(tx: Tx): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${REQUEST_CONFIG.TRACKING_CODE_PREFIX}-${year}-`;
    const count = await tx.request.count({
      where: { trackingCode: { startsWith: prefix } },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `${prefix}${seq}`;
  }

  private async resolveContact(dto: CreateRequestDto, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { phone: true, email: true, preferredContactMethodId: true },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    let methodId: bigint | null = null;
    if (dto.contactMethod) {
      const method = await this.prisma.contactMethod.findFirst({
        where: { slug: dto.contactMethod, active: true },
      });
      if (!method) throw new BadRequestException(`روش تماس «${dto.contactMethod}» یافت نشد`);
      methodId = method.id;
    } else if (user.preferredContactMethodId) {
      methodId = user.preferredContactMethodId;
    }

    const value = dto.contactValue ?? user.phone ?? user.email ?? null;
    return { methodId, value };
  }

  /**
   * Validate uploaded files: exist, owned by customer, not deleted.
   * Also accepts file ids referenced INSIDE formData for file/image fields.
   */
  private async validateFileIds(
    fileIds: string[],
    userId: string,
    formData: Record<string, unknown>,
    fields: Array<{ name: string; type: string }>,
  ): Promise<Array<{ id: bigint }>> {
    const ids = new Set<string>(fileIds.filter(Boolean).map(String));

    // Collect file-type field values (they reference uploaded file ids)
    for (const f of fields) {
      if (f.type === 'file' || f.type === 'image') {
        const v = formData?.[f.name];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          ids.add(String(v));
        }
      }
    }
    if (ids.size === 0) return [];

    const records = await this.prisma.fileUpload.findMany({
      where: { id: { in: [...ids].map((i) => BigInt(i)) }, deletedAt: null },
    });
    if (records.length !== ids.size) {
      throw new BadRequestException('یک یا چند فایل ارسالی یافت نشد');
    }
    for (const rec of records) {
      if (rec.uploadedById.toString() !== userId) {
        throw new ForbiddenException('شما مالک همه فایل‌های ارسالی نیستید');
      }
    }
    return records.map((r) => ({ id: r.id }));
  }

  private buildFieldValueRows(
    requestId: bigint,
    values: Record<string, unknown>,
    fields: Array<{ id: bigint; name: string; type: string }>,
  ): Array<{ requestId: bigint; fieldId: bigint; value: string | null }> {
    const rows: Array<{ requestId: bigint; fieldId: bigint; value: string | null }> = [];
    for (const f of fields) {
      const v = values[f.name];
      if (v === undefined || v === null) continue;
      let serialized: string | null;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        serialized = JSON.stringify(v);
      } else if (typeof v === 'object') {
        serialized = JSON.stringify(v);
      } else if (typeof v === 'boolean') {
        serialized = v ? '1' : '0';
      } else {
        serialized = String(v);
      }
      rows.push({ requestId, fieldId: f.id, value: serialized });
    }
    return rows;
  }

  /** Authorization: customer(owner) / assigned operator / admin. */
  private assertCanView(
    request: { customerId: bigint; assignedOperatorId: bigint | null },
    actor: ActorInfo,
  ): void {
    if (actor.roles.includes('admin')) return;
    if (request.customerId.toString() === actor.id) return;
    if (actor.roles.includes('operator') && request.assignedOperatorId?.toString() === actor.id) {
      return;
    }
    throw new ForbiddenException('شما به این درخواست دسترسی ندارید');
  }

  private toId(id: string): bigint {
    if (!/^\d+$/.test(id)) throw new BadRequestException('شناسه نامعتبر است');
    return BigInt(id);
  }

  private encodeCursor(id: bigint): string {
    return Buffer.from(`id:${id.toString()}`, 'utf8').toString('base64');
  }

  private decodeCursor(cursor: string): bigint | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const m = decoded.match(/^id:(\d+)$/);
      return m ? BigInt(m[1]!) : null;
    } catch {
      throw new BadRequestException('کرسر صفحه‌بندی نامعتبر است');
    }
  }

  // ==================== SERIALIZATION ====================

  private serialize(r: Record<string, unknown>): Record<string, unknown> {
    const service = r.service as Record<string, unknown> | undefined;
    const customer = r.customer as Record<string, unknown> | undefined;
    const operator = r.operator as Record<string, unknown> | undefined;
    const count = r._count as { attachments?: number } | undefined;
    return {
      id: str(r.id),
      uuid: r.uuid,
      trackingCode: r.trackingCode,
      customerId: str(r.customerId),
      customer: customer
        ? {
            id: str(customer.id),
            fullName: customer.fullName ?? null,
            phone: customer.phone,
          }
        : undefined,
      serviceId: str(r.serviceId),
      service: service
        ? {
            id: str(service.id),
            name: service.name,
            slug: service.slug,
            icon: service.icon ?? null,
            categoryId: str(service.categoryId),
          }
        : undefined,
      status: r.status,
      paymentStatus: r.paymentStatus,
      description: r.description ?? null,
      laborFee: toMajor(Number(r.laborFeeSnapshot ?? 0n)),
      finalTotal: toMajor(Number(r.finalTotal ?? 0n)),
      currency: r.currency,
      assignedOperatorId: r.assignedOperatorId ? str(r.assignedOperatorId) : null,
      assignedOperator: operator
        ? { id: str(operator.id), fullName: operator.fullName ?? null, phone: operator.phone }
        : null,
      estimatedDurationMin: r.estimatedDurationMin ?? null,
      contactValue: r.contactValue ?? null,
      completedAt: r.completedAt ?? null,
      cancelledAt: r.cancelledAt ?? null,
      cancellationReason: r.cancellationReason ?? null,
      attachmentsCount: count?.attachments ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private serializeDetail(r: Record<string, unknown>): Record<string, unknown> {
    const contactMethod = r.contactMethod as Record<string, unknown> | undefined;
    const base = this.serialize(r);
    return {
      ...base,
      contactMethod: contactMethod
        ? { id: str(contactMethod.id), name: contactMethod.name, slug: contactMethod.slug }
        : null,
      fieldValues: ((r.fieldValues as Array<Record<string, unknown>>) ?? []).map((fv) => {
        const field = fv.field as Record<string, unknown> | undefined;
        return {
          id: str(fv.id),
          fieldId: str(fv.fieldId),
          fieldName: field?.name,
          fieldLabel: field?.label,
          fieldType: field?.type,
          value: fv.value,
          createdAt: fv.createdAt,
        };
      }),
      attachments: ((r.attachments as Array<Record<string, unknown>>) ?? []).map((a) => {
        const file = a.file as Record<string, unknown> | undefined;
        return {
          id: str(a.id),
          fileId: str(a.fileId),
          originalName: file?.originalName,
          mimeType: file?.mimeType,
          sizeBytes: file ? Number(file.size) : undefined,
          uploadedBy: str(a.uploadedBy),
          createdAt: a.createdAt,
        };
      }),
      statusHistory: ((r.statusHistories as Array<Record<string, unknown>>) ?? []).map((h) => ({
        id: str(h.id),
        previousStatus: h.previousStatus ?? null,
        newStatus: h.newStatus,
        userId: str(h.userId),
        note: h.note ?? null,
        createdAt: h.createdAt,
      })),
      assignments: ((r.assignments as Array<Record<string, unknown>>) ?? []).map((a) => ({
        id: str(a.id),
        operatorId: str(a.operatorId),
        assignedBy: str(a.assignedBy),
        active: a.active,
        note: a.note ?? null,
        createdAt: a.createdAt,
        unassignedAt: a.unassignedAt ?? null,
      })),
    };
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'bigint' ? v.toString() : String(v);
}

function hasRequiredFields(fields: FieldDefinition[]): boolean {
  return fields.some((f) => f.required);
}
