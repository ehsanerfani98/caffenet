'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Request draft store (7.1.7 — "cart-like" draft).
 * Holds the multi-step request wizard state (7.6) across page navigation:
 * Step 1 service → Step 2 dynamic form → Step 3 files → Step 4 contact →
 * Step 5 review → Step 6 submit.
 */

export interface RequestDraft {
  serviceId?: number;
  serviceSlug?: string;
  serviceName?: string;
  /** Dynamic form values keyed by field name (raw — validated server-side) */
  formData: Record<string, unknown>;
  /** Uploaded file ids from POST /files/upload */
  fileIds: string[];
  /** Contact method slug (phone, telegram, …) */
  contactMethod?: string;
  /** Contact value entered by the customer */
  contactValue?: string;
  /** Free description */
  description?: string;
  /** Current wizard step (1..6) */
  step: number;
}

interface RequestDraftState extends RequestDraft {
  setService: (service: { id: number; slug: string; name: string }) => void;
  setFormData: (data: Record<string, unknown>) => void;
  setFileIds: (ids: string[]) => void;
  setContact: (method: string, value?: string) => void;
  setDescription: (description: string) => void;
  setStep: (step: number) => void;
  reset: () => void;
}

const initialDraft: RequestDraft = {
  serviceId: undefined,
  serviceSlug: undefined,
  serviceName: undefined,
  formData: {},
  fileIds: [],
  contactMethod: undefined,
  contactValue: undefined,
  description: undefined,
  step: 1,
};

export const useRequestDraftStore = create<RequestDraftState>()(
  persist(
    (set) => ({
      ...initialDraft,

      setService: (service) =>
        set({
          serviceId: service.id,
          serviceSlug: service.slug,
          serviceName: service.name,
          step: 2,
        }),

      setFormData: (formData) => set({ formData }),

      setFileIds: (fileIds) => set({ fileIds }),

      setContact: (contactMethod, contactValue) => set({ contactMethod, contactValue }),

      setDescription: (description) => set({ description }),

      setStep: (step) => set({ step }),

      reset: () => set({ ...initialDraft }),
    }),
    {
      name: 'caffenet-request-draft',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
