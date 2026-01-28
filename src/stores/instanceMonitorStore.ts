
import { create } from 'zustand';

export interface LivePlayerInfo {
  displayName: string;
  userId?: string; // May be undefined if not parsed from log
  joinTime: number;
}

export interface LiveEntity {
  id: string;
  displayName: string;
  rank: string;
  isGroupMember: boolean;
  status: 'active' | 'kicked' | 'joining' | 'left';
  avatarUrl?: string;
  lastUpdated?: number;
}

export interface InstanceMonitorState {
  currentWorldId: string | null;
  currentWorldName: string | null;
  currentInstanceId: string | null;
  currentLocation: string | null; // worldId:instanceId
  currentGroupId: string | null;
  instanceImageUrl: string | null;
  players: Record<string, LivePlayerInfo>; // Keyed by displayName
  liveScanResults: LiveEntity[]; // Persisted scan results with history

  // Actions
  addPlayer: (player: LivePlayerInfo) => void;
  removePlayer: (displayName: string) => void;
  setWorldId: (id: string) => void;
  setWorldName: (name: string) => void;
  setInstanceInfo: (id: string, location: string) => void;
  setInstanceImage: (url: string) => void;
  clearInstance: () => void;
  updateLiveScan: (newEntities: LiveEntity[]) => void;
  clearLiveScan: () => void;
  setCurrentGroupId: (groupId: string | null) => void;
  setEntityStatus: (id: string, status: LiveEntity['status']) => void;
}

export const useInstanceMonitorStore = create<InstanceMonitorState>((set) => ({
  currentWorldId: null,
  currentWorldName: null,
  currentInstanceId: null,
  currentLocation: null,
  currentGroupId: null, // Add default
  instanceImageUrl: null,
  players: {},
  liveScanResults: [],

  addPlayer: (player) =>
    set((state) => ({
      players: {
        ...state.players,
        [player.displayName]: player,
      },
    })),

  removePlayer: (displayName) =>
    set((state) => {
      const newPlayers = { ...state.players };
      delete newPlayers[displayName];
      return { players: newPlayers };
    }),

  setWorldId: (id) => set({ currentWorldId: id }),
  setWorldName: (name) => set({ currentWorldName: name }),
  setInstanceInfo: (id, location) => set((state) => {
    if (state.currentInstanceId !== id) {
      // Instance changed - clear all instance-specific data
      return {
        currentInstanceId: id,
        currentLocation: location,
        currentWorldId: null, // Will be set by setWorldId
        currentWorldName: null, // Will be set by world fetch
        players: {},
        liveScanResults: []
      };
    }
    return { currentInstanceId: id, currentLocation: location };
  }),

  // New action
  setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),

  setInstanceImage: (url) => set({ instanceImageUrl: url }),

  // NOTE: currentGroupId is NOT cleared here - it's managed by the separate onGroupChanged IPC event
  // This prevents race conditions when switching instances
  // NOTE: instanceImageUrl is also NOT cleared immediately - we keep the old image visible until a new one is fetched
  clearInstance: () => set({ players: {}, currentWorldId: null, currentWorldName: null, currentInstanceId: null, currentLocation: null }),

  updateLiveScan: (newEntities) => set((state) => {
    const nextMap = new Map<string, LiveEntity>();

    // 1. Process existing entities
    // Mark active/joining as 'left' temporarily
    state.liveScanResults.forEach(e => {
      if (e.status === 'active' || e.status === 'joining') {
        nextMap.set(e.id, { ...e, status: 'left' });
      } else {
        nextMap.set(e.id, e);
      }
    });

    // 2. Update with current results (revive to 'active')
    newEntities.forEach(r => {
      const existing = nextMap.get(r.id);
      nextMap.set(r.id, { ...(existing || {}), ...r, status: 'active' });
    });

    // 3. Convert to array and cleanup history
    let allEntities = Array.from(nextMap.values());

    // Separate active vs inactive
    const active = allEntities.filter(e => e.status !== 'left' && e.status !== 'kicked');
    const history = allEntities.filter(e => e.status === 'left' || e.status === 'kicked');

    // Sort history by lastUpdated if available, or keep order. 
    // If history is too large, slice it.
    if (history.length > 50) {
      // If we don't have timestamps, we just slice the end (assuming insertion order)
      // But to be safe, let's just keep the last 50.
      const keptHistory = history.slice(-50);
      allEntities = [...active, ...keptHistory];
    }

    return { liveScanResults: allEntities };
  }),

  clearLiveScan: () => set({ liveScanResults: [] }),

  setEntityStatus: (id, status) => set((state) => ({
    liveScanResults: state.liveScanResults.map(e => e.id === id ? { ...e, status } : e)
  }))
}));
