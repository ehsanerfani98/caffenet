import { Module, Global } from '@nestjs/common';
import { SMS_GATEWAY_TOKEN } from './sms.interface';
import { ResolvingSmsGateway } from './resolving-sms.gateway';

/**
 * SMS module — exposes a single SmsGateway provider.
 *
 * Driver is selected per call via DB settings (Admin → Settings → SMS,
 * key `sms.provider`), falling back to the SMS_DRIVER env var.
 * To add a new provider (e.g. Kavenegar), create an adapter in ./adapters/
 * and wire it into ResolvingSmsGateway.resolve().
 */
@Global()
@Module({
  providers: [{ provide: SMS_GATEWAY_TOKEN, useClass: ResolvingSmsGateway }],
  exports: [SMS_GATEWAY_TOKEN],
})
export class SmsModule {}
