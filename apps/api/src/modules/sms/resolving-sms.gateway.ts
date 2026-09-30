import { Injectable, Logger } from '@nestjs/common';
import { SmsGateway, SmsSendResult } from './sms.interface';
import { IPanelSmsGateway } from './adapters/ipanel.sms.gateway';
import { ConsoleSmsGateway } from './adapters/console.sms.gateway';
import { SettingsService } from '../../config/settings.service';

/**
 * ResolvingSmsGateway — proxies to the driver selected in
 * Admin → Settings → SMS (`sms.provider`), falling back to the SMS_DRIVER
 * env var. Driver resolution happens PER CALL so admin changes apply
 * without restart. Unknown/unavailable drivers degrade to console logging
 * instead of crashing OTP flows.
 */
@Injectable()
export class ResolvingSmsGateway implements SmsGateway {
  private readonly logger = new Logger(ResolvingSmsGateway.name);
  readonly name = 'resolving';
  private ipanel: IPanelSmsGateway | null = null;
  private readonly console_ = new ConsoleSmsGateway();

  constructor(private readonly settings: SettingsService) {}

  private async resolve(): Promise<SmsGateway> {
    const cfg = await this.settings.getSmsConfig();
    switch (cfg.provider) {
      case 'ipanel':
        this.ipanel ??= new IPanelSmsGateway(this.settings);
        return this.ipanel;
      case 'kavenegar':
        // Kavenegar adapter is a documented follow-up — degrade to console
        this.logger.warn('sms.provider=kavenegar — adapter not implemented yet, using console');
        return this.console_;
      default:
        return this.console_;
    }
  }

  sendOtpPattern(
    phone: string,
    params: Record<string, string>,
    patternCode?: string,
  ): Promise<SmsSendResult> {
    return this.resolve().then((gw) => gw.sendOtpPattern(phone, params, patternCode));
  }

  sendSms(phone: string, message: string): Promise<SmsSendResult> {
    return this.resolve().then((gw) => gw.sendSms(phone, message));
  }
}
