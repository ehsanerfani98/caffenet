import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { WalletService } from '../wallet/wallet.service';
import { toMajor } from '../../common/utils/money';

/**
 * AdminManagementService (Phase 9.3–9.9, 9.12) — user/operator/role management,
 * contact methods, settings, refunds and broadcast notifications.
 * Every sensitive mutation writes an audit log entry (Phase 9 exit criteria).
 */

export interface Actor {
  id: string;
  roles: string[];
}

const PUBLIC_USER_SELECT = {
  id: true,
  uuid: true,
  phone: true,
  email: true,
  fullName: true,
  status: true,
  preferredLocale: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, name: true, slug: true, description: true } } } },
} as const;

type UserRow = {
  id: bigint;
  uuid: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  status: string;
  preferredLocale: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { role: { id: bigint; name: string; slug: string; description: string | null } }[];
};

function serializeUser(u: UserRow) {
  return {
    id: u.id.toString(),
    uuid: u.uuid,
    phone: u.phone,
    email: u.email,
    fullName: u.fullName,
    status: u.status,
    preferredLocale: u.preferredLocale,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    roles: u.roles.map((r) => ({
      id: r.role.id.toString(),
      name: r.role.name,
      slug: r.role.slug,
      description: r.role.description,
    })),
  };
}

@Injectable()
export class AdminManagementService {
  private readonly logger = new Logger(AdminManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
  ) {}

  // ==========================================================================
  // Users management (9.3)
  // ==========================================================================

