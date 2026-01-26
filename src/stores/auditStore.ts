import { create } from 'zustand';

export interface AuditLogEntry {
  id: string;
  created_at: string;
  type: string;
  eventType?: string;
  actorId: string;
  actorDisplayName: string;
  targetId?: string;
  targetDisplayName?: string;
  description: string;
  data?: Record<string, unknown>;
}

interface AuditState {
  logs: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;

  fetchLogs: (groupId: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  fetchLogs: async (groupId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electron.getGroupAuditLogs(groupId);
      if (result.success) {
        set({ logs: result.logs as AuditLogEntry[] || [], isLoading: false });
      } else {
        set({ error: result.error, isLoading: false });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to fetch logs', isLoading: false });
    }
  }
}));
