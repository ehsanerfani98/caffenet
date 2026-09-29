import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_GATEWAY_TOKEN } from './sms.interface';
import { IPanelSmsGateway } from './adapters/ipanel.sms.gateway';
import { ConsoleSmsGateway } from './adapters/console.sms.gateway';

/**
 * SMS module — exposes a single SmsGateway provider.
 *
 * Driver is selected via env var SMS_DRIVER (default: 'ipanel').
 * To add a new provider (e.g. Kavenegar), create an adapter in ./adapters/
 * and add a case to the useFactory below.
 */
@Global()
@Module({
  providers: [
    {
      provide: SMS_GATEWAY_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('SMS_DRIVER', 'ipanel')!;
        switch (driver) {
          case 'ipanel':
            return new IPanelSmsGateway(config);
          case 'console':
            return new ConsoleSmsGateway();
          // case 'kavenegar': return new KavenegarSmsGateway(config);
          default:
            throw new Error(`Unknown SMS driver: ${driver}`);
        }
      },
    },
  ],
  exports: [SMS_GATEWAY_TOKEN],
})
export class SmsModule {}
