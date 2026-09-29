import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLog } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestsService } from './requests.service';
import { RequestWorkflowService } from './request-workflow.service';
import { RequestAssignmentService } from './request-assignment.service';
import { RequestHistoryService } from './request-history.service';
import {
  AssignRequestDto,
  CancelRequestDto,
  RequestQueryDto,
  UpdateRequestStatusDto,
} from './dto/request.dto';
import { AuditAction } from '@caffenet/shared';

/**
 * Admin endpoints (Phase 4).
 *  - 4.3.2 force-assign any operator to any request
 *  - Full visibility over all requests + status changes + cancellation
 */
@ApiTags('admin/requests')
@Controller('admin/requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions('requests.view')
export class AdminRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly workflow: RequestWorkflowService,
    private readonly assignments: RequestAssignmentService,
    private readonly history: RequestHistoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'لیست همه درخواست‌ها (ادمین)' })
  async list(
    @Query() query: RequestQueryDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.list(query, { id: user.id, roles: user.roles });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات هر درخواست (ادمین)' })
  async findById(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.requests.findById(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'تاریخچه وضعیت‌ها (ادمین)' })
  async getHistory(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getHistory(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'تایم‌لاین درخواست (ادمین)' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getTimeline(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'تاریخچه تخصیص‌های درخواست (ادمین)' })
  async getAssignments(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.history.getAssignments(id, { id: user.id, roles: user.roles });
  }

  @Patch(':id/status')
  @Permissions('requests.update')
  @UseInterceptors(AuditInterceptor)
  @AuditLog({ action: AuditAction.STATUS_CHANGE, entity: 'request' })
  @ApiOperation({ summary: 'تغییر وضعیت (ادمین — شامل paid)' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.workflow.changeStatus(id, dto, user.id, user.roles);
  }

  @Post(':id/assign')
  @Permissions('requests.assign')
  @UseInterceptors(AuditInterceptor)
  @AuditLog({ action: AuditAction.ASSIGN, entity: 'request' })
  @ApiOperation({ summary: 'تخصیص اجباری اپراتور (ادمین) — بدون operatorId = auto-assign' })
  async forceAssign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.assignments.forceAssign(id, dto, user.id);
  }

  @Post(':id/unassign')
  @Permissions('requests.assign')
  @ApiOperation({ summary: 'رفع تخصیص (ادمین)' })
  async unassign(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
    @Body('note') note?: string,
  ) {
    return this.assignments.unassign(id, note, user.id);
  }

  @Patch(':id/cancel')
  @Permissions('requests.cancel')
  @ApiOperation({ summary: 'لغو هر درخواست (ادمین)' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.cancel(id, dto, { id: user.id, roles: user.roles });
  }
}
