export type BackendEnv = 'local' | 'prod';

const ENV_KEY = 'groupguard_env';

// URLs come from build-time env vars.  No fallback IP is intentional —
// a missing VITE_PROD_API_URL in production is a misconfiguration that
// should be visible rather than silently pointing at a stale address.
const LOCAL_URL = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:3001/api/v1';
const PROD_URL  = import.meta.env.VITE_PROD_API_URL  || '';   // must be HTTPS in production

if (import.meta.env.PROD && !PROD_URL) {
  console.error('[config] VITE_PROD_API_URL is not set. Cloud features will not work.');
}

/**
 * Return the currently selected backend environment.
 * In production builds this always returns 'prod' — only dev builds allow
 * toggling via localStorage so that accidental prod-from-local mistakes can't
 * happen in shipped apps.
 */
export const getBackendEnv = (): BackendEnv => {
  if (import.meta.env.PROD) return 'prod';
  return (localStorage.getItem(ENV_KEY) as BackendEnv) || 'local';
};

export const setBackendEnv = (env: BackendEnv) => {
  if (import.meta.env.PROD) return; // no-op in production
  localStorage.setItem(ENV_KEY, env);
  window.location.reload();
};

export const getBackendUrl = (): string => {
  const env = getBackendEnv();
  return env === 'prod' ? PROD_URL : LOCAL_URL;
};
