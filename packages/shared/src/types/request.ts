import type { RequestStatus } from '../enums';

/**
 * Request-related shared types (Phase 4).
 * Used by API responses and the web app — keep serialization-safe
 * (BigInt fields are exposed as strings).
 */

export interface RequestServiceSnapshot {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  categoryId: string;
  categoryName?: string;
}

export interface RequestDto {
  id: string;
  uuid: string;
  trackingCode: string;
  customerId: string;
  customer?: {
    id: string;
    fullName?: string | null;
    phone: string;
  };
  serviceId: string;
  service?: RequestServiceSnapshot;
  status: RequestStatus | string;
  paymentStatus: string;
  description?: string | null;
  /** Toman (major units) for display — snapshot at creation */
  laborFee: number;
  /** Toman (major units) */
  finalTotal: number;
  currency: string;
  assignedOperatorId?: string | null;
  assignedOperator?: {
    id: string;
    fullName?: string | null;
    phone: string;
  } | null;
  estimatedDurationMin?: number | null;
  contactMethodId?: string | null;
  contactValue?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  fieldValues?: RequestFieldValueDto[];
  attachments?: RequestAttachmentDto[];
}

export interface RequestFieldValueDto {
  id: string;
  fieldId: string;
  fieldName?: string;
  fieldLabel?: string;
  fieldType?: string;
  value: string | null;
  /** For file fields: signed URL (short-lived), resolved server-side when requested */
  fileUrl?: string | null;
  createdAt: string;
}

export interface RequestAttachmentDto {
  id: string;
  fileId: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  visibility?: string;
  uploadedBy: string;
  /** Signed URL — only present when requested by authorized party */
  url?: string | null;
  createdAt: string;
}

export interface RequestStatusHistoryDto {
  id: string;
  requestId: string;
  previousStatus: string | null;
  newStatus: string;
  userId: string;
  userName?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface RequestAssignmentDto {
  id: string;
  requestId: string;
  operatorId: string;
  operatorName?: string | null;
  assignedBy: string;
  assignedByName?: string | null;
  active: boolean;
  note?: string | null;
  createdAt: string;
  unassignedAt?: string | null;
}

/** One entry of the UI-friendly timeline (Phase 4.4.2). */
export interface RequestTimelineEntryDto {
  /** Sort key — ISO timestamp */
  at: string;
  type:
    | 'created'
    | 'status_changed'
    | 'assigned'
    | 'unassigned'
    | 'attachment_added'
    | 'completed'
    | 'cancelled'
    | 'note';
  title: string;
  description?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  /** Raw payload for detail rendering (e.g. status colors in UI) */
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CursorPaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}
