import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toMajor } from '../../common/utils/money';

/**
 * AdminDashboardService (Phase 9.2 / 9.10 / 8.2) — read-only analytics on top
 * of existing tables. All amounts are returned in Toman (major units) per the
 * API money convention; DB stores Rial (BigInt minor).
 */

export interface ReportRange {
  from: Date;
  to: Date;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // Admin dashboard (9.2.1 / 9.2.3)
  // ==========================================================================

  async getDashboard() {
    const todayStart = this.startOfToday();

    const [
      usersTotal,
      customers,
      operators,
      servicesTotal,
      categoriesTotal,
      requestCounts,
      revenueTodayAgg,
      walletTxToday,
      paymentsToday,
      unreadChats,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, roles: { some: { role: { name: 'customer' } } } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, roles: { some: { role: { name: 'operator' } } } },
      }),
      this.prisma.service.count(),
      this.prisma.category.count(),
      this.prisma.request.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.request.aggregate({
        _sum: { finalTotal: true },
        where: { status: { in: ['paid', 'completed'] }, updatedAt: { gte: todayStart } },
      }),
      this.prisma.walletTransaction.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.payment.count({ where: { createdAt: { gte: todayStart } } }),
      // Rooms with at least one unread customer message (chat lands Phase 10; safe today)
      this.prisma.chatRoom.count({
        where: { messages: { some: { readAt: null, deletedAt: null } } },
      }),
      this.auditFeed(10),
    ]);

    const byStatus: Record<string, number> = {};
    for (const g of requestCounts) byStatus[g.status] = g._count._all;
    const active =
      (byStatus['reviewing'] ?? 0) +
      (byStatus['waiting_for_customer'] ?? 0) +
      (byStatus['in_progress'] ?? 0) +
      (byStatus['waiting_for_payment'] ?? 0);

    return {
      kpis: {
        requestsNew: byStatus['pending'] ?? 0,
        requestsActive: active,
        requestsCompleted: byStatus['completed'] ?? 0,
        requestsCancelled: (byStatus['cancelled'] ?? 0) + (byStatus['rejected'] ?? 0),
        byStatus,
        revenueTodayToman: toMajor(Number(revenueTodayAgg._sum.finalTotal ?? 0n)),
        walletTransactionsToday: walletTxToday,
        paymentsToday,
        usersTotal,
        customers,
        operators,
        servicesTotal,
        categoriesTotal,
        unreadChats,
      },
      recentActivity,
    };
  }

  /** Last audit entries as the "recent activity" feed (admin + operator). */
  async auditFeed(limit: number) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      include: { user: { select: { fullName: true, phone: true } } },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      actorName: r.user?.fullName ?? r.user?.phone ?? 'سیستم',
      createdAt: r.createdAt.toISOString(),
      metadata: r.metadata ?? undefined,
    }));
  }

  // ==========================================================================
  // Reports (9.10) — trend + per-domain aggregates
  // ==========================================================================

  /** Revenue trend buckets for charts (9.2.2): day | month granularity. */
  async revenueTrend(range: ReportRange, granularity: 'day' | 'month') {
    const rows = await this.prisma.request.findMany({
      where: {
        status: { in: ['paid', 'completed'] },
        updatedAt: { gte: range.from, lte: range.to },
      },
      select: { finalTotal: true, updatedAt: true },
    });
    const buckets = new Map<string, number>();
    for (const r of rows) {
      const key =
        granularity === 'day'
          ? r.updatedAt.toISOString().slice(0, 10)
          : r.updatedAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + toMajor(Number(r.finalTotal)));
    }
    const series = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, revenueToman]) => ({ bucket, revenueToman }));
    return { granularity, series };
  }

  /** Requests grouped by status over a range (9.2.2 chart 2). */
  async requestsByStatus(range: ReportRange) {
    const groups = await this.prisma.request.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { createdAt: { gte: range.from, lte: range.to } },
    });
    return groups.map((g) => ({ status: g.status, count: g._count._all }));
  }

  /** Top services by revenue + count (9.2.2 chart 3 / 9.10.2). */
  async topServices(range: ReportRange, limit = 10) {
    const rows = await this.prisma.request.groupBy({
      by: ['serviceId'],
      _count: { _all: true },
      _sum: { finalTotal: true },
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { _sum: { finalTotal: 'desc' } },
      take: limit,
    });
    const services = await this.prisma.service.findMany({
      where: { id: { in: rows.map((r) => r.serviceId) } },
      select: { id: true, name: true, slug: true },
    });
    const nameOf = new Map(services.map((s) => [s.id, s.name]));
    return rows.map((r) => ({
      serviceId: r.serviceId.toString(),
      serviceName: nameOf.get(r.serviceId) ?? '—',
      requests: r._count._all,
      revenueToman: toMajor(Number(r._sum.finalTotal ?? 0n)),
    }));
  }

  /** Payment success rate over a range (9.2.2 chart 4 / 9.10.4). */
  async paymentStats(range: ReportRange) {
    const groups = await this.prisma.payment.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { createdAt: { gte: range.from, lte: range.to } },
    });
    const byStatus: Record<string, number> = {};
    for (const g of groups) byStatus[g.status] = g._count._all;
    const ok = byStatus['successful'] ?? 0;
    const fail = (byStatus['failed'] ?? 0) + (byStatus['cancelled'] ?? 0);
    const total = ok + fail;
    return { byStatus, successRate: total > 0 ? Math.round((ok / total) * 100) : null, total };
  }

  /** Financial report rows (9.10.1) — revenue, discounts, refunds per period. */
  async financialReport(range: ReportRange) {
    const [revenueAgg, discountAgg, refundAgg] = await Promise.all([
      this.prisma.request.aggregate({
        _sum: { finalTotal: true, laborFeeSnapshot: true },
        _count: { _all: true },
        where: {
          status: { in: ['paid', 'completed'] },
          updatedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.discountUsage.aggregate({
        _sum: { amountSaved: true },
        _count: { _all: true },
        where: { appliedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { type: 'refund', createdAt: { gte: range.from, lte: range.to } },
      }),
    ]);
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      revenueToman: toMajor(Number(revenueAgg._sum.finalTotal ?? 0n)),
      laborToman: toMajor(Number(revenueAgg._sum.laborFeeSnapshot ?? 0n)),
      paidRequests: revenueAgg._count._all,
      discountsToman: toMajor(Number(discountAgg._sum.amountSaved ?? 0n)),
      discountsCount: discountAgg._count._all,
      refundsToman: toMajor(Number(-(refundAgg._sum.amount ?? 0n))),
      refundsCount: refundAgg._count._all,
    };
  }

  /** Service report (9.10.2) — count per service + avg duration minutes. */
  async serviceReport(range: ReportRange) {
    const rows = await this.prisma.request.groupBy({
      by: ['serviceId'],
      _count: { _all: true },
      _avg: { estimatedDurationMin: true },
      _sum: { finalTotal: true },
      where: { createdAt: { gte: range.from, lte: range.to } },
      orderBy: { _count: { serviceId: 'desc' } },
    });
    const services = await this.prisma.service.findMany({
      where: { id: { in: rows.map((r) => r.serviceId) } },
      select: { id: true, name: true, category: { select: { name: true } } },
    });
    const meta = new Map(services.map((s) => [s.id, s]));
    return rows.map((r) => ({
      serviceId: r.serviceId.toString(),
      serviceName: meta.get(r.serviceId)?.name ?? '—',
      categoryName: meta.get(r.serviceId)?.category?.name ?? '—',
      requests: r._count._all,
      avgDurationMin: r._avg.estimatedDurationMin ? Math.round(r._avg.estimatedDurationMin) : null,
      revenueToman: toMajor(Number(r._sum.finalTotal ?? 0n)),
    }));
  }

  /** Wallet transaction report (9.10.3). */
  async walletReport(range: ReportRange) {
    const groups = await this.prisma.walletTransaction.groupBy({
      by: ['type'],
      _count: { _all: true },
      _sum: { amount: true },
      where: { createdAt: { gte: range.from, lte: range.to } },
    });
    return groups.map((g) => ({
      type: g.type,
      count: g._count._all,
      netToman: toMajor(Number(g._sum.amount ?? 0n)),
    }));
  }

  // ==========================================================================
  // Shared helpers
  // ==========================================================================

  startOfToday(): Date {
    const now = new Date();
    // Business timezone is Asia/Tehran (UTC+3:30)
    const tehranNow = new Date(now.getTime() + 3.5 * 3600_000);
    const start = Date.UTC(
      tehranNow.getUTCFullYear(),
      tehranNow.getUTCMonth(),
      tehranNow.getUTCDate(),
    );
    return new Date(start - 3.5 * 3600_000);
  }

  resolveRange(from?: string, to?: string): ReportRange {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86400_000);
    return { from: fromDate, to: toDate };
  }
}
