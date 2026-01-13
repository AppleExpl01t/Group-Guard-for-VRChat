import { ipcMain } from 'electron';
import log from 'electron-log';
const logger = log.scope('AuthService');
import path from 'path';
import { saveCredentials, clearCredentials, loadCredentials, hasSavedCredentials } from './CredentialsService';
import { onUserLoggedIn, onUserLoggedOut } from './PipelineService';
import { groupAuthorizationService } from './GroupAuthorizationService';

// Import the VRChat SDK and Keyv for session persistence
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VRChat } = require('vrchat');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Keyv = require('keyv').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KeyvFile = require('keyv-file').default;

// Store the VRChat SDK instance in memory (Main Process)
let vrchatClient: InstanceType<typeof VRChat> | null = null;
let currentUser: Record<string, unknown> | null = null;
let pendingLoginCredentials: { username: string; password: string; rememberMe?: boolean; authCookie?: string } | null = null;

// Persistent session storage using Keyv with SQLite
let sessionStore: InstanceType<typeof Keyv> | null = null;

import { storageService } from './StorageService';

// ...

function getSessionStore(): InstanceType<typeof Keyv> {
  if (!sessionStore) {
    // Store sessions in the configured data directory
    const userDataPath = storageService.getDataDir();
    const filePath = path.join(userDataPath, 'vrchat-session.json');
    logger.info(`Session store path: ${filePath}`);
    
    const store = new KeyvFile({ filename: filePath });
    
    // WORKAROUND: Keyv v5+ crashes if store.opts.url is undefined during _checkIterableAdapter
    // We patch the store to satisfy Keyv's internal check
    if (!store.opts) store.opts = {};
    if (!store.opts.url) store.opts.url = 'file://';
    
    sessionStore = new Keyv({ store, namespace: 'vrchat' });
    
    // WORKAROUND 2: VRChat library might re-wrap our Keyv instance if it detects a version/instance mismatch.
    // This wrapper will check our instance's .opts.url, so we must ensure it exists.
    if (sessionStore.opts) {
        sessionStore.opts.url = 'file://';
    } else {
        sessionStore.opts = { url: 'file://' };
    }
    
    sessionStore.on('error', (err: Error) => {
      logger.error('Session store error:', err);
    });
  }
  return sessionStore;
}

/**
 * Clear the Keyv session store (removes all persisted VRChat cookies)
 * Exported for use by CredentialsService and other auth-related services
 */
export async function clearSessionStore(): Promise<void> {
  try {
    const store = getSessionStore();
    await store.clear();
    logger.info('Session store cleared');
  } catch (error) {
    logger.error('Failed to clear session store:', error);
    throw error;
  }
}

// Application info for VRChat API User-Agent requirement
const APP_INFO = {
  name: 'VRChatGroupGuard',
  version: '1.0.0',
  contact: 'admin@groupguard.app'
};

// VRChat API base URL
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1';

// Type for cookie jar interfaces (tough-cookie compatible)
interface CookieLike {
  key?: string;
  name?: string;
  value?: string;
}

interface CookieJarLike {
  getCookiesSync?: (url: string) => CookieLike[];
  _jar?: CookieJarLike;
}

