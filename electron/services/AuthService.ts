import { ipcMain } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
const logger = log.scope('AuthService');
import { saveCredentials, clearCredentials, loadCredentials, hasSavedCredentials } from './CredentialsService';
import { onUserLoggedIn, onUserLoggedOut } from './PipelineService';
import { groupAuthorizationService } from './GroupAuthorizationService';
import { getSessionStore, clearSessionStore, extractAuthCookie } from './SessionService';
import { storageService } from './StorageService';

// Re-export for backward compatibility (used by CredentialsService)
export { clearSessionStore };

// Import the VRChat SDK
import { VRChat, CurrentUser, Instance } from 'vrchat';
import { VRChatUser } from '../../src/types/electron';

// Store the VRChat SDK instance in memory (Main Process)
interface VRChatClientInternal {
  api?: {
    defaults?: {
      headers?: {
        cookie?: string;
        common?: Record<string, string>;
      };
    };
  };
  getCookies?(): Promise<{ name: string; value: string }[]>;
}

let vrchatClient: InstanceType<typeof VRChat> | null = null;
let currentUser: Record<string, unknown> | null = null;
let pendingLoginCredentials: { username: string; password: string; rememberMe?: boolean; authCookie?: string } | null = null;

// Application info for VRChat API User-Agent requirement
const APP_INFO = {
  name: 'VRChatGroupGuard',
  version: '1.0.0',
  contact: 'admin@groupguard.app'
};

// VRChat API base URL
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1';



/**
 * Try to restore a session using the persisted Keyv session store
 * Returns the user if successful, null if the session is invalid/expired
 */
async function tryRestoreSession(): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  error?: string;
}> {
  try {
    logger.debug('Attempting to restore session from persistent store...');

    // Create a client with the persistent session store
    // The SDK will automatically load any saved cookies from the Keyv store
    const clientOptions = {
      application: APP_INFO,
      baseUrl: VRCHAT_API_BASE,
      keyv: getSessionStore()
    };

    const client = new VRChat(clientOptions);

    try {
      logger.debug('Validating session...');
      const userResponse = await client.getCurrentUser({ throwOnError: true });
      const user = userResponse?.data;

      if (user && 'id' in user) {
        const validatedUser = user as CurrentUser;
        logger.info(`[Auth] Session restored: ${validatedUser.displayName}`);

        vrchatClient = client;

        if (validatedUser.id && typeof validatedUser.id === 'string') {
          validatedUser.id = validatedUser.id.trim();
        }

        currentUser = validatedUser as unknown as Record<string, unknown>;

        return { success: true, user: currentUser };
      }

      logger.debug('No user data returned, session invalid');
      return { success: false, error: 'No user data' };

    } catch (err: unknown) {
      const error = err as { response?: { status?: number }; message?: string };

      // 401 = no valid session, expected on first launch
      if (error.response?.status === 401) {
        logger.info('No valid session found (401), will need to authenticate');
        return { success: false, error: 'No valid session' };
      }

      logger.warn('Session check failed with error:', error.message || String(err));
      return { success: false, error: error.message || 'Session check failed' };
    }

  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error('Session restoration error:', err.message || String(error));
    return { success: false, error: err.message || 'Session restoration failed' };
  }
}


/**
 * Internal login function - shared between manual and auto-login
 */
