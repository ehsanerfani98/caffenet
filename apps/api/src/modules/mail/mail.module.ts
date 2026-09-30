import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Mail module (Phase 11.2.6) — email transport provider.
 * Console driver for now; SMTP adapter can replace it behind MailService.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
