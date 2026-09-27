import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { DeploymentProfileService } from '../../config/deployment-profile.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: DeploymentProfileService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check (lightweight, public)' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      profile: this.profile.profile,
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check — verifies DB connection' })
  async ready() {
    try {
      // Simple DB ping
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        database: 'up',
      };
    } catch (err) {
      return {
        status: 'unready',
        timestamp: new Date().toISOString(),
        database: 'down',
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
