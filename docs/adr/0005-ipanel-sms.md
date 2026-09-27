# ADR-0005: iPanel SMS with Pattern-Based OTP

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

The system requires SMS-based OTP for authentication (register, login, forgot password). The stakeholder selected **iPanel** (https://ippanel.com) as the SMS provider. iPanel supports two modes:

1. **Pattern-based**: Pre-defined message template with parameters. More reliable, less likely to be flagged as spam. Sender ID required. **Preferred for OTP.**
2. **Direct text**: Send arbitrary text. More flexible but more likely to be filtered.

## Decision

Use **iPanel pattern-based SMS** for OTP, with a fallback to direct text for non-OTP messages.

### Configuration

Environment variables:
```
IPANEL_API_KEY=...
IPANEL_SENDER=...
IPANEL_OTP_PATTERN_CODE=...   # Pattern ID from iPanel dashboard
IPANEL_OTP_PARAM_NAME=code    # Parameter name in the pattern (e.g., "{code}")
```

### SmsGateway Interface

```ts
interface SmsGateway {
  sendOtp(phone: string, code: string): Promise<{ messageId: string }>;
  sendSms(phone: string, message: string): Promise<{ messageId: string }>;
  sendPattern(phone: string, patternCode: string, params: Record<string, string>): Promise<{ messageId: string }>;
}
```

Two adapters:
- `iPanelSmsGateway` (default, configured by env)
- `KavenegarSmsGateway` (optional, for future flexibility)

### OTP Generation

- 6-digit numeric code
- Generated using `crypto.randomBytes(4)` (cryptographically secure)
- Stored hashed (bcrypt) in `otps` table — never plaintext
- 2-minute TTL
- Max 5 attempts
- Single-use (consumed_at field)

### Anti-Abuse

- Rate limit: max 3 OTPs/hour per phone, max 5/day
- Attempt limit: 5 wrong tries → account lockout 15 min
- Resend cooldown: 30 seconds between resends

## Consequences

### Positive
- ✅ Pattern-based OTP more reliable than direct text
- ✅ iPanel supports Iranian phone numbers natively
- ✅ Pluggable architecture allows switching providers
- ✅ OTP never stored in plaintext
- ✅ Anti-abuse protections prevent brute force

### Negative
- ⚠️ Pattern must be pre-registered on iPanel dashboard
- ⚠️ If pattern is rejected/modified, OTP SMS will fail
- ⚠️ iPanel API key is a secret — must be kept in env, never in code

### Mitigations
- Document pattern registration in deployment guide
- Add health check for SMS provider (test pattern on startup in dev)
- Provide email OTP fallback for users without SMS access
- Monitor SMS delivery rate via iPanel dashboard

## References

- TASKS.md Phase 2.3: OTP & Anti-Abuse
- iPanel API documentation: https://ippanel.com
