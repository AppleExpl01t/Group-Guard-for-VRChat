
import { create } from 'zustand';

export interface LivePlayerInfo {
  displayName: string;
  userId?: string; // May be undefined if not parsed from log
  joinTime: number;
}

export interface InstanceMonitorState {
  currentWorldId: string | null;
  currentWorldName: string | null;
  currentInstanceId: string | null;
  currentLocation: string | null; // worldId:instanceId
  players: Record<string, LivePlayerInfo>; // Keyed by displayName
  
  // Actions
  addPlayer: (player: LivePlayerInfo) => void;
  removePlayer: (displayName: string) => void;
  setWorldId: (id: string) => void;
  setWorldName: (name: string) => void;
  setInstanceInfo: (id: string, location: string) => void;
  clearInstance: () => void;
}

export const useInstanceMonitorStore = create<InstanceMonitorState>((set) => ({
  currentWorldId: null,
  currentWorldName: null,
  currentInstanceId: null,
  currentLocation: null,
  players: {},

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
  setInstanceInfo: (id, location) => set({ currentInstanceId: id, currentLocation: location }),
  
  clearInstance: () => set({ players: {}, currentWorldId: null, currentWorldName: null, currentInstanceId: null, currentLocation: null }),
}));
