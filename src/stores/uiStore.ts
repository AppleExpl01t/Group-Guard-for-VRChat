import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  modalCount: number;
  incrementModalCount: () => void;
  decrementModalCount: () => void;
  
  debugModeEnabled: boolean;
  setDebugMode: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      modalCount: 0,
      incrementModalCount: () => set((state) => ({ modalCount: state.modalCount + 1 })),
      decrementModalCount: () => set((state) => ({ modalCount: Math.max(0, state.modalCount - 1) })),
      
      debugModeEnabled: false,
      setDebugMode: (enabled) => set({ debugModeEnabled: enabled }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({ debugModeEnabled: state.debugModeEnabled }), // Only persist debug mode
    }
  )
);