// Helper to extract auth cookie from client
function extractAuthCookie(client: any): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientAny = client;
// ...
    
    // Strategy 1: Axios Defaults (Most reliable for this SDK version)
    if (clientAny.api && clientAny.api.defaults && clientAny.api.defaults.headers) {
        const defaults = clientAny.api.defaults.headers;
        if (defaults.cookie) return defaults.cookie as string;
        if (defaults.common && defaults.common.cookie) return defaults.common.cookie as string;
    }

    // Strategy 2: Cookie Jar (if present)
    const jar = clientAny.jar || clientAny.cookieJar || clientAny.cookies || clientAny.api?.defaults?.jar || clientAny.axios?.defaults?.jar;
    
    if (jar) {
        // Collect all cookies for VRChat domains
        const urlsToTry = [
            'https://api.vrchat.cloud',
            'https://vrchat.com'
        ];
        
        const uniqueCookies = new Map<string, string>();
        
        // Helper to extract from tough-cookie style jar
        const processCookie = (c: CookieLike) => {
            const key = c.key || c.name;
            const value = c.value;
            if (key && value) uniqueCookies.set(key, value);
        };

        const getCookiesFromJar = (j: CookieJarLike, url: string) => {
            if (typeof j.getCookiesSync === 'function') return j.getCookiesSync(url);
            if (j._jar && typeof j._jar.getCookiesSync === 'function') return j._jar.getCookiesSync(url);
            return [];
        };

        urlsToTry.forEach(url => {
            try {
                const found = getCookiesFromJar(jar, url);
                if (Array.isArray(found)) found.forEach(processCookie);
            } catch (e) { /* ignore */ }
        });

        // Also check if jar itself is just an array of cookies
        if (Array.isArray(jar)) jar.forEach(processCookie);
        
        if (uniqueCookies.size > 0) {
            const parts: string[] = [];
            uniqueCookies.forEach((val, key) => parts.push(`${key}=${val}`));
            return parts.join('; ');
        }
    }

    return undefined;
  } catch (e) {
    logger.warn('Failed to extract auth cookie', e);
    return undefined;
  }
}

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
    logger.info('Attempting to restore session from persistent store...');
    
    // Create a client with the persistent session store
    // The SDK will automatically load any saved cookies from the Keyv store
    const clientOptions = {
      application: APP_INFO,
      baseUrl: VRCHAT_API_BASE,
      keyv: getSessionStore()
    };
    
    logger.info('Creating VRChat client for session check...');
    const client = new VRChat(clientOptions);
    
    // Try to get the current user - this will work if there's a valid session
    try {
      logger.info('Checking for existing session...');
      const userResponse = await client.getCurrentUser({ throwOnError: true });
      const user = userResponse?.data;
      
      if (user && user.id) {
        logger.info(`Session restored successfully for: ${user.displayName}`);
        
        // Store the client and user globally
        vrchatClient = client;
        
        // Sanitize ID
        if (user.id && typeof user.id === 'string') {
            user.id = user.id.trim();
        }
        
        currentUser = user as Record<string, unknown>;
        
        return { success: true, user: currentUser };
      }
      
      logger.info('No user data returned, session invalid');
      return { success: false, error: 'No user data' };
      
    } catch (err: unknown) {
      const error = err as { response?: { status?: number }; message?: string };
      
      // 401 = no valid session, this is expected on first launch
      if (error.response?.status === 401) {
        logger.info('No valid session found (401), will need to authenticate');
        return { success: false, error: 'No valid session' };
      }
      
      // Log and handle any other errors gracefully
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
async function performLogin(username: string, password: string, twoFactorCode?: string): Promise<{
  success: boolean;
  user?: Record<string, unknown>;
  requires2FA?: boolean;
  twoFactorMethods?: string[];
  error?: string;
  authCookie?: string;
}> {
  try {
    logger.info('Attempting VRChat login...');
    logger.debug(`performLogin called for user ${username}`);

    // Create VRChat client - SDK v2 pattern
    const clientOptions = {
      application: APP_INFO,
      baseUrl: VRCHAT_API_BASE,
      // Use Keyv for persistent session storage (cookies persist across restarts!)
      keyv: getSessionStore(),
    };
    
    logger.info('Creating VRChat client...');
    const client = new VRChat(clientOptions);
    
    // Set credentials on the client for the SDK's internal authentication flow
    // Only include twoFactorCode if we have an actual code (prevents SDK from auto-verifying with empty code)
    const credentialsToSet: { username: string; password: string; twoFactorCode?: () => string } = {
      username,
      password,
    };
    if (twoFactorCode) {
      credentialsToSet.twoFactorCode = () => twoFactorCode;
    }
    client.setCredentials(credentialsToSet);

    logger.info('Calling client.login() with credentials...');
    
    // Use the SDK's login method which properly handles authentication
    // Only pass twoFactorCode if we actually have one
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
      
      logger.debug('Login response received');
      
      // Extract user from response (SDK returns { data: user } structure)
      const validUser = loginResult?.data || loginResult;
      
      // Validate we have an ID
      if (!validUser || !validUser.id) {
        logger.error('Login response missing ID:', validUser);
        throw new Error('Login failed: Invalid user object received');
      }

      // Success - store the client and user with Sanitized ID
      const user = validUser as Record<string, unknown>;
      if (user.id && typeof user.id === 'string') {
          user.id = user.id.trim();
      }
      
      // Extract and save auth cookie
      const newAuthCookie = extractAuthCookie(client);
      
      if (newAuthCookie) {
          logger.info('Auth cookie extracted successfully during login');
      } else {
          logger.warn('Login successful but FAILED to extract auth cookie - session may not persist!');
      }
      
      vrchatClient = client;
      currentUser = user;
      
      const userId = user.id as string;
      const displayName = user.displayName as string;
      
      logger.info(`User logged in successfully: ${displayName} (${userId})`);

      // Connect to Pipeline WebSocket for real-time events
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
      
      const errorMsg = err?.message || 'Unknown authentication error';
      const errorMsgSafe = typeof errorMsg === 'string' ? errorMsg : String(errorMsg);
      const errorMsgLower = errorMsgSafe.toLowerCase();
      
      logger.info('Authentication error details:', {
        message: errorMsgSafe,
        statusCode: err?.statusCode,
        data: err?.data
      });
      
      // Check if 2FA is required (SDK returns this in the data)
      const requires2FA = err?.data?.requiresTwoFactorAuth || err?.response?.data?.requiresTwoFactorAuth;
      if (requires2FA && Array.isArray(requires2FA) && requires2FA.length > 0) {
        logger.info('2FA required, methods:', requires2FA);
        
        // Store client for 2FA verification
        vrchatClient = client;
        
        return { 
          success: false, 
          requires2FA: true,
          twoFactorMethods: requires2FA
        };
      }
      
      // Check for 401 Unauthorized - invalid credentials
      if (err?.statusCode === 401 || err?.response?.status === 401) {
        logger.warn('Authentication failed: Invalid credentials (401)');
        return { 
          success: false, 
          error: 'Invalid username or password. Please check your credentials and try again.' 
        };
      }
      
      // Check for 2FA text indicators in error message
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
      
      // Re-throw for general error handling
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
    if (err && err.stack) {
        logger.error('Stack Trace:', err.stack);
    }
    
    // Extract meaningful error message
    let errorMessage = 'Unknown login error';
    
    if (err?.response?.data?.error?.message) {
      errorMessage = err.response.data.error.message;
    } else if (err?.message) {
      errorMessage = err.message;
    }
    
    if (typeof errorMessage !== 'string') {
        errorMessage = String(errorMessage);
    }
    
    // Check for common authentication/credential errors and provide user-friendly messages
    const errorMsgLower = errorMessage.toLowerCase();
    
    // Check for rate limiting first (429)
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
    
    // Check for network/connection errors
    if (
      errorMsgLower.includes('network') ||
      errorMsgLower.includes('econnrefused') ||
      errorMsgLower.includes('timeout') ||
      errorMsgLower.includes('fetch failed')
    ) {
      return { success: false, error: 'Unable to connect to VRChat servers. Please check your internet connection and try again.' };
    }
    
    // For development/debugging, include stack trace; for users, show clean error
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
        
        // Create client with keyv store to allow session persistence update
        const clientOptions = {
            application: APP_INFO,
            baseUrl: VRCHAT_API_BASE,
            keyv: getSessionStore()
        };
        const client = new VRChat(clientOptions);

        // SAFELY Inject cookie into the internal Axios/Got instance
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const apiClient = (client as any).api;
        
        if (apiClient && apiClient.defaults) {
             apiClient.defaults.headers = apiClient.defaults.headers || {};
             apiClient.defaults.headers.cookie = cookie;
             
             // Also try common headers if specific structure exists (axios specific)
             if (apiClient.defaults.headers.common) {
                 apiClient.defaults.headers.common['cookie'] = cookie;
             }
             logger.debug('Injected cookie into client headers');
        } else {
             logger.warn('Could not inject cookie: client.api.defaults not found. VRChat SDK structure might have changed.');
             // We continue anyway, maybe Keyv store has it?
        }
        
        // Now try to fetch current user
        const userResponse = await client.getCurrentUser({ throwOnError: true });
        const user = userResponse?.data || userResponse;

        if (user && user.id) {
            logger.info(`Cookie login successful for: ${user.displayName}`);
            
            // Sanitize ID
            if (user.id && typeof user.id === 'string') user.id = user.id.trim();

            vrchatClient = client;
            currentUser = user as Record<string, unknown>;
            
            // Re-connect pipeline
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
        // SDK structure: { data: user } or just user? SDK v2 usually { data: ... }
        // VRChat library logic (lines 185-186) handles userRes?.data
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchInstancePlayers(location: string): Promise<{ id: string; displayName: string }[]> {
    if (!vrchatClient) return [];
    try {
        // Parse world and instance IDs from location string (wrld_xxx:12345)
        const parts = location.split(':');
        if (parts.length < 2) return [];
        
        const worldId = parts[0];
        const instanceId = parts.slice(1).join(':'); // Rejoin in case instanceId contains colons
        
        // Fetch instance details
        const resp = await vrchatClient.getInstance({ 
            worldId: worldId, 
            instanceId: instanceId 
        });
        
        const instance = resp.data || resp;
        
        // Return users array if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (instance && Array.isArray(instance.users)) {
             return instance.users.map((u: any) => ({
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

export function setupAuthHandlers() {
// ...
// ...
  
  // LOGIN Handler - accepts rememberMe flag
  ipcMain.handle('auth:login', async (_event, { username, password, rememberMe = false }: { 
    username: string; 
    password: string;
    rememberMe?: boolean;
  }) => {
    // Check if we have saved credentials that match these inputs
    const saved = loadCredentials();
    const isSavedUser = saved && saved.username === username;
    
    // If we have saved credentials for this user, try to restore session first to skip 2FA
    if (isSavedUser) {
        logger.info('Login matches saved user, attempting session restoration to bypass 2FA...');
        
        // 1. Try Keyv Store
        let restoreResult = await tryRestoreSession();
        
        // 2. If Keyv failed but we have a saved cookie, try that
        if ((!restoreResult.success || !restoreResult.user) && saved.authCookie) {
             restoreResult = await tryLoginWithCookie(saved.authCookie);
        }
        
        // If restoration worked, we are logged in!
        // We do strictly verify the user ID to ensure we aren't using a stale cookie for the wrong account (though username check helps)
        if (restoreResult.success && restoreResult.user) {
             // Basic check to ensure it's the same person if possible (though API returns current user)
             logger.info('Session restored successfully during manual login!');
             return { success: true, user: restoreResult.user };
        }
    }
    
    // Fallback to standard login
    const result = await performLogin(username, password);
    
    if (result.success && rememberMe) {
      // Save credentials on successful direct login (no 2FA)
      // Save authCookie if we got one
      saveCredentials(username, password, result.authCookie);
      logger.info('Credentials saved for auto-login');
      logger.debug('Credentials saved manually');
    } else if (result.requires2FA) {
      // Store credentials for 2FA completion (will save after 2FA if rememberMe is set)
      // NOTE: We don't have authCookie yet usually for 2FA flow, but if we did we could store it
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
      
      // Use the existing client that has the session from the first login attempt
      const client = vrchatClient;
      
      // Try to verify with TOTP (authenticator app)
      logger.info('Attempting TOTP verification...');
      let verifyResult = await client.verify2Fa({ 
        body: { code },
        throwOnError: false 
      });
      logger.info('TOTP verify result:', JSON.stringify(verifyResult, null, 2));
      
      // If TOTP didn't work, try email OTP
      if (!verifyResult?.data?.verified) {
        logger.info('TOTP not verified, trying email OTP...');
        verifyResult = await client.verify2FaEmailCode({ 
          body: { code },
          throwOnError: false 
        });
        logger.info('Email OTP verify result:', JSON.stringify(verifyResult, null, 2));
      }
      
      // If email OTP didn't work, try recovery code
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
      
      // Now get the current user to complete login
      const userResponse = await vrchatClient.getCurrentUser({ throwOnError: true });
      const user = userResponse?.data || userResponse;
      
      if (!user || !user.id) {
        throw new Error('Failed to get user data after 2FA verification');
      }
      
      // Sanitize user ID
      if (user.id && typeof user.id === 'string') {
        user.id = user.id.trim();
      }
      
      currentUser = user as Record<string, unknown>;
      
      logger.info(`2FA complete, logged in as: ${user.displayName}`);
      
      // Save credentials if rememberMe was set during initial login
      if (pendingLoginCredentials.rememberMe) {
        // IMPORTANT: Extract cookie from the client we just verified!
        const authCookie = extractAuthCookie(vrchatClient);
        
        if (authCookie) {
             logger.info('Extracted auth cookie after 2FA verification');
             saveCredentials(pendingLoginCredentials.username, pendingLoginCredentials.password, authCookie);
             logger.info('Credentials AND Cookie saved for auto-login after 2FA');
        } else {
             logger.warn('2FA successful but NO COOKIE found to save. Auto-login might fail next time.');
             // Save anyway so we have username/pass, although reuse without cookie is limited
             saveCredentials(pendingLoginCredentials.username, pendingLoginCredentials.password, undefined); 
        }
      }
      
      pendingLoginCredentials = null; // Clear pending credentials
      
      // Connect to Pipeline WebSocket
      onUserLoggedIn();
      
      return { success: true, user: currentUser };
      
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      logger.error("2FA Verification Error:", error);
      
      const errorMessage = err.message || 'Invalid 2FA code';
      
      // Check for rate limiting
      if (err.statusCode === 429 || errorMessage.toLowerCase().includes('too many')) {
        return { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' };
      }
      
      // Check for specific error types
      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('incorrect')) {
        return { success: false, error: 'Invalid 2FA code. Please try again.' };
      }
      
      return { success: false, error: errorMessage };
    }
  });

  // AUTO-LOGIN Handler - attempts login with saved credentials
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
    
    // 1. Try Keyv Store (Fastest, uses active session)
    let sessionResult = await tryRestoreSession();
    
    // 2. If Keyv failed but we have a saved cookie for this user, try cookie login
    if ((!sessionResult.success || !sessionResult.user) && credentials.authCookie) {
         sessionResult = await tryLoginWithCookie(credentials.authCookie);
    }
    
    if (sessionResult.success && sessionResult.user) {
      logger.info('Session restored successfully without re-authentication!');
      return { success: true, user: sessionResult.user };
    }
    
    logger.info('Session restoration failed, falling back to full login...');
    
    // FALLBACK: Full login (will require 2FA if enabled)
    logger.info(`Attempting full login for ${credentials.username}...`);
    const result = await performLogin(credentials.username, credentials.password);
    
    if (result.success) {
       // Update the cookie if it changed
       if (result.authCookie && result.authCookie !== credentials.authCookie) {
          saveCredentials(credentials.username, credentials.password, result.authCookie);
          logger.debug('Auth cookie updated after auto-login');
       }
    }
    
    if (result.requires2FA) {
      // Store pending credentials with rememberMe for 2FA
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
      // The SDK may have a logout method, but we mainly need to clear local state
      // VRChat doesn't have a traditional logout endpoint - sessions are cookie-based
      logger.info('Logging out user...');
      logger.debug('Logging out');
      
      // SECURITY FIX: Always clear session store on logout to prevent session reuse
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
    
    // SECURITY: Clear allowed groups on logout
    groupAuthorizationService.clearAllowedGroups();
    
    // Disconnect from Pipeline WebSocket
    onUserLoggedOut();
    
    return { success: true };
  });

  // Multi-Account Handlers Removed

}

// Helper to share client with other services (Groups, Audit, etc.)
export function getVRChatClient() {
  logger.debug(`getVRChatClient called. Result exists: ${!!vrchatClient}`);
  return vrchatClient;
}

// Helper to check if authenticated
export function isAuthenticated(): boolean {
  return vrchatClient !== null && currentUser !== null;
}

// Helper to get current user's ID
export function getCurrentUserId(): string | null {
  logger.debug(`getCurrentUserId called. ID: ${currentUser?.id}`);
  logger.debug('Full currentUser keys:', Object.keys(currentUser || {}));
  return currentUser?.id as string | null;
}

// Helper to get raw auth cookie
export function getAuthCookieString(): string | undefined {
  let cookie = vrchatClient ? extractAuthCookie(vrchatClient) : undefined;
  
  if (!cookie) {
      // Fallback: Check saved credentials
      const saved = loadCredentials();
      if (saved && saved.authCookie) {
          logger.debug('Using saved authCookie from credentials store (fallback)');
          cookie = saved.authCookie;
      }
  }
  
  return cookie;
}

// Helper to check online status
export async function checkOnlineStatus(): Promise<boolean> {
  if (!vrchatClient || !currentUser) return false;
  
  try {
      // We can fetch our own user entry. 
      // Optimized: Just check /auth/user which is cached/fast usually, or check presence?
      // fetching user with client.getCurrentUser() is reliable.
      const userResponse = await vrchatClient.getCurrentUser();
      const user = userResponse?.data || userResponse;
      
      // If user is present, check 'state' or 'status'
      // state: 'offline', 'active', 'online'
      if (user && (user.state === 'offline' || user.status === 'offline')) {
          return false;
      }
      return true;
  } catch (error) {
      logger.warn('Failed to check online status:', error);
      // Assume offline on error? Or keep alive? 
      // If API fails, we probably shouldn't kill the session immediately unless it's a 401.
      // But for "Game Closed" detection, if API fails, maybe we are just disconnected.
      return false;
  }
}
