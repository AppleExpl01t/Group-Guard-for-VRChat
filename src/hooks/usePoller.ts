import { useEffect, useRef } from 'react';

/**
 * Custom hook for setting up a robust poller/interval.
 * Handles duplicate executions, immediate first-run, and cleanup.
 * 
 * @param callback The function to execute
 * @param delayMs Interval in milliseconds. Pass null to pause.
 * @param immediate If true, runs the callback immediately upon mount/enable.
 */
export function usePoller(callback: () => void, delayMs: number | null, immediate: boolean = false) {
  const savedCallback = useRef(callback);

  // Remember the latest callback to avoid restarting the timer when callback ref changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delayMs === null) return;

    // Optional: Run immediately
    if (immediate) {
      savedCallback.current();
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delayMs);

    return () => clearInterval(id);
  }, [delayMs, immediate]);
}
