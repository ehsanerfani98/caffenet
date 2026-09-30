/**
 * MailService (Phase 11.2.6) — email transport abstraction.
 *
 * Ships with a console driver (structured log output) so the queue pipeline
 * and preference plumbing are fully functional on every deployment profile;
 * SMTP/nodemailer can be added later as an additional driver behind the same
 * interface (MAIL_* env vars are already declared in env.validation.ts).
 */

import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private counter = 0;

  async send(message: MailMessage): Promise<MailSendResult> {
    // Console driver — deterministic, zero-dependency, shared-hosting safe
    this.logger.log(
      `EMAIL(console) → to=${message.to} subject="${message.subject}" html=${message.isHtml ? 'yes' : 'no'}\n${message.body}`,
    );
    this.counter += 1;
    return { success: true, messageId: `console-${Date.now()}-${this.counter}` };
  }
}
