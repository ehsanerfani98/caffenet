import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WalletService } from './wallet.service';

/**
 * WalletEventListener (Phase 6.1.2) — auto-provision a wallet for every
 * user as soon as they first authenticate.
 *
 * Decoupled from AuthModule via the event bus: AuthService emits
 * 'auth.login.success' on every successful OTP/password login, and this
 * listener ensures the wallet row exists. getOrCreateWallet() is idempotent
 * and race-safe, so firing it repeatedly is harmless.
 */
@Injectable()
export class WalletEventListener implements OnModuleInit {
  private readonly logger = new Logger(WalletEventListener.name);

  constructor(private readonly wallet: WalletService) {}

  onModuleInit() {
    this.logger.log('WalletEventListener registered — wallets auto-provisioned on first login');
  }

  @OnEvent('auth.login.success')
  async handleLoginSuccess(payload: { userId?: string; userUuid?: string }) {
    if (!payload?.userId) return;
    try {
      await this.wallet.getOrCreateWallet(payload.userId);
    } catch (e) {
      // Never break the login flow — wallet is provisioned lazily on next access
      this.logger.error(
        `Failed to provision wallet for user ${payload.userId}: ${(e as Error).message}`,
      );
    }
  }
}
