import { useEffect, useRef, useState, useCallback } from 'react';
import { useGroupStore, REFRESH_INTERVALS } from '../stores/groupStore';

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
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRef = useRef(false);

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

  // Initial fetch effect (runs once when group changes)
  useEffect(() => {
    if (!selectedGroup || !enabled) return;
    
    const lastFetched = getLastFetchedAt(type);
    const timeSinceLastFetch = Date.now() - lastFetched;
    
    // Need initial fetch if never fetched or stale
    if (lastFetched === 0 || timeSinceLastFetch >= intervalMs) {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchData();
      }
    }
    
    return () => {
      hasFetchedRef.current = false;
    };
  }, [selectedGroup?.id, enabled, type, intervalMs, fetchData, getLastFetchedAt, selectedGroup]);

  // Interval setup effect
  useEffect(() => {
    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!selectedGroup || !enabled) return;

    // Set up refresh interval
    intervalRef.current = setInterval(() => {
      fetchData();
      setSecondsUntilRefresh(Math.floor(intervalMs / 1000));
    }, intervalMs);

    // Set up countdown interval (updates every second)
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) return Math.floor(intervalMs / 1000);
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [selectedGroup, enabled, intervalMs, fetchData]);

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
