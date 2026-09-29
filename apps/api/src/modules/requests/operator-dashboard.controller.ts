import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { toMajor } from '../../common/utils/money';
import { RequestAssignmentService } from './request-assignment.service';

/**
 * Phase 8 — Operator dashboard endpoints (8.2, 8.5).
 * Route prefix `operator` matches operator-requests.controller.ts; guards are
 * identical (@Roles operator+admin, requests.view class permission).
 */

@ApiTags('operator/dashboard')
@Controller('operator')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('operator', 'admin')
export class OperatorDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: RequestAssignmentService,
  ) {}

  /** 8.2.1 KPI cards + 8.2.3 recent activity + 8.2.4 unread chats. */
  @Get('dashboard')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'داشبورد اپراتور: KPI ها، فعالیت اخیر، چت‌های خوانده‌نشده' })
  async dashboard(@CurrentUser() user: { id: string }) {
    const operatorId = BigInt(user.id);
    const todayStart = this.startOfToday();

    const [
      queueCounts,
      myAssigned,
      myActive,
      completedToday,
      paidTodayAgg,
      unreadChats,
      recentActivity,
    ] = await Promise.all([
      // Queue: unassigned requests in actionable statuses
      this.prisma.request.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: {
          assignedOperatorId: null,
          status: { in: ['pending', 'reviewing', 'waiting_for_customer'] },
        },
      }),
      // 8.1.2 — assigned count for the top bar
      this.prisma.requestAssignment.count({ where: { operatorId, active: true } }),
      this.prisma.request.count({
        where: {
          assignedOperatorId: operatorId,
          status: { in: ['in_progress', 'waiting_for_customer', 'waiting_for_payment'] },
        },
      }),
      this.prisma.request.count({
        where: {
          assignedOperatorId: operatorId,
          status: 'completed',
          completedAt: { gte: todayStart },
        },
      }),
      this.prisma.request.aggregate({
        _sum: { finalTotal: true },
        where: {
          assignedOperatorId: operatorId,
          status: { in: ['paid', 'completed'] },
          updatedAt: { gte: todayStart },
        },
      }),
      // Chat lands in Phase 10 — safe aggregate over existing tables
      this.prisma.chatRoom
        .count({
          where: {
            participants: { some: { userId: operatorId } },
            messages: { some: { readAt: null, deletedAt: null, senderId: { not: operatorId } } },
          },
        })
        .catch(() => 0),
      // Last requests I handled (assignment history) as the activity feed
      this.prisma.requestAssignment.findMany({
        where: { operatorId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          request: {
            select: {
              id: true,
              uuid: true,
              trackingCode: true,
              status: true,
              createdAt: true,
              service: { select: { name: true } },
              customer: { select: { fullName: true, phone: true } },
            },
          },
        },
      }),
    ]);

    const queue: Record<string, number> = {};
    for (const g of queueCounts) queue[g.status] = g._count._all;

    return {
      kpis: {
        queue: {
          pending: queue['pending'] ?? 0,
          reviewing: queue['reviewing'] ?? 0,
          waitingForCustomer: queue['waiting_for_customer'] ?? 0,
        },
        assignedToMe: myAssigned,
        myActiveRequests: myActive,
        completedToday,
        revenueTodayToman: toMajor(Number(paidTodayAgg._sum.finalTotal ?? 0n)),
        unreadChats,
      },
      recentActivity: recentActivity.map((a) => ({
        id: a.id.toString(),
        requestId: a.request.id.toString(),
        requestUuid: a.request.uuid,
        trackingCode: a.request.trackingCode,
        serviceName: a.request.service.name,
        customerName: a.request.customer?.fullName ?? a.request.customer?.phone ?? '—',
        status: a.request.status,
        note: a.note,
        active: a.active,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /** 8.2.2 — take next from queue: oldest unassigned pending → self-assign. */
  @Post('queue/take-next')
  @Permissions('requests.assign')
  @ApiOperation({
    summary: 'برداشتن درخواست بعدی از صف (خودکار: قدیمی‌ترین بدون اپراتور → انتساب به من)',
  })
  async takeNext(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return this.assignment.takeNextForOperator(user.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** 8.5.1 / 8.5.2 — personal activity + stats. */
  @Get('activity')
  @Permissions('requests.view')
  @ApiOperation({ summary: 'سابقه فعالیت من + آمار (تعداد رسیدگی، میانگین زمان تکمیل)' })
  async activity(@CurrentUser() user: { id: string }) {
    const operatorId = BigInt(user.id);

    const [handled, completed, avgMs, recent] = await Promise.all([
      this.prisma.requestAssignment.count({ where: { operatorId } }),
      this.prisma.request.count({ where: { assignedOperatorId: operatorId, status: 'completed' } }),
      this.avgCompletionMs(operatorId),
      this.prisma.requestAssignment.findMany({
        where: { operatorId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          request: {
            select: {
              id: true,
              trackingCode: true,
              status: true,
              createdAt: true,
              completedAt: true,
              service: { select: { name: true } },
              customer: { select: { fullName: true, phone: true } },
            },
          },
        },
      }),
    ]);

    return {
      stats: {
        totalHandled: handled,
        completedTotal: completed,
        avgCompletionHours: avgMs === null ? null : Math.round((avgMs / 3600_000) * 10) / 10,
      },
      items: recent.map((a) => ({
        id: a.id.toString(),
        requestId: a.request.id.toString(),
        trackingCode: a.request.trackingCode,
        serviceName: a.request.service.name,
        customerName: a.request.customer?.fullName ?? a.request.customer?.phone ?? '—',
        status: a.request.status,
        note: a.note,
        active: a.active,
        assignedAt: a.createdAt.toISOString(),
        unassignedAt: a.unassignedAt?.toISOString() ?? null,
        completedAt: a.request.completedAt?.toISOString() ?? null,
      })),
    };
  }

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

  private startOfToday(): Date {
    const now = new Date();
    const tehranNow = new Date(now.getTime() + 3.5 * 3600_000);
    const start = Date.UTC(
      tehranNow.getUTCFullYear(),
      tehranNow.getUTCMonth(),
      tehranNow.getUTCDate(),
    );
    return new Date(start - 3.5 * 3600_000);
  }
}
