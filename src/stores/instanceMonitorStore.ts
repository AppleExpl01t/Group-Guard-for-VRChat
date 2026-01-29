
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
  friendStatus?: 'friend' | 'outgoing' | 'incoming' | 'none';
  friendScore?: number;
  metrics?: {
    encounters: number;
    timeSpent: number;
  };
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
  history: { timestamp: number; count: number }[]; // Player count history

  // Actions
  handlePlayerJoined: (player: LivePlayerInfo) => void;
  handlePlayerLeft: (displayName: string) => void;
  updateEntity: (entity: LiveEntity) => void;

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
  history: [],

  // Event-Driven Actions
  handlePlayerJoined: (player: LivePlayerInfo) =>
    set((state) => {
      const existingIndex = state.liveScanResults.findIndex(e => e.displayName === player.displayName);
      let newResults = [...state.liveScanResults];

      if (existingIndex >= 0) {
        // Reactivate existing entity
        newResults[existingIndex] = {
          ...newResults[existingIndex],
          id: player.userId || newResults[existingIndex].id, // Update ID if we have it now
          status: 'active',
          lastUpdated: Date.now()
        };
      } else {
        // Add new entity
        newResults.push({
          id: player.userId || `log:${player.displayName}`,
          displayName: player.displayName,
          rank: 'Loading...',
          isGroupMember: false,
          status: 'active',
          lastUpdated: Date.now()
        });
      }

      // Calculate new count for history
      const activeCount = newResults.filter(e => e.status === 'active').length;
      let newHistory = [...state.history];
      const lastHistory = newHistory[newHistory.length - 1];

      // Debounce: update last entry if <1s, else push new
      if (!lastHistory || (Date.now() - lastHistory.timestamp > 1000)) {
        newHistory.push({ timestamp: Date.now(), count: activeCount });
      } else {
        newHistory[newHistory.length - 1] = { timestamp: Date.now(), count: activeCount };
      }

      return {
        players: { ...state.players, [player.displayName]: player },
        liveScanResults: newResults,
        history: newHistory
      };
    }),

  handlePlayerLeft: (displayName: string) =>
    set((state) => {
      const newResults = state.liveScanResults.map(e =>
        e.displayName === displayName ? { ...e, status: 'left' as const, lastUpdated: Date.now() } : e
      );

      const newPlayers = { ...state.players };
      delete newPlayers[displayName];

      return {
        players: newPlayers,
        liveScanResults: newResults
      };
    }),

  updateEntity: (entity: LiveEntity) =>
    set((state) => {
      const index = state.liveScanResults.findIndex(e => e.id === entity.id || e.displayName === entity.displayName);
      if (index === -1) return {}; // Warning: Update for unknown entity?

      const newResults = [...state.liveScanResults];
      // Merge updates
      newResults[index] = {
        ...newResults[index],
        ...entity,
        // Preserve status if the update doesn't specify it (though it usually should be 'active')
        status: entity.status || newResults[index].status
      };

      // Calculate new count for history
      const activeCount = newResults.filter(e => e.status === 'active').length;
      let newHistory = [...state.history];
      const lastHistory = newHistory[newHistory.length - 1];

      if (!lastHistory || (Date.now() - lastHistory.timestamp > 1000)) {
        newHistory.push({ timestamp: Date.now(), count: activeCount });
      } else {
        newHistory[newHistory.length - 1] = { timestamp: Date.now(), count: activeCount };
      }

      return {
        liveScanResults: newResults,
        history: newHistory
      };
    }),

  // Legacy / Polling Actions (Kept for compatibility or bulk updates)
  addPlayer: (player) => useInstanceMonitorStore.getState().handlePlayerJoined(player), // Alias
  removePlayer: (displayName) => useInstanceMonitorStore.getState().handlePlayerLeft(displayName), // Alias

  setWorldId: (id) => set({ currentWorldId: id }),
  setWorldName: (name) => set({ currentWorldName: name }),
  setInstanceInfo: (id, location) => set((state) => {
    if (state.currentInstanceId !== id) {
      return {
        currentInstanceId: id,
        currentLocation: location,
        currentWorldId: null,
        currentWorldName: null,
        players: {},
        liveScanResults: []
      };
    }
    return { currentInstanceId: id, currentLocation: location };
  }),

  setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),
  setInstanceImage: (url) => set({ instanceImageUrl: url }),

  clearInstance: () => set({ players: {}, currentWorldId: null, currentWorldName: null, currentInstanceId: null, currentLocation: null, liveScanResults: [] }),

  updateLiveScan: (newEntities) => set((state) => {
    // Only used for initial hydration now
    const nextMap = new Map<string, LiveEntity>();
    state.liveScanResults.forEach(e => nextMap.set(e.id, e));
    newEntities.forEach(r => nextMap.set(r.id, { ...(nextMap.get(r.id) || {}), ...r, status: 'active' }));
    return { liveScanResults: Array.from(nextMap.values()) };
  }),

  clearLiveScan: () => set({ liveScanResults: [] }),

  setEntityStatus: (id, status) => set((state) => ({
    liveScanResults: state.liveScanResults.map(e => e.id === id ? { ...e, status } : e)
  }))
}));
