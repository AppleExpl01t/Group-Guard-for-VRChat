
import { create } from 'zustand';

interface RecruitProgress {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
  current?: string;
  done?: boolean;
}

interface RecruitStore {
  // UI State
  isOpen: boolean;
  minimized: boolean;
  
  // Logic State
  isActive: boolean;
  isPaused: boolean;
  targetGroupId: string | null;
  targetGroupName: string | null;
  
  // Config for current run
  config: {
    userIds: string[];
    delayMs: number;
    filterAutoMod: boolean;
  };

  // Progress
  progress: RecruitProgress;
  logs: string[];

  // Actions
  open: (groupId: string, groupName: string, initialUserIds: string[]) => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
  
  reset: () => void;
  
  startRecruit: (delayMs: number, filterAutoMod: boolean) => Promise<void>;
  
  pauseRecruit: () => void;
  resumeRecruit: () => void;
  cancelRecruit: () => void; // New Cancel action

  updateProgress: (data: RecruitProgress) => void;
  addLog: (msg: string) => void;
}

export const useRecruitStore = create<RecruitStore>((set, get) => ({
  isOpen: false,
  minimized: false,
  isActive: false,
  isPaused: false,
  targetGroupId: null,
  targetGroupName: null,
  
  config: { userIds: [], delayMs: 2500, filterAutoMod: true },
  
  progress: { sent: 0, skipped: 0, failed: 0, total: 0 },
  logs: [],

  open: (groupId, groupName, initialUserIds) => {
    // If we are already running for this group, just show it
    const state = get();
    if (state.isActive && state.targetGroupId === groupId) {
      set({ isOpen: true, minimized: false });
      return;
    }

    // Otherwise reset and prepare
    set({
      isOpen: true,
      minimized: false,
      isActive: false,
      isPaused: false,
      targetGroupId: groupId,
      targetGroupName: groupName,
      config: { ...state.config, userIds: initialUserIds },
      progress: { sent: 0, skipped: 0, failed: 0, total: 0 },
      logs: []
    });
  },

  close: () => {
    // If active, just minimize instead of full close (optional UX choice)
    // For now, we allow close but maybe it should kill the process?
    // Let's stick to simple "Close UI" behavior
    set({ isOpen: false });
  },
  minimize: () => set({ isOpen: false, minimized: true }),
  restore: () => set({ isOpen: true, minimized: false }),

  reset: () => set({
    isActive: false,
    isPaused: false,
    progress: { sent: 0, skipped: 0, failed: 0, total: 0 },
    logs: [],
    isOpen: false,
    minimized: false
  }),

  addLog: (msg) => set(prev => ({ logs: [...prev.logs, msg] })),

  updateProgress: (data) => {
    set(() => {
        const changes: Partial<RecruitStore> = { progress: data };
        if (data.done) {
            changes.isActive = false;
            changes.isPaused = false;
        }
        return changes;
    });
  },

  startRecruit: async (delayMs, filterAutoMod) => {
    const state = get();
    if (!state.targetGroupId || state.config.userIds.length === 0) return;

    set({ 
        isActive: true, 
        isPaused: false,
        logs: ["Starting Smart Recruit...", `Targets: ${state.config.userIds.length} users`],
        progress: { sent: 0, skipped: 0, failed: 0, total: state.config.userIds.length }
    });

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (window as any).electron.instance.smartRecruit({
            userIds: state.config.userIds,
            groupId: state.targetGroupId,
            delayMs: delayMs,
            filterAutoMod: filterAutoMod
        });

        if (!result.success) {
            set(prev => ({ 
                isActive: false, 
                logs: [...prev.logs, `Start Failed: ${result.error}`] 
            }));
        } else {
             set(prev => ({ logs: [...prev.logs, `Process started in background...`] }));
        }

    } catch (e) {
        set(prev => ({ 
            isActive: false, 
            logs: [...prev.logs, `Error: ${e}`] 
        }));
    }
  },

  pauseRecruit: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).electron.instance.smartRecruitPause();
      set(prev => ({ 
          isPaused: true, 
          logs: [...prev.logs, '[Control] Paused recruitment.'] 
      }));
  },

  resumeRecruit: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).electron.instance.smartRecruitResume();
      set(prev => ({ 
          isPaused: false, 
          logs: [...prev.logs, '[Control] Resuming recruitment...'] 
      }));
  },

  cancelRecruit: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).electron.instance.smartRecruitCancel();
      set(prev => ({ 
          isActive: false,
          isPaused: false,
          logs: [...prev.logs, '[Control] Cancelling recruitment...'] 
      }));
  }

}));
