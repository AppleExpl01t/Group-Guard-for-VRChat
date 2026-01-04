import { create } from 'zustand';

interface UIState {
  modalCount: number;
  incrementModalCount: () => void;
  decrementModalCount: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  modalCount: 0,
  incrementModalCount: () => set((state) => ({ modalCount: state.modalCount + 1 })),
  decrementModalCount: () => set((state) => ({ modalCount: Math.max(0, state.modalCount - 1) })),
}));
