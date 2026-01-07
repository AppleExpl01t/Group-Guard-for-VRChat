import { ipcMain, safeStorage } from 'electron';
import log from 'electron-log';
import { clearSessionStore } from './AuthService';

// electron-store is ESM in v9+, we need to use dynamic import or require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Store = require('electron-store');

// Schema for our stored data
interface StoredCredentials {
  username: string;
  // Password is encrypted using Electron's safeStorage
  encryptedPassword: string;
  // Auth cookie from VRChat for session restoration
  authCookie?: string;
}

// Initialize electron-store with encryption
// Using any type since electron-store types are complex with ESM/CJS interop
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = new Store({
  name: 'group-guard-credentials',
  encryptionKey: 'group-guard-secure-storage-v1', // Additional layer of encryption
  defaults: {
    rememberMe: false
  }
});

/**
 * Save credentials securely
 * Uses Electron's safeStorage for password encryption when available
 */
export function saveCredentials(username: string, password: string, authCookie?: string): boolean {
  try {
    let encryptedPassword: string;
    
    // Use safeStorage if available (uses OS keychain/credential manager)
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(password);
      encryptedPassword = encrypted.toString('base64');
    } else {
      // Fallback to base64 (less secure, but electron-store already encrypts)
      encryptedPassword = Buffer.from(password).toString('base64');
      log.warn('safeStorage not available, using fallback encryption');
    }
    
    const credentials: StoredCredentials = {
      username,
      encryptedPassword,
      authCookie
    };
    
    store.set('savedCredentials', credentials);
    store.set('rememberMe', true);
    
    log.info('Credentials saved securely');
    return true;
  } catch (error) {
    log.error('Failed to save credentials:', error);
    return false;
  }
}

/**
 * Load saved credentials
 */
export function loadCredentials(): { username: string; password: string; authCookie?: string } | null {
  try {
    const saved = store.get('savedCredentials') as StoredCredentials | undefined;
    if (!saved) {
      return null;
    }
    
    let password: string;
    
    // Decrypt using safeStorage if available
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = Buffer.from(saved.encryptedPassword, 'base64');
        password = safeStorage.decryptString(encrypted);
      } catch {
        // If decryption fails (e.g., different machine), try base64 fallback
        password = Buffer.from(saved.encryptedPassword, 'base64').toString('utf-8');
      }
    } else {
      // Fallback from base64
      password = Buffer.from(saved.encryptedPassword, 'base64').toString('utf-8');
    }
    
    return {
      username: saved.username,
      password,
      authCookie: saved.authCookie
    };
  } catch (error) {
    log.error('Failed to load credentials:', error);
    return null;
  }
}

/**
 * Update the auth cookie for saved credentials
 */
export function updateAuthCookie(authCookie: string): boolean {
  try {
    const saved = store.get('savedCredentials') as StoredCredentials | undefined;
    if (!saved) {
      return false;
    }
    
    store.set('savedCredentials', {
      ...saved,
      authCookie
    });
    
    log.info('Auth cookie updated');
    return true;
  } catch (error) {
    log.error('Failed to update auth cookie:', error);
    return false;
  }
}

/**
 * Clear all saved credentials and session store
 */
export async function clearCredentials(): Promise<void> {
  try {
    store.delete('savedCredentials');
    store.set('rememberMe', false);
    // SECURITY FIX: Clear session store when clearing credentials to prevent session reuse
    await clearSessionStore();
    log.info('Credentials and session store cleared');
  } catch (error) {
    log.error('Failed to clear credentials:', error);
  }
}

/**
 * Check if credentials are saved
 */
export function hasSavedCredentials(): boolean {
  return store.has('savedCredentials') && store.get('rememberMe', false);
}

/**
 * Get the remember me preference
 */
export function getRememberMe(): boolean {
  return store.get('rememberMe', false);
}

/**
 * Setup IPC handlers for credentials
 */
export function setupCredentialsHandlers() {
  // Check if credentials are saved
  ipcMain.handle('credentials:has-saved', () => {
    return hasSavedCredentials();
  });
  
  // Get remember me state
  ipcMain.handle('credentials:get-remember-me', () => {
    return getRememberMe();
  });
  
  // Save credentials (called after successful login)
  ipcMain.handle('credentials:save', (_event, { username, password, authCookie }: { 
    username: string; 
    password: string; 
    authCookie?: string 
  }) => {
    return saveCredentials(username, password, authCookie);
  });
  
  // Clear credentials
  ipcMain.handle('credentials:clear', () => {
    clearCredentials();
    return true;
  });
  
  // Load credentials for auto-login
  ipcMain.handle('credentials:load', () => {
    return loadCredentials();
  });
  
  log.info('Credentials handlers initialized');
}
