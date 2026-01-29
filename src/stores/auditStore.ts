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
  currentGroupId: string | null;
  isLoading: boolean;
  error: string | null;

  fetchLogs: (groupId: string) => Promise<void>;
  clearLogs: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: [],
  currentGroupId: null,
  isLoading: false,
  error: null,

  fetchLogs: async (groupId) => {
    // If switching groups, reset logs
    const currentGroupId = get().currentGroupId;
    if (currentGroupId !== groupId) {
      set({ logs: [], currentGroupId: groupId, isLoading: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      const result = await window.electron.getGroupAuditLogs(groupId);
      if (result.success) {
        set(state => {
          const newLogs = (result.logs as AuditLogEntry[]) || [];

          // Merge with existing logs
          const existingLogs = state.logs;

          // Use a Map to deduplicate by ID, prioritizing existing logs (or newer ones?)
          // Usually we want to merge: [New Fetched] + [Existing]
          // If fetch returns overlaps, dedup.

          const logMap = new Map<string, AuditLogEntry>();

          // Add exisiting logs first
          existingLogs.forEach(log => logMap.set(log.id, log));

          // Add/Update with new logs
          newLogs.forEach(log => logMap.set(log.id, log));

          // Convert back to array and sort desc
          const merged = Array.from(logMap.values()).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          // Limit to 200
          const limited = merged.slice(0, 200);

          return { logs: limited, isLoading: false };
        });
      } else {
        set({ error: result.error, isLoading: false });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message || 'Failed to fetch logs', isLoading: false });
    }
  },

  clearLogs: () => set({ logs: [], currentGroupId: null })
}));
