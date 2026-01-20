import { create } from 'zustand';
import type { ScanResult } from '../types/electron';

interface ScanProgress {
    phase: 'idle' | 'fetching' | 'scanning' | 'complete';
    current: number;
    total: number;
    currentName?: string;
    currentStatus?: 'safe' | 'violation';
}

interface ScanStore {
    results: ScanResult[];
    progress: ScanProgress;
    isLoading: boolean;
    
    // Actions
    startScan: (groupId: string) => Promise<void>;
    updateResult: (userId: string, changes: Partial<ScanResult>) => void;
    clearResults: () => void;
}

export const useScanStore = create<ScanStore>((set, get) => ({
    results: [],
    progress: { phase: 'idle', current: 0, total: 0 },
    isLoading: false,

    startScan: async (groupId: string) => {
        if (get().isLoading) return;

        set({ 
            isLoading: true, 
            results: [], 
            progress: { phase: 'fetching', current: 0, total: 0 } 
        });

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const electron = (window as any).electron;

            // Phase 1: Fetch all members first
            const fetchRes = await electron.automod.fetchMembers(groupId);
            if (!fetchRes.success || !fetchRes.members) {
                 throw new Error(fetchRes.error || "Failed to fetch members");
            }

            const members = fetchRes.members;
            set({ progress: { phase: 'scanning', current: 0, total: members.length, currentName: 'Starting...' } });

            // Phase 2: Iterate and Evaluate
            for (let i = 0; i < members.length; i++) {
                const member = members[i];
                set(state => ({
                    progress: {
                        ...state.progress,
                        current: i + 1,
                        currentName: member.user?.displayName || 'Unknown',
                        currentStatus: undefined
                    }
                }));
                
                // Artificial delay for "alive" feel
                await new Promise(r => setTimeout(r, members.length > 500 ? 10 : 150)); 

                const result = await electron.automod.evaluateMember({ groupId, member });
                
                if (result.action !== 'SAFE') {
                     set(state => ({
                        results: [...state.results, result],
                        progress: { ...state.progress, currentStatus: 'violation' }
                     }));
                     // Longer pause on violation to see it
                     await new Promise(r => setTimeout(r, 300));
                } else {
                     set(state => ({
                        progress: { ...state.progress, currentStatus: 'safe' }
                     }));
                }
            }

            set(state => ({ 
                isLoading: false,
                progress: { ...state.progress, phase: 'complete', currentName: undefined }
            }));

        } catch (e) {
            console.error("Scan failed:", e);
            set({ isLoading: false, progress: { phase: 'idle', current: 0, total: 0 } });
        }
    },

    updateResult: (userId, changes) => set(state => ({
        results: state.results.map(r => r.userId === userId ? { ...r, ...changes } : r)
    })),

    clearResults: () => set({ results: [], progress: { phase: 'idle', current: 0, total: 0 } })
}));
