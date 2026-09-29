import {
  BadRequestException,
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
import { toMajor } from '../../common/utils/money';
import { AuditAction, DOMAIN_EVENTS, INVOICE_CONFIG, InvoiceStatus } from '@caffenet/shared';
import { InvoicePdfGenerator } from './pdf/invoice-pdf.generator';

type Tx = Prisma.TransactionClient;

export interface InvoiceActor {
  id: string;
  roles: string[];
}

/**
 * Invoices service — Phase 5.4.
 *
 * Guarantees:
 *  - Generation is IDEMPOTENT: invoices are 1:1 with requests (UNIQUE
 *    request_id); re-generation returns the existing invoice (5.4.3).
 *  - Invoice is a FINANCIAL SNAPSHOT: all amounts are copied from
 *    request_costs at generation time — later cost edits never mutate it.
 *  - Invoice number: INV-YYYY-NNNNNN derived from the request id →
 *    collision-free without a sequence table (request_id is UNIQUE).
 *  - Authorization: customer(owner) / assigned operator / admin.
 *  - PDF is rendered server-side from the snapshot — the client can NEVER
 *    influence invoice contents (5.4.5).
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  // ==================== GENERATION (5.4.3) ====================

  /**
   * Generate (or fetch the already-generated) invoice for a request.
   * Safe to call inside the status-change transaction (tx passed through by
   * RequestWorkflowService) OR standalone after the fact.
   */
  async generateForRequest(requestId: bigint, tx?: Tx): Promise<Record<string, unknown>> {
    const db: Tx | PrismaService = tx ?? this.prisma;

    const request = await db.request.findUnique({
      where: { id: requestId },
      select: { id: true, trackingCode: true, createdAt: true, customerId: true },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');

    // Idempotent — 1:1 with requests
    const existing = await db.invoice.findUnique({
      where: { requestId },
      include: { items: true },
    });
    if (existing) return this.serialize(existing);

    const cost = await db.requestCost.findUnique({ where: { requestId } });
    if (!cost) throw new NotFoundException('اطلاعات قیمت درخواست یافت نشد');

    const laborFee = Number(cost.laborFee);
    const materialCost = Number(cost.materialCost);
    const additionalCost = Number(cost.additionalCost);
    const discountAmount = Number(cost.discountAmount);
    const finalTotal = Number(cost.finalTotal);

    const year = request.createdAt.getFullYear();
    const invoiceNumber = `${INVOICE_CONFIG.NUMBER_PREFIX}-${year}-${String(request.id).padStart(INVOICE_CONFIG.NUMBER_PAD, '0')}`;

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        customerId: request.customerId,
        requestId,
        laborFee: BigInt(laborFee),
        materialCost: BigInt(materialCost),
        additionalCost: BigInt(additionalCost),
        discountAmount: BigInt(discountAmount),
        finalTotal: BigInt(finalTotal),
        currency: cost.currency,
        status: InvoiceStatus.ISSUED,
        discountCodeId:
          (await db.discountUsage.findUnique({ where: { requestId } }))?.discountId ?? null,
        items: {
          create: this.buildItemRows(laborFee, materialCost, additionalCost, discountAmount),
        },
      },
      include: { items: true },
    });

    this.logger.log(`Invoice ${invoiceNumber} generated for ${request.trackingCode}`);
    return this.serialize(invoice);
  }

  /** Line items (5.4.2) — snapshot of the four price components. */
  private buildItemRows(
    laborFee: number,
    materialCost: number,
    additionalCost: number,
    discountAmount: number,
  ): Array<{ type: string; description: string; amount: bigint }> {
    const rows: Array<{ type: string; description: string; amount: bigint }> = [];
    if (laborFee > 0) {
      rows.push({
        type: 'labor',
        description: 'دستمزد خدمت (اسنپ‌شات لحظه ثبت)',
        amount: BigInt(laborFee),
      });
    }
    if (materialCost > 0) {
      rows.push({ type: 'material', description: 'هزینه مواد', amount: BigInt(materialCost) });
    }
    if (additionalCost > 0) {
      rows.push({
        type: 'additional',
        description: 'هزینه‌های تکمیلی',
        amount: BigInt(additionalCost),
      });
    }
    if (discountAmount > 0) {
      rows.push({
        type: 'discount',
        description: 'تخفیف اعمال‌شده',
        amount: BigInt(-discountAmount),
      });
    }
    return rows;
  }

  // ==================== READ (5.4.4) ====================

  async findById(id: string, actor: InvoiceActor) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: this.toId(id) },
      include: {
        items: { orderBy: { id: 'asc' } },
        request: {
          select: {
            trackingCode: true,
            assignedOperatorId: true,
            service: { select: { name: true } },
          },
        },
        customer: { select: { fullName: true, phone: true } },
        discountCode: { select: { code: true } },
      },
    });
    if (!invoice) throw new NotFoundException('فاکتور یافت نشد');
    this.assertCanView(invoice, actor);
    return this.serialize(invoice);
  }

  /** Lookup by invoice number — same authorization as findById. */
  async findByNumber(invoiceNumber: string, actor: InvoiceActor) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: {
        items: { orderBy: { id: 'asc' } },
        request: {
          select: {
            trackingCode: true,
            assignedOperatorId: true,
            service: { select: { name: true } },
          },
        },
        customer: { select: { fullName: true, phone: true } },
        discountCode: { select: { code: true } },
      },
    });
    if (!invoice) throw new NotFoundException('فاکتور یافت نشد');
    this.assertCanView(invoice, actor);
    return this.serialize(invoice);
  }

  /** Customer's own invoices — always scoped to the caller. */
  async listMine(actor: InvoiceActor, page = 1, perPage = 20) {
    const where: Record<string, unknown> = actor.roles.includes('admin')
      ? {}
      : { customerId: BigInt(actor.id) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { request: { select: { trackingCode: true } } },
      }),
    ]);
    return {
      items: rows.map((r) => this.serialize(r)),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  // ==================== PDF DOWNLOAD (5.4.5) ====================

  async downloadPdf(
    id: string,
    actor: InvoiceActor,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: this.toId(id) },
      include: {
        items: { orderBy: { id: 'asc' } },
        request: {
          select: {
            trackingCode: true,
            assignedOperatorId: true,
            service: { select: { name: true } },
          },
        },
        customer: { select: { fullName: true, phone: true } },
      },
    });
    if (!invoice) throw new NotFoundException('فاکتور یافت نشد');
    this.assertCanView(invoice, actor);

    const buffer = await InvoicePdfGenerator.generate({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      paidAt: invoice.paidAt,
      status: invoice.status,
      customerName: invoice.customer?.fullName ?? null,
      customerPhone: invoice.customer?.phone ?? null,
      trackingCode: invoice.request?.trackingCode ?? '—',
      serviceName: invoice.request?.service?.name ?? null,
      currency: invoice.currency,
      laborFee: toMajor(Number(invoice.laborFee)),
      materialCost: toMajor(Number(invoice.materialCost)),
      additionalCost: toMajor(Number(invoice.additionalCost)),
      discountAmount: toMajor(Number(invoice.discountAmount)),
      finalTotal: toMajor(Number(invoice.finalTotal)),
      items: invoice.items.map((i) => ({
        type: i.type,
        description: i.description,
        amount: toMajor(Number(i.amount)),
      })),
    });

    await this.audit.log({
      userId: actor.id,
      action: AuditAction.CREATE,
      entity: 'invoice_pdf_download',
      entityId: invoice.invoiceNumber,
    });

    return { filename: `${invoice.invoiceNumber}.pdf`, buffer };
  }

  // ==================== HELPERS ====================

  private assertCanView(
    invoice: {
      customerId: bigint;
      request?: { assignedOperatorId?: bigint | null } | null;
    },
    actor: InvoiceActor,
  ): void {
    if (actor.roles.includes('admin')) return;
    if (invoice.customerId.toString() === actor.id) return;
    if (
      actor.roles.includes('operator') &&
      invoice.request?.assignedOperatorId?.toString() === actor.id
    ) {
      return;
    }
    throw new ForbiddenException('شما به این فاکتور دسترسی ندارید');
  }

  private toId(id: string): bigint {
    if (!/^\d+$/.test(id)) throw new BadRequestException('شناسه نامعتبر است');
    return BigInt(id);
  }

  private serialize(inv: Record<string, unknown>): Record<string, unknown> {
    const request = inv.request as Record<string, unknown> | undefined;
    const customer = inv.customer as Record<string, unknown> | undefined;
    const discountCode = inv.discountCode as Record<string, unknown> | undefined;
    return {
      id: (inv.id as bigint).toString(),
      uuid: inv.uuid,
      invoiceNumber: inv.invoiceNumber,
      customerId: (inv.customerId as bigint).toString(),
      customerName: customer?.fullName ?? null,
      customerPhone: customer?.phone ?? null,
      requestId: (inv.requestId as bigint).toString(),
      requestTrackingCode: request?.trackingCode,
      serviceName: (request as { service?: { name?: string } } | undefined)?.service?.name,
      laborFee: toMajor(Number(inv.laborFee)),
      materialCost: toMajor(Number(inv.materialCost)),
      additionalCost: toMajor(Number(inv.additionalCost)),
      discountAmount: toMajor(Number(inv.discountAmount)),
      finalTotal: toMajor(Number(inv.finalTotal)),
      currency: inv.currency,
      status: inv.status,
      discountCodeId: inv.discountCodeId ? (inv.discountCodeId as bigint).toString() : null,
      discountCode: discountCode?.code ?? null,
      paidAt: inv.paidAt ?? null,
      voidedAt: inv.voidedAt ?? null,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      items: ((inv.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
        id: (i.id as bigint).toString(),
        type: i.type,
        description: i.description,
        amount: toMajor(Number(i.amount)),
        createdAt: i.createdAt,
      })),
    };
  }
}
