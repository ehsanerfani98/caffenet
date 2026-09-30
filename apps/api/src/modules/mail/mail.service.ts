/**
 * MailService (Phase 11.2.6 / Phase 12 pre-req) — email transport abstraction.
 *
 * Drivers:
 *  - console (default): structured log output — zero-dependency, shared-hosting
 *    safe, always available.
 *  - smtp: real delivery via nodemailer. Credentials come from DATABASE
 *    settings (Admin → Settings → Mail) with MAIL_* env fallback — the
 *    transporter is rebuilt automatically when the admin changes config.
 *
 * Config resolution happens at SEND time so changes apply without restart.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SettingsService } from '../../config/settings.service';

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
  private transporter: Transporter | null = null;
  private transporterFingerprint = '';

  constructor(private readonly settings: SettingsService) {}

  /** Build/reuse the SMTP transporter for the current DB settings. */
  private async resolveTransporter(): Promise<Transporter | null> {
    const cfg = await this.settings.getMailConfig();
    if (!cfg.enabled || cfg.driver !== 'smtp' || !cfg.host) {
      return null;
    }

    const fingerprint = `${cfg.host}|${cfg.port}|${cfg.user}|${cfg.pass}|${cfg.from}`;
    if (this.transporter && this.transporterFingerprint === fingerprint) {
      return this.transporter;
    }

    try {
      this.transporter?.close();
    } catch {
      // ignore close errors on replaced transporters
    }
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    this.transporterFingerprint = fingerprint;
    this.logger.log(`SMTP transporter ready → ${cfg.host}:${cfg.port}`);
    return this.transporter;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const cfg = await this.settings.getMailConfig();
    const transporter = await this.resolveTransporter();

    if (!cfg.enabled) {
      this.logger.debug(
        `EMAIL skipped — mail disabled in settings (to=${message.to} subject="${message.subject}")`,
      );
      return { success: false, error: 'mail disabled in settings' };
    }

    if (!transporter) {
      // Console driver — deterministic, zero-dependency, shared-hosting safe
      this.logger.log(
        `EMAIL(console) → to=${message.to} subject="${message.subject}" html=${message.isHtml ? 'yes' : 'no'}\n${message.body}`,
      );
      this.counter += 1;
      return { success: true, messageId: `console-${Date.now()}-${this.counter}` };
    }

    try {
      const info = await transporter.sendMail({
        from: cfg.from,
        to: message.to,
        subject: message.subject,
        [message.isHtml ? 'html' : 'text']: message.body,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed → to=${message.to}: ${error}`);
      return { success: false, error };
    }
  }
}
