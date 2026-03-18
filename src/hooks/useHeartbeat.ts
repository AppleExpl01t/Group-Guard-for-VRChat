import { useEffect, useRef } from 'react';
import { getBackendUrl } from '../config';

const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Hook that sends a heartbeat to the backend every 30 seconds.
 * Only the installation UUID is sent — no personal data.
 */
export function useHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        // KILL SWITCH: do not send if cloud features are disabled
        const settings = await window.electron.settings.get();
        if (settings.system?.enableCloudFeatures === false) return;

        const installationId = await window.electron?.installationId?.get();
        if (!installationId) {
          if (import.meta.env.DEV) console.warn('[Heartbeat] No installation ID available');
          return;
        }

        const appVersion = window.electron?.getVersion?.() || 'unknown';

        // Resolve URL inside the async fn so it reflects the current config
        // rather than whatever localStorage contained at module-load time.
        const backendUrl = getBackendUrl();
        if (!backendUrl) return; // no backend configured

        await fetch(`${backendUrl}/track/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-installation-id': installationId,
          },
          body: JSON.stringify({ installationId, appVersion }),
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('[Heartbeat] Failed:', error);
        }
      }
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}

export default useHeartbeat;
