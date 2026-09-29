import { Logger } from '@nestjs/common';
import { SmsGateway, SmsSendResult } from '../sms.interface';

/**
 * ConsoleSmsGateway — development/testing driver.
 *
 * Logs every SMS to the console instead of calling a provider.
 * Enable with SMS_DRIVER=console. Useful for local development and
 * E2E tests where real SMS delivery is neither possible nor desired.
 */
export class ConsoleSmsGateway implements SmsGateway {
  readonly name = 'console';
  private readonly logger = new Logger('SMS(console)');

  async sendOtpPattern(
    phone: string,
    params: Record<string, string>,
    _patternCode?: string,
  ): Promise<SmsSendResult> {
    const code = params.code ?? JSON.stringify(params);
    this.logger.log(`📱 OTP for ${phone}: ${code}`);
    return { success: true, messageId: `console-${Date.now()}` };
  }

  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    this.logger.log(`📱 SMS to ${phone}: ${message}`);
    return { success: true, messageId: `console-${Date.now()}` };
  }
}
