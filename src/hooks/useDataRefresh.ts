import { useState, useCallback } from 'react';
import { useGroupStore, REFRESH_INTERVALS } from '../stores/groupStore';
import { usePoller } from './usePoller';

type DataType = keyof typeof REFRESH_INTERVALS;

interface UseDataRefreshOptions {
  type: DataType;
  enabled?: boolean;
}

interface UseDataRefreshResult {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  refreshNow: () => void;
  lastFetchedAt: number;
}

/**
 * Hook to automatically refresh data at configured intervals
 * Provides a countdown timer synced with the refresh cycle
 */
export function useDataRefresh({ type, enabled = true }: UseDataRefreshOptions): UseDataRefreshResult {
  const { 
    selectedGroup, 
    fetchGroupRequests, 
    fetchGroupBans, 
    fetchGroupMembers, 
    fetchGroupInstances,
    isRequestsLoading,
    isBansLoading,
    isMembersLoading,
    isInstancesLoading,
    getLastFetchedAt,
  } = useGroupStore();

  const intervalMs = REFRESH_INTERVALS[type];
  
  // Use useState initializer to compute initial value (runs once, not during render)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(() => {
    const lastFetched = getLastFetchedAt(type);
    if (lastFetched === 0) return Math.floor(intervalMs / 1000);
    const remaining = intervalMs - (Date.now() - lastFetched);
    return Math.max(1, Math.ceil(remaining / 1000));
  });


  const isRefreshing = type === 'requests' ? isRequestsLoading :
                       type === 'bans' ? isBansLoading :
                       type === 'members' ? isMembersLoading :
                       isInstancesLoading;

  const fetchData = useCallback(async () => {
    if (!selectedGroup) return;
    
    switch (type) {
      case 'requests':
        await fetchGroupRequests(selectedGroup.id);
        break;
      case 'bans':
        await fetchGroupBans(selectedGroup.id);
        break;
      case 'members':
        await fetchGroupMembers(selectedGroup.id, 0);
        break;
      case 'instances':
        await fetchGroupInstances(selectedGroup.id);
        break;
    }
  }, [selectedGroup, type, fetchGroupRequests, fetchGroupBans, fetchGroupMembers, fetchGroupInstances]);

  const refreshNow = useCallback(() => {
    fetchData();
    setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
  }, [fetchData, intervalMs]);

  // 1. Initial Fetch Logic (replaces the first useEffect)
  // We use usePoller with immediate=true IF we are stale
  // Actually, usePoller repeats. We just want a "check on mount" maybe?
  // Let's keep a simplified useEffect for the "Initial check" to respect stale time,
  // OR just let the poller handle it if we set immediate=true.
  // But strictly, we only want to fetch immediately if STALE.
  
  // Let's use usePoller for the REPEATED fetching.
  usePoller(() => {
      fetchData();
      setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
  }, (enabled && selectedGroup) ? intervalMs : null);

  // 2. Countdown Logic
  usePoller(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) return Math.floor(intervalMs / 1000);
        return prev - 1;
      });
  }, (enabled && selectedGroup) ? 1000 : null);

  return {
    secondsUntilRefresh,
    isRefreshing,
    refreshNow,
    lastFetchedAt: getLastFetchedAt(type),
  };
}



/**
 * Format seconds into a human-readable countdown
 */
export function formatCountdown(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
