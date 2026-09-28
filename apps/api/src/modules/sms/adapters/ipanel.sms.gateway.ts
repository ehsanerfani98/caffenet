import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { SmsGateway, SmsSendResult } from '../sms.interface';

/**
 * iPanel SMS Gateway adapter.
 *
 * iPanel API docs: https://ippanel.com/docs/api-sdk
 *
 * Two endpoints used:
 *  - Pattern-based (preferred for OTP): https://ippanel.com/services/v2/send-pattern
 *    Uses pattern_code + parameters to send pre-approved messages.
 *  - Direct: https://ippanel.com/services/v2/send
 *    Sends raw text. Sender number from account.
 *
 * Authentication: api_key in request body.
 */
@Injectable()
export class IPanelSmsGateway implements SmsGateway, OnModuleInit {
  private readonly logger = new Logger(IPanelSmsGateway.name);
  readonly name = 'ipanel';
  private apiKey!: string;
  private sender!: string;
  private defaultOtpPatternCode?: string;
  private defaultOtpParamName: string;
  private http!: AxiosInstance;
  private readonly baseUrl = 'https://ippanel.com/services/v2';

  constructor(private readonly config: ConfigService) {
    this.defaultOtpParamName = this.config.get<string>('IPANEL_OTP_PARAM_NAME', 'code')!;
  }

  onModuleInit() {
    this.apiKey = this.config.get<string>('IPANEL_API_KEY', '')!;
    this.sender = this.config.get<string>('IPANEL_SENDER', '')!;
    this.defaultOtpPatternCode = this.config.get<string>('IPANEL_OTP_PATTERN_CODE');

    if (!this.apiKey) {
      this.logger.warn('⚠️ IPANEL_API_KEY missing — OTP SMS will fail. Set it in env.');
    }
    if (!this.defaultOtpPatternCode) {
      this.logger.warn('⚠️ IPANEL_OTP_PATTERN_CODE missing — OTP SMS will fail. Register a pattern at ippanel.com and set its code in env.');
    }

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Send OTP via pattern. Pattern must be pre-registered on iPanel dashboard.
   */
  async sendOtpPattern(
    phone: string,
    params: Record<string, string>,
    patternCode?: string,
  ): Promise<SmsSendResult> {
    const code = patternCode ?? this.defaultOtpPatternCode;
    if (!code) {
      return {
        success: false,
        error: 'No OTP pattern code configured. Set IPANEL_OTP_PATTERN_CODE in env.',
      };
    }
    if (!this.apiKey) {
      return { success: false, error: 'IPANEL_API_KEY not configured' };
    }

    const normalizedPhone = this.normalizePhone(phone);
    try {
      const response = await this.http.post('/send-pattern', {
        api_key: this.apiKey,
        pattern_code: code,
        from: this.sender,
        to: normalizedPhone,
        input: params,
      });

      const data = response.data;
      // iPanel response shapes vary; accept any 200 with a message_id
      if (response.status === 200 || data?.status === 200 || data?.code === 200) {
        const messageId =
          data?.data?.message_id ?? data?.message_id ?? data?.id ?? 'unknown';
        this.logger.log(
          `📱 OTP SMS sent to ${this.maskPhone(normalizedPhone)} via pattern ${code} (msgid: ${messageId})`,
        );
        return { success: true, messageId, rawResponse: data };
      }
      this.logger.error(`iPanel pattern send failed: ${JSON.stringify(data)}`);
      return {
        success: false,
        error: data?.error ?? data?.message ?? 'Unknown iPanel error',
        rawResponse: data,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`iPanel HTTP error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Send direct text message (no pattern).
   */
  async sendSms(phone: string, message: string): Promise<SmsSendResult> {
    if (!this.apiKey || !this.sender) {
      return { success: false, error: 'IPANEL_API_KEY or IPANEL_SENDER not configured' };
    }
    const normalizedPhone = this.normalizePhone(phone);
    try {
      const response = await this.http.post('/send', {
        api_key: this.apiKey,
        from: this.sender,
        to: normalizedPhone,
        message,
      });
      const data = response.data;
      if (response.status === 200 || data?.status === 200) {
        return {
          success: true,
          messageId: data?.data?.message_id ?? data?.id ?? 'unknown',
          rawResponse: data,
        };
      }
      return {
        success: false,
        error: data?.error ?? 'Unknown iPanel error',
        rawResponse: data,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`iPanel HTTP error: ${msg}`);
      return { success: false, error: msg };
    }
  }

  /**
   * Normalize Iranian phone numbers to international format (98...)
   * 09123456789 → 989123456789
   * +989123456789 → 989123456789
   */
  private normalizePhone(phone: string): string {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0098')) p = '98' + p.slice(4);
    if (p.startsWith('098')) p = '98' + p.slice(3);
    if (p.startsWith('0')) p = '98' + p.slice(1);
    if (!p.startsWith('98')) p = '98' + p;
    return p;
  }

  private maskPhone(phone: string): string {
    if (phone.length < 6) return '*'.repeat(phone.length);
    return `${phone.slice(0, 4)}${'*'.repeat(phone.length - 6)}${phone.slice(-2)}`;
  }
}
