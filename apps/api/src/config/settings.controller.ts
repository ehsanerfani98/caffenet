import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from './settings.service';

/**
 * Public settings (Phase 12 pre-req) — unauthenticated presentation config
 * consumed by the web app:
 *   - PWA manifest (name, theme color, icons) is generated from these values
 *   - pusher-js client resolves its PUBLIC key/cluster here (DB-managed)
 *   - web push availability flag
 * Secrets are never exposed.
 */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'تنظیمات عمومی (PWA / Pusher client / وضعیت وب‌پوش)' })
  async publicSettings() {
    return this.settings.getPublicSettings();
  }
}
