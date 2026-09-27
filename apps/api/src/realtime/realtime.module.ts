import { Module, Global } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  providers: [PusherService, RealtimeService],
  exports: [PusherService, RealtimeService],
})
export class RealtimeModule {}
