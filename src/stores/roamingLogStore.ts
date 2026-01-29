import { create } from 'zustand';

export interface LogEntry {
    message: string;
    type: 'info' | 'warn' | 'success' | 'error';
    id: number;
}

interface RoamingLogState {
    logs: LogEntry[];
    addLog: (message: string, type?: LogEntry['type']) => void;
    addLogs: (newLogs: LogEntry[]) => void;
    clearLogs: () => void;
}

export const useRoamingLogStore = create<RoamingLogState>((set) => ({
    logs: [],
    addLog: (message, type = 'info') => set((state) => ({
        logs: [...state.logs, { message, type, id: Date.now() + Math.random() }].slice(-200)
    })),
    addLogs: (newLogs) => set((state) => ({
        logs: [...state.logs, ...newLogs].slice(-200)
    })),
    clearLogs: () => set({ logs: [] })
}));
