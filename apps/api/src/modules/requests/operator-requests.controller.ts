import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  RequestQueryDto,
  UnassignRequestDto,
  UpdateRequestStatusDto,
} from './dto/request.dto';

/**
 * Operator workspace endpoints (Phase 4.2, 4.3).
 *  - Status transitions via the server-side state machine
 *  - Self-assign / unassign; scope=mine by default for listing
 *  - Admin passes through this controller too (superset powers)
 */
@ApiTags('operator/requests')
@Controller('operator/requests')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('operator', 'admin')
@Permissions('requests.view')
export class OperatorRequestsController {
  constructor(
    private readonly requests: RequestsService,
    private readonly workflow: RequestWorkflowService,
    private readonly assignments: RequestAssignmentService,
    private readonly history: RequestHistoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'لیست درخواست‌ها (اپراتور: mine=تخصیص‌یافته به من، all=همه)' })
  async list(
    @Query() query: RequestQueryDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.requests.list(query, { id: user.id, roles: user.roles });
  }

  @Get(':id')
  @ApiOperation({ summary: 'جزئیات درخواست (اپراتور: تخصیص‌یافته / ادمین: همه)' })
  async findById(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.requests.findById(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'تاریخچه وضعیت‌ها (اپراتور)' })
  async getHistory(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getHistory(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'تایم‌لاین درخواست (اپراتور)' })
  async getTimeline(@Param('id') id: string, @CurrentUser() user: { id: string; roles: string[] }) {
    return this.history.getTimeline(id, { id: user.id, roles: user.roles });
  }

  @Get(':id/allowed-transitions')
  @ApiOperation({ summary: 'وضعیت‌های مجاز بعدی برای این درخواست (راهنمای UI)' })
  async allowedTransitions(@Param('id') id: string) {
    return this.workflow.allowedTransitions(id);
  }

  @Patch(':id/status')
  @Permissions('requests.update')
  @ApiOperation({ summary: 'تغییر وضعیت درخواست (ماشین وضعیت سمت سرور)' })
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.workflow.changeStatus(id, dto, user.id, user.roles);
  }

  @Post(':id/assign')
  @Permissions('requests.assign')
  @ApiOperation({ summary: 'تخصیص درخواست (اپراتور: فقط خودش / ادمین: هر کس)' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.assignments.assign(id, dto, user.id, user.roles);
  }

  @Post(':id/unassign')
  @Permissions('requests.assign')
  @ApiOperation({ summary: 'رفع تخصیص اپراتور از درخواست' })
  async unassign(
    @Param('id') id: string,
    @Body() dto: UnassignRequestDto,
    @CurrentUser() user: { id: string; roles: string[] },
  ) {
    return this.assignments.unassign(id, dto.note, user.id);
  }

  @Post(':id/auto-assign')
  @Permissions('requests.assign')
  @ApiOperation({ summary: 'تخصیص خودکار (round_robin یا least_load)' })
  async autoAssign(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: string[] },
    @Body('strategy') strategy?: 'round_robin' | 'least_load',
  ) {
    return this.assignments.autoAssign(id, strategy ?? 'round_robin', user.id);
  }
}
