import { JobName } from '@caffenet/shared';

export interface IJobPayload {
  [JobName.SEND_NOTIFICATION]: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  };
  [JobName.SEND_WEB_PUSH]: {
    subscriptionId: string;
    payload: { title: string; body: string; data?: Record<string, unknown>; tag?: string };
  };
  [JobName.SEND_EMAIL]: {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
  };
  [JobName.SEND_SMS]: {
    phone: string;
    message: string;
    patternCode?: string;
    params?: Record<string, string>;
  };
  [JobName.PAYMENT_RECONCILIATION]: {
    paymentId: string;
  };
  [JobName.CLEANUP_PUSH_SUBSCRIPTIONS]: Record<string, never>;
  [JobName.CLEANUP_EXPIRED_OTPS]: Record<string, never>;
  [JobName.CLEANUP_EXPIRED_SESSIONS]: Record<string, never>;
}

export interface IQueue {
  /**
   * Enqueue a job.
   * @returns the job ID (uuid)
   */
  enqueue<K extends JobName>(name: K, payload: IJobPayload[K], options?: {
    delaySeconds?: number;
    idempotencyKey?: string;
    maxAttempts?: number;
  }): Promise<string>;

  /**
   * Reserve the next available job from the queue (atomic).
   * Used by the worker CLI.
   */
  reserveNext(queueName: string, reservationSeconds: number): Promise<ReservedJob | null>;

  /**
   * Mark a job as completed.
   */
  complete(jobId: string): Promise<void>;

  /**
   * Mark a job as failed (with reason).
   */
  fail(jobId: string, error: string): Promise<void>;

  /**
   * Get queue stats (pending, reserved, failed, completed today).
   */
  stats(queueName: string): Promise<QueueStats>;
}

export interface ReservedJob {
  id: string;
  uuid: string;
  name: JobName;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

export interface QueueStats {
  pending: number;
  reserved: number;
  failed: number;
  completedToday: number;
}

export const QUEUE_TOKEN = Symbol('QUEUE_TOKEN');
