'use client';

import { create } from 'zustand';

/**
 * UI store (7.1.7) — global UI state that does not need persistence.
 * Bottom sheets (7.2.5) are centrally managed so any component can open one.
 */

export interface BottomSheetState {
  isOpen: boolean;
  title?: string;
  content: React.ReactNode | null;
}

interface UiState {
  sheet: BottomSheetState;
  openSheet: (content: React.ReactNode, title?: string) => void;
  closeSheet: () => void;

  /** Header height reported by MobileHeader for sticky offsets */
  headerHeight: number;
  setHeaderHeight: (h: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sheet: { isOpen: false, content: null },
  openSheet: (content, title) => set({ sheet: { isOpen: true, content, title } }),
  closeSheet: () => set({ sheet: { isOpen: false, content: null } }),

  headerHeight: 56,
  setHeaderHeight: (headerHeight) => set({ headerHeight }),
}));
