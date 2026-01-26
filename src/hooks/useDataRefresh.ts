import { useCallback } from 'react';
import { useGroupStore, REFRESH_INTERVALS } from '../stores/groupStore';
import { usePoller } from './usePoller';
import { useShallow } from 'zustand/react/shallow';

type DataType = keyof typeof REFRESH_INTERVALS;

interface UseDataRefreshOptions {
  type: DataType;
  enabled?: boolean;
}

/**
 * Hook to automatically refresh data at configured intervals
 * Provides a countdown timer synced with the refresh cycle
 */
export function useDataRefresh({ type, enabled = true }: UseDataRefreshOptions) {
  // PERF FIX: Use shallow selectors to prevent re-renders on unrelated state changes
  const selectedGroup = useGroupStore(state => state.selectedGroup);
  const getLastFetchedAt = useGroupStore(state => state.getLastFetchedAt);
  
  // Select only the fetch function we need based on type
  const fetchGroupRequests = useGroupStore(state => state.fetchGroupRequests);
  const fetchGroupBans = useGroupStore(state => state.fetchGroupBans);
  const fetchGroupMembers = useGroupStore(state => state.fetchGroupMembers);
  const fetchGroupInstances = useGroupStore(state => state.fetchGroupInstances);
  
  // Select only the loading state we need
  const loadingStates = useGroupStore(useShallow(state => ({
    isRequestsLoading: state.isRequestsLoading,
    isBansLoading: state.isBansLoading,
    isMembersLoading: state.isMembersLoading,
    isInstancesLoading: state.isInstancesLoading,
  })));

  const intervalMs = REFRESH_INTERVALS[type];
  const lastFetchedAt = getLastFetchedAt(type);

  const isRefreshing = type === 'requests' ? loadingStates.isRequestsLoading :
                       type === 'bans' ? loadingStates.isBansLoading :
                       type === 'members' ? loadingStates.isMembersLoading :
                       loadingStates.isInstancesLoading;

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
  }, [fetchData]);

  // Use usePoller for the REPEATED fetching.
  usePoller(() => {
      fetchData();
  }, (enabled && selectedGroup) ? intervalMs : null);

  // If never fetched (0), next refresh is effectively now/pending. 
  // We'll just say "now" by effectively returning a timestamp in the past or close to it.
  // Ideally downstream handles "0" as "Refresh Pending".
  const nextRefreshAt = lastFetchedAt > 0 ? lastFetchedAt + intervalMs : 0;

  return {
    nextRefreshAt,
    isRefreshing,
    refreshNow,
    lastFetchedAt,
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
