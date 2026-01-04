
import { useEffect } from 'react';
import { useInstanceMonitorStore, type LivePlayerInfo } from '../stores/instanceMonitorStore';

export function useInstanceMonitorInit(isAuthenticated: boolean) {
  const { addPlayer, removePlayer, setWorldId, setInstanceInfo, setWorldName, clearInstance } = useInstanceMonitorStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[InstanceMonitor] Initializing Log Watcher...');
    // Start watching logs
    window.electron.logWatcher.start();

    // Setup event listeners
    const cleanupJoined = window.electron.logWatcher.onPlayerJoined((event) => {
      const player: LivePlayerInfo = {
        displayName: event.displayName,
        userId: event.userId,
        joinTime: new Date(event.timestamp).getTime()
      };
      addPlayer(player);
    });

    const cleanupLeft = window.electron.logWatcher.onPlayerLeft((event) => {
      removePlayer(event.displayName);
    });

    const cleanupLocation = window.electron.logWatcher.onLocation(async (event) => {
      // New location detected, clear previous instance data
      clearInstance();
      setWorldId(event.worldId);
      
      const eventAny = event as any;
      if (eventAny.instanceId && eventAny.location) {
          setInstanceInfo(eventAny.instanceId, eventAny.location);
      }
      
      // Fetch world details if we can (to fix "Unknown World")
      try {
        const result = await window.electron.getWorld(event.worldId);
        if (result.success && result.world) {
            setWorldName(result.world.name);
        }
      } catch (e) {
        console.error('Failed to fetch world name', e);
      }
    });

    const cleanupWorldName = window.electron.logWatcher.onWorldName((event) => {
      setWorldName(event.name);
    });

    return () => {
      cleanupJoined();
      cleanupLeft();
      cleanupLocation();
      cleanupWorldName();
      window.electron.logWatcher.stop();
    };

  }, [isAuthenticated, addPlayer, removePlayer, setWorldId, setWorldName, clearInstance]);
}
