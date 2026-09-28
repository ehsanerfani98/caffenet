import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'لیست نشست‌های فعال کاربر (دستگاه‌ها)' })
  async list(@CurrentUser() user: { id: string }) {
    const sessions = await this.sessions.listUserSessions(user.id);
    return { sessions };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'باطل کردن یک نشست با ID' })
  async revoke(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.sessions.revokeSession(user.id, id);
    return { message: 'نشست باطل شد' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'باطل کردن همه نشست‌ها جز فعلی' })
  async revokeAll(
    @CurrentUser() user: { id: string },
    @Body() body: { refreshToken: string },
  ) {
    const count = await this.sessions.revokeAllExceptCurrent(user.id, body.refreshToken);
    return { message: `${count} نشست دیگر باطل شد`, revokedCount: count };
  }

  @Post('cleanup-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'پاکسازی نشست‌های منقضی (worker)' })
  async cleanupExpired() {
    const count = await this.sessions.cleanupExpired();
    return { cleaned: count };
  }
}
