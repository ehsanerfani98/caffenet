import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServiceFieldsService } from './service-fields.service';
import { DynamicFormValidator } from './dynamic-form-validator';
import { AdminServicesController } from './admin-services.controller';
import { PublicServicesController } from './public-services.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminServicesController, PublicServicesController],
  providers: [ServicesService, ServiceFieldsService, DynamicFormValidator],
  exports: [ServicesService, ServiceFieldsService, DynamicFormValidator],
})
export class ServicesModule {}
