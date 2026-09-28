/**
 * SMS Gateway interface — all SMS providers must implement this.
 *
 * Two adapters ship by default:
 *  - iPanelSmsGateway (default, Iranian provider — pattern-based OTP)
 *  - KavenegarSmsGateway (alternative Iranian provider — optional)
 *
 * Driver is selected via env: SMS_DRIVER=ipanel (default) | kavenegar
 */
export interface SmsGateway {
  /** Provider name */
  readonly name: string;

  /**
   * Send a pattern-based OTP message.
   * @param phone Iranian phone (09xxxxxxxxx or +989xxxxxxxxx)
   * @param params Pattern parameters (e.g., { code: '123456' })
   * @param patternCode Pattern code from provider dashboard (optional — defaults to env IPANEL_OTP_PATTERN_CODE)
   */
  sendOtpPattern(
    phone: string,
    params: Record<string, string>,
    patternCode?: string,
  ): Promise<SmsSendResult>;

  /**
   * Send a direct text message (no pattern).
   * Note: iPanel/Kavenegar require sender number from account config.
   */
  sendSms(phone: string, message: string): Promise<SmsSendResult>;
}

export interface SmsSendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Provider message ID (for tracking) */
  messageId?: string;
  /** Raw response from provider (for debugging) */
  rawResponse?: unknown;
  /** Error message if failed */
  error?: string;
}

export const SMS_GATEWAY_TOKEN = Symbol('SMS_GATEWAY_TOKEN');
