'use client';

import { apiClient } from '@/lib/api-client';
import type { RequestDto, RequestTimelineEntryDto } from '@caffenet/shared';
import type { WalletPayResult, CreatePaymentResult, PayRequestDtoData } from '@caffenet/shared';

/**
 * Requests API (7.6 / 7.7) — customer endpoints of modules/requests.
 */

export interface RequestsPage {
  items: RequestDto[];
  meta: { page: number; limit: number; total: number; totalPages?: number; pages?: number };
}

export interface CreateRequestResult extends RequestDto {}

export const requestsApi = {
  create: (data: {
    serviceId: number;
    formData?: Record<string, unknown>;
    description?: string;
    contactMethod?: string;
    contactValue?: string;
    fileIds?: string[];
  }) => apiClient.post<CreateRequestResult>('/requests', data).then((r) => r.data),

  list: (params: { page?: number; limit?: number; status?: string }) =>
    apiClient.get<RequestsPage>('/requests', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<RequestDto>(`/requests/${id}`).then((r) => r.data),

  byTrackingCode: (trackingCode: string) =>
    apiClient
      .get<RequestDto>(`/requests/${encodeURIComponent(trackingCode)}/by-code`)
      .then((r) => r.data),

  timeline: (id: string) =>
    apiClient.get<RequestTimelineEntryDto[]>(`/requests/${id}/timeline`).then((r) => r.data),

  history: (id: string) =>
    apiClient
      .get<{ items: Array<Record<string, unknown>> }>(`/requests/${id}/history`)
      .then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    apiClient.patch<RequestDto>(`/requests/${id}/cancel`, { reason }).then((r) => r.data),

  /** 6.5.1 — wallet = atomic debit; online = gateway redirect */
  pay: (id: string, data: PayRequestDtoData) =>
    apiClient
      .post<WalletPayResult | CreatePaymentResult>(`/requests/${id}/pay`, data)
      .then((r) => r.data),

  attachments: (requestId: string) =>
    apiClient
      .get<{ items: Array<Record<string, unknown>> }>(`/requests/attachments/${requestId}`)
      .then((r) => r.data),

  addAttachments: (id: string, fileIds: string[]) =>
    apiClient.post<RequestDto>(`/requests/${id}/attachments`, { fileIds }).then((r) => r.data),
};

/** Upload a file (7.6.8) — multipart to POST /files/upload. */
export async function uploadFile(file: File, visibility: 'public' | 'private' = 'private') {
  const form = new FormData();
  form.append('file', file);
  form.append('visibility', visibility);
  const res = await apiClient.post<{ id: string; originalName?: string; url?: string }>(
    '/files/upload',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 },
  );
  return res.data;
}