export async function performLogin(username: string, password: string, twoFactorCode?: string): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  requires2FA?: boolean;
  twoFactorMethods?: string[];
  error?: string;
  authCookie?: string;
}> {
  try {
    logger.info('Attempting VRChat login...');

    const clientOptions = {
      application: APP_INFO,
      baseUrl: VRCHAT_API_BASE,
      // Use Keyv for persistent session storage (cookies persist across restarts!)
      keyv: getSessionStore(),
    };

    const client = new VRChat(clientOptions);

    // Only include twoFactorCode when provided to prevent the SDK from auto-verifying with an empty code.
    const loginOptions: { username: string; password: string; twoFactorCode?: () => string; throwOnError: boolean } = {
      username,
      password,
      throwOnError: true
    };
    if (twoFactorCode) {
      loginOptions.twoFactorCode = () => twoFactorCode;
    }

    try {
      const loginResult = await client.login(loginOptions);

      const validUser = loginResult?.data || loginResult;

      if (!validUser || !('id' in validUser)) {
        logger.error('Login response missing ID:', validUser);
        throw new Error('Login failed: Invalid user object received');
      }

      const user = validUser as Record<string, unknown>;
      if (user.id && typeof user.id === 'string') {
        user.id = user.id.trim();
      }

      const newAuthCookie = extractAuthCookie(client);

      if (!newAuthCookie) {
        logger.warn('Login successful but failed to extract auth cookie - session may not persist!');
      }

      vrchatClient = client;
      currentUser = user;

      logger.info(`User logged in successfully: ${user.displayName as string} (${user.id as string})`);

      onUserLoggedIn();

      return { success: true, user: currentUser, authCookie: newAuthCookie };

    } catch (authError: unknown) {
      // Handle authentication errors from login
      const err = authError as {
        message?: string;
        stack?: string;
        statusCode?: number;
        response?: { status?: number; data?: { error?: { message?: string }; requiresTwoFactorAuth?: string[] } };
        data?: { requiresTwoFactorAuth?: string[] };
      };

      const errorMsgSafe = err?.message || 'Unknown authentication error';
      const errorMsgLower = errorMsgSafe.toLowerCase();

      logger.info('Authentication error details:', {
        message: errorMsgSafe,
        statusCode: err?.statusCode,
        data: err?.data
      });

      const requires2FA = err?.data?.requiresTwoFactorAuth || err?.response?.data?.requiresTwoFactorAuth;
      if (requires2FA && Array.isArray(requires2FA) && requires2FA.length > 0) {
        logger.info('2FA required, methods:', requires2FA);
        vrchatClient = client;
        return {
          success: false,
          requires2FA: true,
          twoFactorMethods: requires2FA
        };
      }

      if (err?.statusCode === 401 || err?.response?.status === 401) {
        logger.warn('Authentication failed: Invalid credentials (401)');
        return {
          success: false,
          error: 'Invalid username or password. Please check your credentials and try again.'
        };
      }

      if (
        errorMsgLower.includes('two-factor') ||
        errorMsgLower.includes('2fa') ||
        errorMsgLower.includes('totp') ||
        errorMsgLower.includes('emailotp') ||
        errorMsgLower.includes('otp') ||
        errorMsgLower.includes('requires two-factor authentication')
      ) {
        vrchatClient = client;
        logger.info('2FA required (detected from error message)');
        return { success: false, requires2FA: true };
      }

      throw authError;
    }

  } catch (error: unknown) {
    const err = error as {
      message?: string;
      stack?: string;
      statusCode?: number;
      response?: { status?: number; data?: { error?: { message?: string } } };
    };
    logger.error('Login Failed (Outer Catch):', error);
    if (err?.stack) {
      logger.error('Stack Trace:', err.stack);
    }

    let errorMessage = 'Unknown login error';

    if (err?.response?.data?.error?.message) {
      errorMessage = err.response.data.error.message;
    } else if (err?.message) {
      errorMessage = err.message;
    }

    const errorMsgLower = errorMessage.toLowerCase();

    if (
      err?.statusCode === 429 ||
      errorMsgLower.includes('too many') ||
      errorMsgLower.includes('rate limit')
    ) {
      return { success: false, error: 'Too many login attempts. Please wait a few minutes and try again.' };
    }

    if (
      errorMsgLower.includes('invalid credentials') ||
      errorMsgLower.includes('incorrect password') ||
      errorMsgLower.includes('authentication failed') ||
      errorMsgLower.includes('unauthorized') ||
      errorMsgLower.includes("missing credentials")
    ) {
      return { success: false, error: 'Invalid username or password. Please check your credentials and try again.' };
    }

    if (
      errorMsgLower.includes('network') ||
      errorMsgLower.includes('econnrefused') ||
      errorMsgLower.includes('timeout') ||
      errorMsgLower.includes('fetch failed')
    ) {
      return { success: false, error: 'Unable to connect to VRChat servers. Please check your internet connection and try again.' };
    }

    if (process.env.NODE_ENV === 'development' && err?.stack) {
      errorMessage += `\n\nStack:\n${err.stack}`;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Attempt to login using a saved cookie string (bypasses 2FA if cookie is valid)
 */
async function tryLoginWithCookie(cookie: string): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  error?: string;
}> {
  try {
    logger.info('Attempting login with saved auth cookie...');

    const clientOptions = {
      application: APP_INFO,
      baseUrl: VRCHAT_API_BASE,
      keyv: getSessionStore()
    };
    const client = new VRChat(clientOptions);

    // Inject cookie into the internal HTTP client headers
    const apiClient = (client as unknown as VRChatClientInternal).api;

    if (apiClient?.defaults) {
      apiClient.defaults.headers = apiClient.defaults.headers || {};
      apiClient.defaults.headers.cookie = cookie;
      if (apiClient.defaults.headers.common) {
        apiClient.defaults.headers.common['cookie'] = cookie;
      }
      logger.debug('Injected cookie into client headers');
    } else {
      logger.warn('Could not inject cookie: client.api.defaults not found. VRChat SDK structure might have changed.');
    }

    const userResponse = await client.getCurrentUser({ throwOnError: true });
    const user = userResponse?.data || userResponse;

    if (user && 'id' in user) {
      const validatedUser = user as CurrentUser;
      logger.info(`Cookie login successful for: ${validatedUser.displayName}`);

      if (user.id && typeof user.id === 'string') user.id = user.id.trim();

      vrchatClient = client;
      currentUser = user as Record<string, unknown>;

      onUserLoggedIn();

      return { success: true, user: currentUser };
    }

    return { success: false, error: 'Cookie invalid' };

  } catch (e) {
    logger.warn('Cookie login failed:', e);
    return { success: false, error: String(e) };
  }
}

/**
 * Fetches the current user's location directly from the API.
 * Used for synchronizing log watchers on app startup.
 */
export async function fetchCurrentLocationFromApi(): Promise<string | null> {
  if (!vrchatClient) return null;
  try {
    const userRes = await vrchatClient.getCurrentUser({ throwOnError: true });
    const user = userRes?.data as { location?: string };

    if (user && user.location && user.location !== 'offline' && user.location !== '') {
      return user.location;
    }
    return null;
  } catch (e) {
    logger.warn('[AuthService] Failed to fetch current location from API:', e);
    return null;
  }
}

/**
 * Fetches the user list for a specific instance from the API.
 * Used to reconcile "Ghost" players or fill gaps in rotated logs.
 */
export async function fetchInstancePlayers(location: string): Promise<{ id: string; displayName: string }[]> {
  if (!vrchatClient) return [];
  try {
    // Parse world and instance IDs from location string (wrld_xxx:12345~...)
    const parts = location.split(':');
    if (parts.length < 2) return [];

    const worldId = parts[0];
    const instanceId = parts.slice(1).join(':'); // rejoin in case instanceId contains colons

    const resp = await vrchatClient.getInstance({
      path: {
        worldId: worldId,
        instanceId: instanceId
      }
    });

    const instance = resp.data || resp;

    if (instance && 'users' in instance && Array.isArray((instance as Instance).users)) {
      return (instance as Instance).users!.map((u: { id: string; displayName: string }) => ({
        id: u.id,
        displayName: u.displayName
      }));
    }
    return [];

  } catch (e) {
    logger.warn(`[AuthService] Failed to fetch players for ${location}`, e);
    return [];
  }
}

/**
 * Attempt session restoration via Keyv store, then saved cookie.
 * Returns the restored user on success, or null if restoration is not possible.
 */
async function tryRestoreSessionWithCookieFallback(authCookie?: string): Promise<Record<string, unknown> | null> {
  const sessionResult = await tryRestoreSession();
  if (sessionResult.success && sessionResult.user) return sessionResult.user;

  if (authCookie) {
    const cookieResult = await tryLoginWithCookie(authCookie);
    if (cookieResult.success && cookieResult.user) return cookieResult.user;
  }

  return null;
}

export function setupAuthHandlers() {
  ipcMain.handle('auth:login', async (_event, { username, password, rememberMe = false }: {
    username: string;
    password: string;
    rememberMe?: boolean;
  }) => {
    const saved = loadCredentials();

    if (saved && saved.username === username) {
      logger.info('Login matches saved user, attempting session restoration to bypass 2FA...');
      const restoredUser = await tryRestoreSessionWithCookieFallback(saved.authCookie);
      if (restoredUser) {
        logger.info('Session restored successfully during manual login!');
        return { success: true, user: restoredUser };
      }
    }

    const result = await performLogin(username, password);

    if (result.success && rememberMe) {
      saveCredentials(username, password, result.authCookie);
      logger.info('Credentials saved for auto-login');
    } else if (result.requires2FA) {
      pendingLoginCredentials = { username, password, rememberMe };
    }

    return result;
  });

  // 2FA Verification Handler
  ipcMain.handle('auth:verify2fa', async (_event, { code }: { code: string }) => {
    if (!vrchatClient || !pendingLoginCredentials) {
      return { success: false, error: "No pending login session. Please try logging in again." };
    }

    try {
      logger.info('Verifying 2FA code using existing client session...');

      const client = vrchatClient;

      let verifyResult = await client.verify2Fa({
        body: { code },
        throwOnError: false
      });
      logger.info('TOTP verify result:', JSON.stringify(verifyResult, null, 2));

      if (!verifyResult?.data?.verified) {
        logger.info('TOTP not verified, trying email OTP...');
        verifyResult = await client.verify2FaEmailCode({
          body: { code },
          throwOnError: false
        });
        logger.info('Email OTP verify result:', JSON.stringify(verifyResult, null, 2));
      }

      if (!verifyResult?.data?.verified) {
        logger.info('Email OTP not verified, trying recovery code...');
        verifyResult = await client.verifyRecoveryCode({
          body: { code },
          throwOnError: false
        });
        logger.info('Recovery code verify result:', JSON.stringify(verifyResult, null, 2));
      }

      if (!verifyResult?.data?.verified) {
        logger.warn('All 2FA verification methods failed. Full result:', JSON.stringify(verifyResult, null, 2));
        return { success: false, error: 'Invalid 2FA code. Please try again.' };
      }

      logger.info('2FA verification successful, fetching user data...');

      const userResponse = await vrchatClient.getCurrentUser({ throwOnError: true });
      const user = userResponse?.data || userResponse;

      if (!user || !('id' in user)) {
        throw new Error('Failed to get user data after 2FA verification');
      }

      const validatedUser = user as CurrentUser;
      currentUser = user as unknown as Record<string, unknown>;

      logger.info(`2FA complete, logged in as: ${validatedUser.displayName}`);

      if (pendingLoginCredentials.rememberMe) {
        const authCookie = extractAuthCookie(vrchatClient);

        if (authCookie) {
          saveCredentials(pendingLoginCredentials.username, pendingLoginCredentials.password, authCookie);
          logger.info('Credentials and cookie saved for auto-login after 2FA');
        } else {
          logger.warn('2FA successful but no cookie found to save. Auto-login might fail next time.');
          // Save credentials without cookie so username/password are still available for fallback
          saveCredentials(pendingLoginCredentials.username, pendingLoginCredentials.password, undefined);
        }
      }

      pendingLoginCredentials = null;

      onUserLoggedIn();

      return { success: true, user: currentUser };

    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      logger.error("2FA Verification Error:", error);

      const errorMessage = err.message || 'Invalid 2FA code';

      if (err.statusCode === 429 || errorMessage.toLowerCase().includes('too many')) {
        return { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' };
      }

      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('incorrect')) {
        return { success: false, error: 'Invalid 2FA code. Please try again.' };
      }

      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('auth:auto-login', async () => {
    logger.info('Checking for saved credentials for auto-login...');

    if (!hasSavedCredentials()) {
      logger.info('No saved credentials found');
      return { success: false, noCredentials: true };
    }

    const credentials = loadCredentials();
    if (!credentials) {
      logger.info('Failed to load credentials');
      return { success: false, error: 'Failed to load saved credentials' };
    }

    logger.info('Found saved credentials, attempting session restoration...');

    const restoredUser = await tryRestoreSessionWithCookieFallback(credentials.authCookie);
    if (restoredUser) {
      logger.info('Session restored successfully without re-authentication!');
      return { success: true, user: restoredUser };
    }

    logger.info('Session restoration failed, falling back to full login...');

    const result = await performLogin(credentials.username, credentials.password);

    if (result.success) {
      if (result.authCookie && result.authCookie !== credentials.authCookie) {
        saveCredentials(credentials.username, credentials.password, result.authCookie);
        logger.debug('Auth cookie updated after auto-login');
      }
    }

    if (result.requires2FA) {
      pendingLoginCredentials = {
        username: credentials.username,
        password: credentials.password,
        rememberMe: true,
        authCookie: credentials.authCookie
      };
    }

    return result;
  });

  // Check Session - returns current user if logged in
  ipcMain.handle('auth:check-session', () => {
    if (currentUser && vrchatClient) {
      return { isLoggedIn: true, user: currentUser };
    }
    return { isLoggedIn: false };
  });

  // Check if saved credentials exist
  ipcMain.handle('auth:has-saved-credentials', () => {
    return hasSavedCredentials();
  });

  // Logout Handler - optionally clears saved credentials
  ipcMain.handle('auth:logout', async (_event, { clearSaved = false }: { clearSaved?: boolean } = {}) => {
    try {
      logger.info('Logging out user...');

      // Always clear session store on logout to prevent session reuse
      await clearSessionStore();
      logger.info('Session store cleared on logout');

      if (clearSaved) {
        clearCredentials();
        logger.info('Saved credentials cleared (user requested removal)');
      } else {
        logger.info('Saved credentials preserved (logout only cleared active session)');
      }
    } catch (e) {
      logger.warn('Logout cleanup:', e);
    }

    vrchatClient = null;
    currentUser = null;
    pendingLoginCredentials = null;

    groupAuthorizationService.clearAllowedGroups();
    onUserLoggedOut();

    return { success: true };
  });

}

export function getVRChatClient() {
  logger.debug(`getVRChatClient called. Result exists: ${!!vrchatClient}`);
  return vrchatClient;
}

export function isAuthenticated(): boolean {
  return vrchatClient !== null && currentUser !== null;
}

export function getCurrentUserId(): string | null {
  logger.debug(`getCurrentUserId called. ID: ${currentUser?.id}`);
  return currentUser?.id as string | null;
}

export async function getAuthCookieStringAsync(): Promise<string | undefined> {
  // Strategy 1: SDK's getCookies method (preferred)
  if (vrchatClient) {
    try {
      const clientAny = vrchatClient as unknown as VRChatClientInternal;
      if (typeof clientAny.getCookies === 'function') {
        const cookies = await clientAny.getCookies();
        if (Array.isArray(cookies) && cookies.length > 0) {
          logger.debug(`[Cookie] Got ${cookies.length} cookies from SDK getCookies()`);
          return cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }
      }
    } catch (e) {
      logger.warn('[Cookie] Failed to get cookies from SDK:', e);
    }
  }

  // Strategy 2: Sync extraction
  const syncCookie = extractAuthCookie(vrchatClient);
  if (syncCookie) return syncCookie;

  // Strategy 3: Saved credentials
  const saved = loadCredentials();
  if (saved?.authCookie) {
    logger.debug('Using saved authCookie from credentials store (fallback)');
    return saved.authCookie;
  }

  // Strategy 4: Keyv session store file
  try {
    const sessionFilePath = path.join(storageService.getDataDir(), 'vrchat-session.json');
    const data = JSON.parse(fs.readFileSync(sessionFilePath, 'utf-8'));
    // Keyv stores with namespace prefix, e.g., "vrchat:cookies"
    const cookieKey = Object.keys(data).find(k => k.includes('cookie'));
    if (cookieKey && data[cookieKey]) {
      let cookieValue = data[cookieKey];
      // Keyv wraps values in { value: ..., expires: ... }
      if (cookieValue.value) cookieValue = cookieValue.value;
      if (typeof cookieValue === 'string') {
        logger.debug('Using cookie from Keyv session store file');
        return cookieValue;
      } else if (Array.isArray(cookieValue)) {
        return cookieValue.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ');
      }
    }
  } catch (e) {
    logger.warn('Failed to read session store file:', e);
  }

  return undefined;
}

// Sync fallback — cannot access the async getCookies() method; prefer getAuthCookieStringAsync
export function getAuthCookieString(): string | undefined {
  const cookie = vrchatClient ? extractAuthCookie(vrchatClient) : undefined;
  if (cookie) return cookie;

  const saved = loadCredentials();
  if (saved?.authCookie) {
    logger.debug('Using saved authCookie from credentials store (fallback)');
    return saved.authCookie;
  }

  return undefined;
}

export async function checkOnlineStatus(): Promise<boolean> {
  if (!vrchatClient || !currentUser) return false;

  try {
    const userResponse = await vrchatClient.getCurrentUser();
    const user = userResponse?.data || userResponse;

    const u = user as unknown as VRChatUser;
    if (u && (u.state === 'offline' || u.status === 'offline')) {
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('Failed to check online status:', error);
    return false;
  }
}
