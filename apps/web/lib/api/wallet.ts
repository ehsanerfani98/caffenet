'use client';

import { apiClient } from '@/lib/api-client';
import type {
  WalletDto,
  WalletTransactionsPageDto,
  CreatePaymentResult,
  PaymentDto,
  InvoiceDto,
} from '@caffenet/shared';

/**
 * Wallet + payments + invoices API (7.8) — Phase 6 endpoints.
 */

export const walletApi = {
  get: () => apiClient.get<WalletDto>('/wallet').then((r) => r.data),

  transactions: (params: { page?: number; limit?: number; type?: string }) =>
    apiClient
      .get<WalletTransactionsPageDto>('/wallet/transactions', { params })
      .then((r) => r.data),
};

export const paymentsApi = {
  /** 6.4.6 — wallet top-up via gateway; returns gateway redirectUrl */
  create: (data: { amountToman: number; gateway?: 'zarinpal' | 'zibal'; description?: string }) =>
    apiClient.post<CreatePaymentResult>('/payments', data).then((r) => r.data),

  get: (id: string) => apiClient.get<PaymentDto>(`/payments/${id}`).then((r) => r.data),

  /** Manual re-verify (7.8.2 fallback if callback redirect missed) */
  verify: (id: string) => apiClient.post<PaymentDto>(`/payments/${id}/verify`).then((r) => r.data),
};

export const invoicesApi = {
  list: (params: { page?: number; limit?: number }) =>
    apiClient
      .get<{ items: InvoiceDto[]; meta?: Record<string, number> }>('/invoices', { params })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<InvoiceDto>(`/invoices/${id}`).then((r) => r.data),

  byNumber: (invoiceNumber: string) =>
    apiClient
      .get<InvoiceDto>(`/invoices/number/${encodeURIComponent(invoiceNumber)}`)
      .then((r) => r.data),

  /** PDF download URL (auth via bearer — fetch as blob) */
  download: async (id: string): Promise<Blob> => {
    const res = await apiClient.get(`/invoices/${id}/download`, { responseType: 'blob' });
    return res.data as Blob;
  },
};
