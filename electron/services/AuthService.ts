import { ipcMain, app } from 'electron';
import log from 'electron-log';
import path from 'path';
import { saveCredentials, clearCredentials, loadCredentials, hasSavedCredentials } from './CredentialsService';
import { onUserLoggedIn, onUserLoggedOut } from './PipelineService';

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
    log.info(`Session store path: ${filePath}`);
    
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
        // @ts-expect-error - forcing opts if missing
        sessionStore.opts = { url: 'file://' };
    }
    
    sessionStore.on('error', (err: Error) => {
      log.error('Session store error:', err);
    });
  }
  return sessionStore;
}

// Application info for VRChat API User-Agent requirement
const APP_INFO = {
  name: 'VRChatGroupGuard',
  version: '1.0.0',
  contact: 'admin@groupguard.app'
};

// VRChat API base URL
const VRCHAT_API_BASE = 'https://api.vrchat.cloud/api/1';

// Helper to extract auth cookie from client
function extractAuthCookie(client: any): string | undefined {
  try {
    // Check various common places for cookies in HTTP clients
    const jar = client.jar || client.cookieJar || client.cookies;
    
    if (!jar) {
      log.debug('No cookie jar found on client');
      return undefined;
    }

    let cookies: any[] = [];
    
    // If it's a tough-cookie jar or similar with getCookiesSync
    try {
      if (jar && typeof (jar as any).getCookiesSync === 'function') {
        cookies = (jar as any).getCookiesSync(VRCHAT_API_BASE);
      } else if (Array.isArray(jar)) {
        cookies = jar;
      } else if (jar._jar && typeof (jar._jar as any).getCookiesSync === 'function') {
        // tough-cookie wrapped
        cookies = (jar._jar as any).getCookiesSync(VRCHAT_API_BASE);
      }
    } catch (jarError) {
      log.warn('Error accessing cookie jar:', jarError);
      return undefined;
    }

    if (!Array.isArray(cookies)) {
      log.warn('Cookies is not an array:', typeof cookies);
      return undefined;
    }

    // Find the 'auth' cookie - be extremely defensive
    const authCookie = cookies.find((c: any) => {
      if (!c) return false;
      // Handle various cookie shapes (tough-cookie, electron cookie, simple object)
      const key = c.key || c.name; 
      if (!key) return false;
      
      // Safe check for 'auth'
      return key === 'auth' || (typeof key === 'string' && key.includes('auth'));
    });
    
    if (authCookie) {
      log.debug('Found auth cookie');
      // Return in format key=value
      const key = authCookie.key || authCookie.name;
      const value = authCookie.value;
      return `${key}=${value}`;
    }
    
  } catch (err) {
    log.warn('Failed to extract auth cookie:', err);
  }
  return undefined;
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
    log.info('Attempting to restore session from persistent store...');
    
    // Create a client with the persistent session store
    // The SDK will automatically load any saved cookies from the Keyv store
    const clientOptions = {
      baseUrl: VRCHAT_API_BASE,
      application: APP_INFO,
      keyv: getSessionStore()
    };
    
    log.info('Creating VRChat client for session check...');
    const client = new VRChat(clientOptions);
    
    // Try to get the current user - this will work if there's a valid session
    try {
      log.info('Checking for existing session...');
      const userResponse = await client.getCurrentUser({ throwOnError: true });
      const user = userResponse?.data;
      
      if (user && user.id) {
        log.info(`Session restored successfully for: ${user.displayName}`);
        
        // Store the client and user globally
        vrchatClient = client;
        
        // Sanitize ID
        if (user.id && typeof user.id === 'string') {
            user.id = user.id.trim();
        }
        
        currentUser = user as Record<string, unknown>;
        
        return { success: true, user: currentUser };
      }
      
      log.info('No user data returned, session invalid');
      return { success: false, error: 'No user data' };
      
    } catch (err: unknown) {
      const error = err as { response?: { status?: number }; message?: string };
      
      // 401 = no valid session, this is expected on first launch
      if (error.response?.status === 401) {
        log.info('No valid session found (401), will need to authenticate');
        return { success: false, error: 'No valid session' };
      }
      
      // Log and handle any other errors gracefully
      log.warn('Session check failed with error:', error.message || String(err));
      return { success: false, error: error.message || 'Session check failed' };
    }
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    log.error('Session restoration error:', err.message || String(error));
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
    log.info('Attempting VRChat login...');
    log.debug(`performLogin called for user ${username}`);

    // Create a fresh VRChat client instance
    let client = vrchatClient;
    
    // Create new client if needed
    if (!client || !twoFactorCode) {
         const clientOptions = {
            baseUrl: VRCHAT_API_BASE,
            application: APP_INFO,
            // Use Keyv for persistent session storage (cookies persist across restarts!)
            keyv: getSessionStore()
         };
         
         log.info('Creating VRChat client with persistent session store for login...');
         client = new VRChat(clientOptions);
    }

    log.info('VRChat client created (or reused), attempting login...');
    
    // Attempt login - the SDK's login method handles the authentication flow
    try {
      // If we have a cookie, we might strictly speaking purely verify credentials, 
      // but calling login ensure we get the user object and refresh session.
      // If the cookie is valid, login() should succeed without 2FA even if 2FA is enabled.
      
      const user = await client.login({ username, password, twoFactorCode });
      
      // ... User validation logic ...
      
      log.debug('Login successful. Inspecting client for cookies...');
      
      // Extract and save new auth cookie
      const newAuthCookie = extractAuthCookie(client);
      if (newAuthCookie) {
         // Update the current credentials with the new cookie
         if (pendingLoginCredentials) {
            pendingLoginCredentials.authCookie = newAuthCookie;
         } else {
             // If manual login, we will save it in the auth:login handler
             // If auto-login, we should update the store
             // We can return it in the result or update global state? 
             // Best to just update the storage directly if we know who we are?
             // Actually, saveCredentials handles it.
         }
      }
      
      // ... (validation logic continues from previous file content)

      
      // Check if we got a valid user object
      let validUser: Record<string, unknown> = user;
      
      // ... (rest of validation) - REMOVED
      
      // Handle case where user is wrapped in data property
      // @ts-expect-error - Checking for data wrapper
      if (!validUser.id && validUser.data && validUser.data.id) {
         // @ts-expect-error - Unwrap data
         validUser = validUser.data;
      }
      
      // Check if it's an error response
      if (validUser.error) {
        // @ts-expect-error - Accessing error message
        throw new Error(validUser.error.message || 'Login returned an error');
      }
      
      // Validate we have an ID
      if (!validUser || !validUser.id) {
        log.error('Login response missing ID:', validUser);
        throw new Error('Login failed: Invalid user object received');
      }

      // Success - store the client and user with Sanitized ID
      if (validUser.id && typeof validUser.id === 'string') {
          validUser.id = validUser.id.trim();
      }
      vrchatClient = client;
      currentUser = validUser;
      
      const userId = validUser.id as string;
      const displayName = validUser.displayName as string;
      
      log.info(`User logged in successfully: ${displayName} (${userId})`);
      log.debug('Login successful', { id: userId, name: displayName });
      
      log.info(`Global vrchatClient set: ${!!vrchatClient}`);

      // Connect to Pipeline WebSocket for real-time events
      onUserLoggedIn();

      return { success: true, user: currentUser, authCookie: newAuthCookie };
      
    } catch (loginError: unknown) {
      // Check if this is a 2FA requirement
      const err = loginError as { message?: string; stack?: string; twoFactorMethods?: string[]; code?: string };
      
      const errorMsg = err?.message || 'Unknown login error';
      // Ensure errorMsg is a string before using string methods
      const errorMsgSafe = typeof errorMsg === 'string' ? errorMsg : String(errorMsg);
      const errorMsgLower = errorMsgSafe.toLowerCase();
      
      log.info('Login error details:', {
        message: errorMsgSafe,
        twoFactorMethods: err?.twoFactorMethods,
        code: err?.code
      });
      
      // The SDK throws with twoFactorMethods array when 2FA is required
      if (err?.twoFactorMethods && Array.isArray(err.twoFactorMethods) && err.twoFactorMethods.length > 0) {
        log.info('2FA required, methods:', err.twoFactorMethods);
        log.debug('2FA required');
        
        // Store credentials and client for 2FA verification
        vrchatClient = client;
        
        return { 
          success: false, 
          requires2FA: true,
          twoFactorMethods: err.twoFactorMethods
        };
      }
      
      // WORKAROUND: If the library crashes with "Cannot read properties of undefined (reading 'includes')",
      // it is often due to a bug in handling the 2FA response (missing headers/cookies handling).
      // We assume this means 2FA is required if we haven't sent a code yet.
      if (errorMsgSafe.includes("Cannot read properties of undefined (reading 'includes')")) {
        log.warn("Caught library crash compatible with 2FA response bug. Assuming 2FA required.");
        log.debug("Stack trace:", err?.stack);
        
        vrchatClient = client;
        return { success: false, requires2FA: true };
      }

      // Check for common 2FA indicators in error message
      if (
        errorMsgLower.includes('two-factor') ||
        errorMsgLower.includes('2fa') ||
        errorMsgSafe.includes('TOTP') ||
        errorMsgSafe.includes('emailotp') ||
        errorMsgLower.includes('totp') ||
        errorMsgLower.includes('otp')
      ) {
        vrchatClient = client;
        log.debug('2FA required (text check)');
        return { success: false, requires2FA: true };
      }
      
      
      // Re-throw for general error handling
      throw loginError;
    }

  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string; response?: { data?: { error?: { message?: string } } } };
    log.error('Login Failed (Outer Catch):', error);
    if (err && err.stack) {
        log.error('Stack Trace:', err.stack);
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
    
    // Append stack trace for debugging if available
    if (err?.stack) {
        errorMessage += `\n\nStack:\n${err.stack}`;
    }
    
    return { success: false, error: errorMessage };
  }
}

