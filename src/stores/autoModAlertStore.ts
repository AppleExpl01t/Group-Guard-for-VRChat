import { create } from 'zustand';

export interface AutoModViolation {
  id: string; // unique ID
  userId: string;
  displayName: string;
  action: 'REJECT' | 'AUTO_BLOCK';
  reason: string;
  timestamp: number;
  skipped?: boolean;
  ruleId?: number;
  detectedGroupId?: string;
}

interface AutoModAlertStore {
  alerts: AutoModViolation[];
  history: AutoModViolation[];
  isEnabled: boolean;
  addAlert: (violation: Omit<AutoModViolation, 'id' | 'timestamp'>) => void;
  removeAlert: (id: string) => void; 
  dismissAlert: (id: string) => void; // Removes from active alerts, keeps in history
  clearHistory: () => void;
  clearAll: () => void;
  toggleEnabled: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useAutoModAlertStore = create<AutoModAlertStore>((set) => ({
  alerts: [],
  history: [],
  isEnabled: true, 
  
  addAlert: (violation) => set((state) => {
    if (!state.isEnabled) return {}; 
    
    // Create new violation object
    const newViolation = {
        ...violation,
        id: window.crypto.randomUUID(),
        timestamp: Date.now()
    };

    return {
      alerts: [...state.alerts, newViolation],
      history: [newViolation, ...state.history].slice(0, 50) // Keep last 50
    };
  }),

  // Completely remove (e.g. after action taken)
  removeAlert: (id) => set((state) => ({
    alerts: state.alerts.filter((a) => a.id !== id)
    // We keep it in history even if actioned? Yes, as a log.
    // If we want to mark it as 'actioned' in history, we'd need to update history item.
    // For now, simple.
  })),

  // Dismiss from popup but keep in history
  dismissAlert: (id) => set((state) => ({
    alerts: state.alerts.filter((a) => a.id !== id)
  })),

  clearHistory: () => set({ history: [] }),
  
  clearAll: () => set({ alerts: [] }), // Clears active popups
  
  toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),
  setEnabled: (enabled) => set({ isEnabled: enabled })
}));