  async listUsers(q: {
    page?: number;
    perPage?: number;
    search?: string;
    role?: string;
    status?: string;
  }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 20, 100);
    const where: Record<string, unknown> = { deletedAt: null };
    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { phone: { contains: s } },
        { email: { contains: s } },
        { fullName: { contains: s } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.role) where.roles = { some: { role: { slug: q.role } } };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);
    return {
      items: rows.map(serializeUser),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const [requestStats, wallet, sessions] = await Promise.all([
      this.prisma.request.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { customerId: BigInt(id) },
      }),
      this.prisma.wallet.findUnique({ where: { userId: BigInt(id) } }),
      this.prisma.session.count({ where: { userId: BigInt(id), status: 'active' } }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const g of requestStats) byStatus[g.status] = g._count._all;

    return {
      user: serializeUser(user),
      requestStats: byStatus,
      wallet: wallet
        ? { balanceToman: toMajor(Number(wallet.balance)), status: wallet.status }
        : null,
      activeSessions: sessions,
    };
  }

  async updateUser(
    id: string,
    dto: { fullName?: string; email?: string; status?: string },
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    if (dto.email) {
      const dup = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: BigInt(id) } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('این ایمیل قبلاً استفاده شده است');
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: PUBLIC_USER_SELECT,
    });

    // Ban → revoke all sessions so a banned user is logged out everywhere
    if (dto.status === 'banned') {
      await this.prisma.session.updateMany({
        where: { userId: BigInt(id), status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() },
      });
    }

    await this.audit.log({
      userId: actor.id,
      action: 'update',
      entity: 'user',
      entityId: user.uuid,
      oldData: { fullName: user.fullName, email: user.email, status: user.status },
      newData: dto as Record<string, unknown>,
      ip,
      userAgent: ua,
    });
    return serializeUser(updated);
  }

  async assignRole(userId: string, roleId: string, actor: Actor, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(roleId) } });
    if (!role) throw new NotFoundException('نقش یافت نشد');

    const exists = await this.prisma.userRole.findFirst({
      where: { userId: BigInt(userId), roleId: BigInt(roleId) },
    });
    if (exists) throw new ConflictException('این نقش قبلاً به کاربر اختصاص یافته است');

    await this.prisma.userRole.create({ data: { userId: BigInt(userId), roleId: BigInt(roleId) } });
    await this.audit.log({
      userId: actor.id,
      action: 'role_change',
      entity: 'user',
      entityId: user.uuid,
      newData: { assignRole: role.slug },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  async revokeRole(userId: string, roleId: string, actor: Actor, ip?: string, ua?: string) {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(roleId) } });
    if (!role) throw new NotFoundException('نقش یافت نشد');
    if (role.name === 'admin' && !actor.roles.includes('admin')) {
      throw new ForbiddenException('فقط ادمین می‌تواند نقش ادمین را حذف کند');
    }
    const link = await this.prisma.userRole.findFirst({
      where: { userId: BigInt(userId), roleId: BigInt(roleId) },
    });
    if (!link) throw new NotFoundException('این نقش به کاربر اختصاص نیافته است');

    // Safety: do not allow removing the last admin
    if (role.name === 'admin') {
      const admins = await this.prisma.userRole.count({
        where: { role: { name: 'admin' }, user: { deletedAt: null } },
      });
      if (admins <= 1) throw new ConflictException('حداقل یک ادمین باید باقی بماند');
    }

    await this.prisma.userRole.delete({ where: { id: link.id } });
    await this.audit.log({
      userId: actor.id,
      action: 'role_change',
      entity: 'user',
      entityId: String(userId),
      oldData: { revokeRole: role.slug },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  /** Admin reset — sets a new temporary password (9.3.5). */
  async resetPassword(userId: string, newPassword: string, actor: Actor, ip?: string, ua?: string) {
    if (newPassword.length < 8) throw new BadRequestException('رمز عبور حداقل ۸ کاراکتر باشد');
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: BigInt(userId) }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId: BigInt(userId), status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      userId: actor.id,
      action: 'update',
      entity: 'user',
      entityId: user.uuid,
      newData: { passwordReset: true },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  // ==========================================================================
  // Operators management (9.4)
  // ==========================================================================

  async listOperators(q: { page?: number; perPage?: number; search?: string; status?: string }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 20, 100);
    const where: Record<string, unknown> = {
      deletedAt: null,
      roles: { some: { role: { name: 'operator' } } },
    };
    if (q.status) where.status = q.status;
    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { phone: { contains: s } },
        { fullName: { contains: s } },
        { email: { contains: s } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    const items = await Promise.all(
      rows.map(async (u) => {
        const [assigned, completed, avgMs] = await Promise.all([
          this.prisma.requestAssignment.count({
            where: { operatorId: BigInt(u.id), active: true },
          }),
          this.prisma.request.count({
            where: { assignedOperatorId: BigInt(u.id), status: 'completed' },
          }),
          this.avgCompletionMs(BigInt(u.id)),
        ]);
        return {
          ...serializeUser(u),
          stats: {
            currentlyAssigned: assigned,
            completedTotal: completed,
            avgCompletionHours: avgMs === null ? null : Math.round((avgMs / 3600_000) * 10) / 10,
          },
        };
      }),
    );
    return {
      items,
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  async createOperator(
    dto: { phone: string; password: string; fullName?: string; email?: string },
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    if (!/^09\d{9}$/.test(dto.phone))
      throw new BadRequestException('شماره موبایل نامعتبر است (۰۹xxxxxxxxx)');
    if (dto.password.length < 8) throw new BadRequestException('رمز عبور حداقل ۸ کاراکتر باشد');

    const dup = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (dup) throw new ConflictException('این شماره قبلاً ثبت شده است');

    const operatorRole = await this.prisma.role.findUnique({ where: { name: 'operator' } });
    if (!operatorRole) throw new NotFoundException('نقش اپراتور یافت نشد');

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        email: dto.email,
        status: 'active',
        roles: { create: { roleId: operatorRole.id } },
      },
      select: PUBLIC_USER_SELECT,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'create',
      entity: 'user',
      entityId: user.uuid,
      newData: { phone: dto.phone, role: 'operator' },
      ip,
      userAgent: ua,
    });
    return serializeUser(user);
  }

  async setOperatorStatus(
    userId: string,
    status: 'active' | 'suspended',
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), roles: { some: { role: { name: 'operator' } } } },
    });
    if (!user) throw new NotFoundException('اپراتور یافت نشد');

    await this.prisma.user.update({ where: { id: BigInt(userId) }, data: { status } });
    if (status === 'suspended') {
      await this.prisma.session.updateMany({
        where: { userId: BigInt(userId), status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() },
      });
    }
    await this.audit.log({
      userId: actor.id,
      action: 'update',
      entity: 'user',
      entityId: user.uuid,
      oldData: { status: user.status },
      newData: { status },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  // ==========================================================================
  // Roles & permissions (9.5)
  // ==========================================================================

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: { select: { permission: { select: { slug: true } } } },
        _count: { select: { users: true } },
      },
      orderBy: { id: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id.toString(),
      uuid: r.uuid,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: r.isSystem,
      usersCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.slug),
    }));
  }

  async listPermissions() {
    const rows = await this.prisma.permission.findMany({
      orderBy: [{ group: 'asc' }, { id: 'asc' }],
    });
    const groups = new Map<
      string,
      { id: string; slug: string; name: string; description: string | null }[]
    >();
    for (const p of rows) {
      const arr = groups.get(p.group) ?? [];
      arr.push({ id: p.id.toString(), slug: p.slug, name: p.name, description: p.description });
      groups.set(p.group, arr);
    }
    return [...groups.entries()].map(([group, permissions]) => ({ group, permissions }));
  }

  async createRole(
    dto: { name: string; slug: string; description?: string; permissionSlugs: string[] },
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const dup = await this.prisma.role.findFirst({
      where: { OR: [{ name: dto.name }, { slug: dto.slug }] },
    });
    if (dup) throw new ConflictException('نقشی با این نام یا شناسه وجود دارد');

    const perms = await this.prisma.permission.findMany({
      where: { slug: { in: dto.permissionSlugs } },
    });
    if (perms.length !== dto.permissionSlugs.length) {
      throw new BadRequestException('یک یا چند مجوز نامعتبر است');
    }
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        isSystem: false,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'permission_change',
      entity: 'role',
      entityId: role.uuid,
      newData: { slug: role.slug, permissions: dto.permissionSlugs },
      ip,
      userAgent: ua,
    });
    return { ok: true, id: role.id.toString() };
  }

  async updateRolePermissions(
    roleId: string,
    permissionSlugs: string[],
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: BigInt(roleId) } });
    if (!role) throw new NotFoundException('نقش یافت نشد');
    if (role.isSystem && role.name === 'admin') {
      throw new ForbiddenException('مجوزهای نقش ادمین قابل تغییر نیست');
    }
    const perms = await this.prisma.permission.findMany({
      where: { slug: { in: permissionSlugs } },
    });
    if (perms.length !== permissionSlugs.length) {
      throw new BadRequestException('یک یا چند مجوز نامعتبر است');
    }
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: BigInt(roleId) } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: BigInt(roleId), permissionId: p.id })),
      }),
    ]);
    await this.audit.log({
      userId: actor.id,
      action: 'permission_change',
      entity: 'role',
      entityId: role.uuid,
      oldData: { slug: role.slug },
      newData: { permissions: permissionSlugs },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  async deleteRole(roleId: string, actor: Actor, ip?: string, ua?: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: BigInt(roleId) },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('نقش یافت نشد');
    if (role.isSystem) throw new ConflictException('نقش سیستمی قابل حذف نیست');
    if (role._count.users > 0) {
      throw new ConflictException(
        `${role._count.users} کاربر این نقش را دارند — ابتدا نقش را از کاربران حذف کنید`,
      );
    }
    await this.prisma.role.delete({ where: { id: BigInt(roleId) } });
    await this.audit.log({
      userId: actor.id,
      action: 'delete',
      entity: 'role',
      entityId: role.uuid,
      oldData: { slug: role.slug },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  // ==========================================================================
  // Contact methods (9.9.1)
  // ==========================================================================

  async listContactMethods() {
    const rows = await this.prisma.contactMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((m) => ({
      id: m.id.toString(),
      uuid: m.uuid,
      name: m.name,
      slug: m.slug,
      description: m.description,
      icon: m.icon,
      active: m.active,
      sortOrder: m.sortOrder,
      isSystem: m.isSystem,
    }));
  }

  async upsertContactMethod(
    dto: {
      name?: string;
      slug?: string;
      description?: string;
      icon?: string;
      active?: boolean;
      sortOrder?: number;
    },
    id: string | null,
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    if (id) {
      const existing = await this.prisma.contactMethod.findUnique({ where: { id: BigInt(id) } });
      if (!existing) throw new NotFoundException('روش تماس یافت نشد');
      const updated = await this.prisma.contactMethod.update({
        where: { id: BigInt(id) },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
      await this.audit.log({
        userId: actor.id,
        action: 'update',
        entity: 'contact_method',
        entityId: updated.uuid,
        oldData: { name: existing.name, active: existing.active },
        newData: dto as Record<string, unknown>,
        ip,
        userAgent: ua,
      });
      return { ok: true, id: updated.id.toString() };
    }
    if (!dto.name || !dto.slug) throw new BadRequestException('نام و شناسه روش تماس الزامی است');
    const dup = await this.prisma.contactMethod.findUnique({ where: { slug: dto.slug } });
    if (dup) throw new ConflictException('روش تماسی با این شناسه وجود دارد');
    const created = await this.prisma.contactMethod.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        icon: dto.icon,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 99,
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'create',
      entity: 'contact_method',
      entityId: created.uuid,
      newData: { name: created.name, slug: created.slug },
      ip,
      userAgent: ua,
    });
    return { ok: true, id: created.id.toString() };
  }

  async reorderContactMethods(orderedIds: string[], actor: Actor, ip?: string, ua?: string) {
    await this.prisma.$transaction(
      orderedIds.map((id, idx) =>
        this.prisma.contactMethod.update({ where: { id: BigInt(id) }, data: { sortOrder: idx } }),
      ),
    );
    await this.audit.log({
      userId: actor.id,
      action: 'update',
      entity: 'contact_method',
      newData: { reordered: orderedIds.length },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  // ==========================================================================
  // Settings (9.12) — SystemSetting table, secrets masked on read
  // ==========================================================================

  private readonly SETTING_KEYS = {
    general: [
      'system.name',
      'system.logo_url',
      'system.currency',
      'system.timezone',
      'system.contact_phone',
      'system.contact_email',
    ],
    notifications: [
      'notifications.sms_enabled',
      'notifications.email_enabled',
      'notifications.inapp_enabled',
    ],
    payment: [
      'payments.zarinpal_enabled',
      'payments.zibal_enabled',
      'payments.default_gateway',
      'payments.zarinpal_merchant_id',
      'payments.zibal_api_key',
    ],
    pusher: ['pusher.enabled', 'pusher.cluster', 'pusher.app_id', 'pusher.key', 'pusher.secret'],
    pwa: ['pwa.theme_color', 'pwa.icon_192', 'pwa.icon_512', 'pwa.app_name'],
    files: ['files.max_size_mb', 'files.allowed_extensions'],
    requests: ['requests.auto_assign_strategy', 'requests.auto_approve'],
    sms: ['sms.provider', 'sms.ipanel_api_key', 'sms.sender_number'],
  } as const;

  async listSettings() {
    const all = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    const sections: Record<string, unknown> = {};
    for (const [section, keys] of Object.entries(this.SETTING_KEYS)) {
      sections[section] = keys.map((key) => {
        const row = all.find((s) => s.key === key);
        return {
          key,
          type: row?.type ?? 'string',
          isSecret: row?.isSecret ?? false,
          description: row?.description ?? null,
          updatedAt: row?.updatedAt.toISOString() ?? null,
          value: row ? (row.isSecret && row.value ? '••••••••' : row.value) : null,
          valueJson: row?.valueJson ?? null,
          hasValue: !!row?.value || !!row?.valueJson,
        };
      });
    }
    return sections;
  }

  async updateSettings(
    entries: { key: string; value?: string; valueJson?: unknown }[],
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const allowed = new Set(Object.values(this.SETTING_KEYS).flat());
    for (const e of entries) {
      if (!allowed.has(e.key as never))
        throw new BadRequestException(`کلید تنظیم نامعتبر: ${e.key}`);
    }
    for (const e of entries) {
      const isSecret = /api_key|secret|merchant_id/.test(e.key);
      await this.prisma.systemSetting.upsert({
        where: { key: e.key },
        create: {
          key: e.key,
          value: e.value ?? null,
          valueJson: e.valueJson === undefined ? undefined : (e.valueJson as object),
          type: e.valueJson !== undefined ? 'json' : 'string',
          isSecret,
          updatedBy: BigInt(actor.id),
        },
        update: {
          value: e.value ?? null,
          valueJson: e.valueJson === undefined ? undefined : (e.valueJson as object),
          type: e.valueJson !== undefined ? 'json' : 'string',
          isSecret,
          updatedBy: BigInt(actor.id),
        },
      });
    }
    await this.audit.log({
      userId: actor.id,
      action: 'setting_change',
      entity: 'settings',
      newData: { keys: entries.map((e) => e.key) },
      ip,
      userAgent: ua,
    });
    return { ok: true };
  }

  // ==========================================================================
  // Refund (9.7.4 / 9.8.3) — gateway payment → customer wallet
  // ==========================================================================

  async refundPayment(
    paymentId: string,
    dto: { amountToman?: number; reason: string },
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: BigInt(paymentId) } });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');
    if (payment.status !== 'successful') {
      throw new ConflictException('فقط پرداخت موفق قابل بازگشت است');
    }

    const fullToman = toMajor(Number(payment.amount));
    const amountToman = dto.amountToman ?? fullToman;
    if (amountToman <= 0 || amountToman > fullToman) {
      throw new BadRequestException(`مبلغ بازگشت باید بین ۱ و ${fullToman} تومان باشد`);
    }

    await this.wallet.manualAdjustment({
      userId: payment.userId.toString(),
      amountToman,
      adminUserId: actor.id,
      reason: `بازگشت وجه پرداخت ${payment.uuid} — ${dto.reason}`,
    });

    const refunded = dto.amountToman === undefined || amountToman >= fullToman;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: refunded ? 'refunded' : payment.status,
        refundedAt: refunded ? new Date() : payment.refundedAt,
        metadata: {
          ...((payment.metadata as object) ?? {}),
          refundReason: dto.reason,
          refundedToman: amountToman,
        },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: 'refund_issue',
      entity: 'payment',
      entityId: payment.uuid,
      newData: { amountToman, reason: dto.reason, full: refunded },
      ip,
      userAgent: ua,
    });
    this.logger.log(`Refund ${amountToman} Toman of payment ${payment.uuid} by admin ${actor.id}`);
    return { ok: true, amountToman, full: refunded };
  }

  // ==========================================================================
  // Broadcast notifications (9.9.3) — in-app fan-out
  // ==========================================================================

  async broadcast(
    dto: {
      title: string;
      body?: string;
      audience: 'all' | 'customers' | 'operators';
      type?: string;
    },
    actor: Actor,
    ip?: string,
    ua?: string,
  ) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (dto.audience === 'customers') where.roles = { some: { role: { name: 'customer' } } };
    if (dto.audience === 'operators') where.roles = { some: { role: { name: 'operator' } } };

    const users = await this.prisma.user.findMany({ where, select: { id: true }, take: 10000 });
    if (users.length === 0) throw new BadRequestException('هیچ کاربری در این گروه یافت نشد');

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: dto.type ?? 'system',
        title: dto.title,
        body: dto.body,
      })),
    });
    await this.audit.log({
      userId: actor.id,
      action: 'create',
      entity: 'notification',
      newData: {
        broadcast: true,
        audience: dto.audience,
        recipients: users.length,
        title: dto.title,
      },
      ip,
      userAgent: ua,
    });
    return { ok: true, recipients: users.length };
  }

  async listBroadcasts(page = 1, perPage = 20) {
    const where = { entity: 'notification' };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { user: { select: { fullName: true, phone: true } } },
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        title: (r.newData as { title?: string } | null)?.title ?? '',
        audience: (r.newData as { audience?: string } | null)?.audience ?? 'all',
        recipients: (r.newData as { recipients?: number } | null)?.recipients ?? 0,
        actorName: r.user?.fullName ?? r.user?.phone ?? '—',
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  // ==========================================================================
  // Wallets overview (9.8.1) — all users with balances
  // ==========================================================================

  async listWallets(q: { page?: number; perPage?: number; search?: string }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 20, 100);
    const userWhere: Record<string, unknown> = { deletedAt: null };
    if (q.search) {
      const s = q.search.trim();
      userWhere.OR = [{ phone: { contains: s } }, { fullName: { contains: s } }];
    }

    const [total, wallets] = await this.prisma.$transaction([
      this.prisma.wallet.count({ where: { user: userWhere } }),
      this.prisma.wallet.findMany({
        where: { user: userWhere },
        orderBy: { balance: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: { select: { id: true, uuid: true, phone: true, fullName: true, status: true } },
        },
      }),
    ]);
    return {
      items: wallets.map((w) => ({
        id: w.id.toString(),
        userId: w.user.id.toString(),
        userUuid: w.user.uuid,
        phone: w.user.phone,
        fullName: w.user.fullName,
        userStatus: w.user.status,
        balanceToman: toMajor(Number(w.balance)),
        status: w.status,
      })),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  /** Payments list for admin (9.8.4). */
  async listPayments(q: { page?: number; perPage?: number; status?: string; gateway?: string }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.gateway) where.gateway = q.gateway;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { user: { select: { phone: true, fullName: true } } },
      }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id.toString(),
        uuid: p.uuid,
        userPhone: p.user.phone,
        userFullName: p.user.fullName,
        amountToman: toMajor(Number(p.amount)),
        gateway: p.gateway,
        status: p.status,
        referenceNumber: p.referenceNumber,
        paidAt: p.paidAt?.toISOString() ?? null,
        refundedAt: p.refundedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    };
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

  private async avgCompletionMs(operatorId: bigint): Promise<number | null> {
    const rows = await this.prisma.request.findMany({
      where: { assignedOperatorId: operatorId, status: 'completed', completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
      take: 200,
      orderBy: { completedAt: 'desc' },
    });
    if (rows.length === 0) return null;
    const sum = rows.reduce(
      (acc, r) => acc + (r.completedAt!.getTime() - r.createdAt.getTime()),
      0,
    );
    return sum / rows.length;
  }

  /** argon2id — same algorithm as the auth module. */
  private async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }
}