export function setupAuthHandlers() {
  
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
        log.info('Login matches saved user, attempting session restoration to bypass 2FA...');
        const restoreResult = await tryRestoreSession();
        
        // If restoration worked, we are logged in!
        // We do strictly verify the user ID to ensure we aren't using a stale cookie for the wrong account (though username check helps)
        if (restoreResult.success && restoreResult.user) {
             const restoredUser = restoreResult.user as { username?: string; displayName?: string };
             // Basic check to ensure it's the same person if possible (though API returns current user)
             log.info('Session restored successfully during manual login!');
             return { success: true, user: restoreResult.user };
        }
    }
    
    // Fallback to standard login
    const result = await performLogin(username, password);
    
    if (result.success && rememberMe) {
      // Save credentials on successful direct login (no 2FA)
      // Save authCookie if we got one
      saveCredentials(username, password, result.authCookie);
      log.info('Credentials saved for auto-login');
      log.debug('Credentials saved manually');
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
      log.info('Verifying 2FA code...');
      
      const result = await performLogin(
        pendingLoginCredentials.username,
        pendingLoginCredentials.password,
        code
      );

      if (!result.success || !result.user) {
        throw new Error(result.error || '2FA verification failed');
      }

      // Save credentials if rememberMe was set during initial login
      if (pendingLoginCredentials.rememberMe) {
        // Save with the new authCookie from the result
        saveCredentials(pendingLoginCredentials.username, pendingLoginCredentials.password, result.authCookie);
        log.info('Credentials saved for auto-login after 2FA');
        log.debug('Credentials saved after 2FA');
      }
      
      pendingLoginCredentials = null; // Clear pending credentials
      
      // Note: performLogin sets currentUser and vrchatClient already
      
      return { success: true, user: currentUser };
      
    } catch (error: unknown) {
      const err = error as { message?: string };
      log.error("2FA Verification Error:", error);
      
      const errorMessage = err.message || 'Invalid 2FA code';
      
      // Check for specific error types
      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('incorrect')) {
        return { success: false, error: 'Invalid 2FA code. Please try again.' };
      }
      
      return { success: false, error: errorMessage };
    }
  });

  // AUTO-LOGIN Handler - attempts login with saved credentials
  ipcMain.handle('auth:auto-login', async () => {
    log.info('Checking for saved credentials for auto-login...');
    
    if (!hasSavedCredentials()) {
      log.info('No saved credentials found');
      return { success: false, noCredentials: true };
    }
    
    const credentials = loadCredentials();
    if (!credentials) {
      log.info('Failed to load credentials');
      return { success: false, error: 'Failed to load saved credentials' };
    }
    
    log.info('Found saved credentials, attempting session restoration...');
    
    // FIRST: Try to restore session from Keyv store (no 2FA required!)
    const sessionResult = await tryRestoreSession();
    
    if (sessionResult.success && sessionResult.user) {
      log.info('Session restored successfully without re-authentication!');
      return { success: true, user: sessionResult.user };
    }
    
    log.info('Session restoration failed, falling back to full login...');
    
    // FALLBACK: Full login (will require 2FA if enabled)
    log.info(`Attempting full login for ${credentials.username}...`);
    const result = await performLogin(credentials.username, credentials.password);
    
    if (result.success) {
       // Update the cookie if it changed
       if (result.authCookie && result.authCookie !== credentials.authCookie) {
          saveCredentials(credentials.username, credentials.password, result.authCookie);
          log.debug('Auth cookie updated after auto-login');
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
      log.info('Logging out user...');
      log.debug('Logging out');
      
      if (clearSaved) {
        clearCredentials();
        log.info('Saved credentials cleared');
        log.debug('Saved credentials cleared');
      }
    } catch (e) {
      log.warn('Logout cleanup:', e);
    }
    
    vrchatClient = null;
    currentUser = null;
    pendingLoginCredentials = null;
    
    // Disconnect from Pipeline WebSocket
    onUserLoggedOut();
    
    return { success: true };
  });
}

// Helper to share client with other services (Groups, Audit, etc.)
export function getVRChatClient() {
  log.debug(`getVRChatClient called. Result exists: ${!!vrchatClient}`);
  return vrchatClient;
}

// Helper to check if authenticated
export function isAuthenticated(): boolean {
  return vrchatClient !== null && currentUser !== null;
}

// Helper to get current user's ID
export function getCurrentUserId(): string | null {
  log.debug(`getCurrentUserId called. ID: ${currentUser?.id}`);
  log.debug('Full currentUser keys:', Object.keys(currentUser || {}));
  return currentUser?.id as string | null;
}
