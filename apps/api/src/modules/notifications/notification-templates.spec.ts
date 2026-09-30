import { describe, expect, it } from 'vitest';
import { NotificationType } from '@caffenet/shared';
import { renderNotification, SMS_CRITICAL_TYPES } from './notification-templates';

describe('renderNotification (Phase 11.2.2)', () => {
  it('renders request_created for operators', () => {
    const r = renderNotification(NotificationType.REQUEST_CREATED, {
      requestId: '12',
      trackingCode: 'REQ-8f3k',
      serviceName: 'طراحی لوگو',
    });
    expect(r.title).toContain('درخواست جدید');
    expect(r.body).toContain('REQ-8f3k');
    expect(r.body).toContain('طراحی لوگو');
    expect(r.link).toBe('/requests/12');
  });

  it('renders request_assigned with operator name', () => {
    const r = renderNotification(NotificationType.REQUEST_ASSIGNED, {
      requestId: '9',
      trackingCode: 'TRK1',
      operatorName: 'علی رضایی',
    });
    expect(r.title).toContain('اپراتور');
    expect(r.body).toContain('علی رضایی');
  });

  it('renders status change with fa label', () => {
    const r = renderNotification(NotificationType.REQUEST_STATUS_CHANGED, {
      requestId: '1',
      trackingCode: 'T1',
      status: 'in_progress',
      statusFa: 'در حال انجام',
    });
    expect(r.body).toContain('در حال انجام');
  });

  it('formats amounts with separators in price change', () => {
    const r = renderNotification(NotificationType.REQUEST_PRICE_CHANGED, {
      requestId: '3',
      trackingCode: 'T3',
      previousTotal: 100000,
      newTotal: 2500000,
    });
    expect(r.body).toContain('2,500,000');
    expect(r.body).toContain('100,000');
  });

  it('renders wallet charged with new balance', () => {
    const r = renderNotification(NotificationType.WALLET_CHARGED, {
      amount: 500000,
      balance: 750000,
    });
    expect(r.title).toContain('شارژ');
    expect(r.body).toContain('500,000');
    expect(r.body).toContain('750,000');
    expect(r.link).toBe('/wallet/transactions');
  });

  it('renders payment failed with reason', () => {
    const r = renderNotification(NotificationType.PAYMENT_FAILED, {
      amount: 120000,
      reason: 'کارت نامعتبر',
    });
    expect(r.title).toContain('ناموفق');
    expect(r.body).toContain('کارت نامعتبر');
  });

  it('renders refund with tracking code', () => {
    const r = renderNotification(NotificationType.REFUND_ISSUED, {
      amount: 30000,
      balance: 130000,
      trackingCode: 'REF9',
    });
    expect(r.title).toContain('بازگشت وجه');
    expect(r.body).toContain('REF9');
  });

  it('renders completed notification with thanks', () => {
    const r = renderNotification(NotificationType.REQUEST_COMPLETED, {
      requestId: '77',
      trackingCode: 'DONE1',
    });
    expect(r.title).toContain('تکمیل شد');
    expect(r.link).toBe('/requests/77');
  });

  it('renders cancelled notification with reason', () => {
    const r = renderNotification(NotificationType.REQUEST_CANCELLED, {
      requestId: '5',
      trackingCode: 'C5',
      reason: 'عدم پرداخت',
    });
    expect(r.body).toContain('عدم پرداخت');
  });

  it('falls back to system template for unknown types with explicit copy', () => {
    const r = renderNotification('system', { title: 'تیتر اطلاعیه', body: 'متن اطلاعیه' });
    expect(r.title).toBe('تیتر اطلاعیه');
    expect(r.body).toBe('متن اطلاعیه');
  });

  it('keeps caller-provided link over template link', () => {
    const r = renderNotification(NotificationType.REQUEST_CREATED, {
      requestId: '12',
      link: '/operator/requests/12',
    });
    expect(r.link).toBe('/operator/requests/12');
  });

  it('marks payment_failed and refund_issued as SMS-critical', () => {
    expect(SMS_CRITICAL_TYPES.has(NotificationType.PAYMENT_FAILED)).toBe(true);
    expect(SMS_CRITICAL_TYPES.has(NotificationType.REFUND_ISSUED)).toBe(true);
    expect(SMS_CRITICAL_TYPES.has(NotificationType.WALLET_CHARGED)).toBe(false);
  });

  it('handles missing data without crashing', () => {
    const r = renderNotification(NotificationType.REQUEST_COMPLETED, {});
    expect(r.title).toBeTruthy();
  });
});
