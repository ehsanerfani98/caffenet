import { describe, expect, it } from 'vitest';
import { formatFileSize, formatToman, formatSignedToman, toPersianDigits } from '@/lib/format';
import { requestStatusLabel, statusProgress } from '@/lib/status-meta';

/**
 * Unit tests for Phase 7 display helpers (7.4+).
 */

describe('format helpers', () => {
  it('converts digits to Persian', () => {
    expect(toPersianDigits(123)).toBe('۱۲۳');
    expect(toPersianDigits('RR12')).toBe('RR۱۲');
  });

  it('formats Toman amounts with Persian grouping', () => {
    expect(formatToman(125000)).toContain('۱۲۵');
    expect(formatToman(125000)).toContain('تومان');
    expect(formatToman(null)).toBe('—');
  });

  it('formats signed transaction amounts', () => {
    expect(formatSignedToman(50000)).toMatch(/^\+/);
    expect(formatSignedToman(-12500)).toMatch(/^−/);
  });

  it('formats file sizes', () => {
    expect(formatFileSize(500)).toContain('بایت');
    expect(formatFileSize(2 * 1024 * 1024)).toContain('مگابایت');
  });
});

describe('status meta', () => {
  it('maps known statuses to Persian labels', () => {
    expect(requestStatusLabel('pending')).toBe('در انتظار بررسی');
    expect(requestStatusLabel('completed')).toBe('تکمیل شده');
  });

  it('falls back to raw status for unknown values', () => {
    expect(requestStatusLabel('future_state')).toBe('future_state');
  });

  it('computes progress in order', () => {
    expect(statusProgress('pending')).toBeGreaterThan(0);
    expect(statusProgress('completed')).toBe(100);
    expect(statusProgress('cancelled')).toBe(0);
  });
});

describe('request draft store (7.1.7)', () => {
  // Minimal harness — the store module imports zustand only (no React),
  // so we can exercise its reducers in node.
  it('advances through the wizard flow', async () => {
    const { useRequestDraftStore } = await import('@/lib/stores/request-draft-store');
    const s = useRequestDraftStore;
    s.getState().reset();
    s.getState().setService({ id: 5, slug: 'print-a4', name: 'چاپ A4' });
    expect(s.getState().serviceId).toBe(5);
    expect(s.getState().step).toBe(2);
    s.getState().setFormData({ copies: 3 });
    s.getState().setFileIds(['1', '2']);
    s.getState().setContact('telegram', '@ali');
    s.getState().setStep(5);
    expect(s.getState().formData.copies).toBe(3);
    expect(s.getState().fileIds).toHaveLength(2);
    s.getState().reset();
    expect(s.getState().step).toBe(1);
    expect(s.getState().fileIds).toHaveLength(0);
  });
});
