import { useDataRefresh, formatCountdown } from './useDataRefresh';

/**
 * Hook to automatically refresh group instances
 * Uses the centralized data refresh system
 */
export function useInstanceAutoRefresh() {
  return useDataRefresh({ type: 'instances', enabled: true });
}

export { formatCountdown };
