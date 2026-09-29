import { BadRequestException } from '@nestjs/common';
import { REQUEST_STATUS_TRANSITIONS } from '@caffenet/shared';

/**
 * Request status state machine (Phase 4.2).
 *
 * The SINGLE SOURCE OF TRUTH for allowed transitions is
 * REQUEST_STATUS_TRANSITIONS in @caffenet/shared (so the web app can reuse it
 * for UX gating). This service adds server-side enforcement + Persian errors.
 *
 * Flow (happy path):
 *   pending → reviewing → in_progress → waiting_for_payment → paid → completed
 *
 * Side branches:
 *   - waiting_for_customer: operator needs info from the customer
 *   - rejected: request refused (from any active status)
 *   - cancelled: customer or admin cancels (customer only in CANCEL_ALLOWED_STATUSES)
 */
export class RequestStatusMachine {
  /** Check whether a transition is allowed — pure, no side effects. */
  static canTransition(from: string, to: string): boolean {
    return (REQUEST_STATUS_TRANSITIONS[from] ?? []).includes(to);
  }

  /** Return allowed next statuses (for UI hints / API docs). */
  static nextStatuses(from: string): readonly string[] {
    return REQUEST_STATUS_TRANSITIONS[from] ?? [];
  }

  /** Whether the status is terminal (no further transitions). */
  static isTerminal(status: string): boolean {
    return (REQUEST_STATUS_TRANSITIONS[status] ?? []).length === 0;
  }

  /**
   * Enforce a transition — throws 400 INVALID_STATUS_TRANSITION if not allowed.
   */
  static enforce(from: string, to: string): void {
    if (from === to) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `درخواست هم‌اکنون در وضعیت «${to}» است`,
      });
    }
    if (!RequestStatusMachine.canTransition(from, to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `گذار از وضعیت «${RequestStatusMachine.faLabel(from)}» به «${RequestStatusMachine.faLabel(to)}» مجاز نیست`,
        details: {
          from,
          to,
          allowed: REQUEST_STATUS_TRANSITIONS[from] ?? [],
        },
      });
    }
  }

  /** Persian labels for statuses (used in errors, timeline, notifications). */
  static faLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'در انتظار بررسی';
      case 'reviewing':
        return 'در حال بررسی';
      case 'waiting_for_customer':
        return 'در انتظار پاسخ مشتری';
      case 'in_progress':
        return 'در حال انجام';
      case 'waiting_for_payment':
        return 'در انتظار پرداخت';
      case 'paid':
        return 'پرداخت شده';
      case 'completed':
        return 'تکمیل شده';
      case 'cancelled':
        return 'لغو شده';
      case 'rejected':
        return 'رد شده';
      default:
        return status;
    }
  }
}
