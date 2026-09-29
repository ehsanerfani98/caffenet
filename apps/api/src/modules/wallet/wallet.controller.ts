import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { WalletTransactionType } from '@caffenet/shared';

class ListTransactionsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn([
    'deposit',
    'withdrawal',
    'service_payment',
    'refund',
    'discount',
    'bonus',
    'manual_adjustment',
    'payment_reversal',
  ])
  type?: WalletTransactionType;
}

class AdminAdjustWalletDto {
  @ApiProperty({ description: 'مبلغ تعدیل (تومان) — منفی برای برداشت', example: 500000 })
  @Type(() => Number)
  @IsInt()
  @Min(-100_000_000)
  @Max(100_000_000)
  /** Toman (major) — negative for debit */
  amountToman!: number;

  @ApiProperty({ description: 'دلیل تعدیل' })
  @IsString()
  @Length(3, 500)
  reason!: string;
}

/**
 * Wallet endpoints (Phase 6.1.3 / 6.1.4).
 * Customers see their own wallet; admins may view anyone's via :userId param.
 */
@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('customer', 'operator', 'admin')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'کیف پول من' })
  @Permissions('wallet.view')
  async myWallet(@CurrentUser() user: { id: string; roles: string[] }) {
    const isAdmin = user.roles.includes('admin');
    return this.wallet.getWalletForUser(user.id, user.id, isAdmin);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'تراکنش‌های کیف پول (صفحه‌بندی‌شده)' })
  @Permissions('wallet.view')
  async myTransactions(
    @CurrentUser() user: { id: string; roles: string[] },
    @Query() q: ListTransactionsQueryDto,
  ) {
    const isAdmin = user.roles.includes('admin');
    return this.wallet.listTransactions(user.id, user.id, isAdmin, q.page, q.limit, q.type);
  }

  @Get('users/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'کیف پول یک کاربر (مدیر)' })
  @Permissions('wallet.view.all')
  async userWallet(@Param('userId') userId: string) {
    return this.wallet.getWalletForUser(userId, '', true);
  }

  @Post('users/:userId/adjust')
  @Roles('admin')
  @ApiOperation({ summary: 'تعدیل دستی موجودی (مدیر)' })
  @Permissions('wallet.adjust')
  async adjust(
    @Param('userId') userId: string,
    @Body() dto: AdminAdjustWalletDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.wallet.manualAdjustment({
      userId,
      amountToman: dto.amountToman,
      adminUserId: user.id,
      reason: dto.reason,
    });
    return this.wallet.toTransactionDto(result);
  }
}
