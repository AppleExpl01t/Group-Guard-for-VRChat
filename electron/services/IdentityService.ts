import { ipcMain } from 'electron';
import log from 'electron-log';
import { getCurrentUserId } from './AuthService';

const logger = log.scope('IdentityService');

// TODO: Wire this to StorageService / electron-store once the backend URL
// is persisted from the main process (matching src/config.ts VITE_PROD_API_URL).
// For now this is intentionally left without a hardcoded fallback so that
// incomplete backend integration fails visibly rather than silently.
const API_BASE_URL = process.env.BACKEND_API_URL ?? '';

/**
 * Build headers for backend requests.
 * Never includes dev-bypass headers regardless of NODE_ENV — the backend
 * is zero-trust and must authenticate every request through normal channels.
 */
function buildHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  return headers;
}

export const identityService = {
  /**
   * Export user data by calling the backend API.
   * Requires a valid session token from the auth flow.
   */
  async exportUserData(sessionToken?: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!API_BASE_URL) {
      return { success: false, error: 'Backend URL not configured' };
    }

    const userId = getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    logger.info(`Exporting data for user: ${userId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/user/export`, {
        method: 'GET',
        headers: buildHeaders(sessionToken),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Export failed: ${response.status} ${errorText}`);
        return { success: false, error: `Export failed: ${response.statusText}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error: unknown) {
      logger.error('Export user data error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Export failed' };
    }
  },

  /**
   * Delete user account by calling the backend API.
   * Requires a valid session token from the auth flow.
   */
  async deleteUserAccount(sessionToken?: string): Promise<{ success: boolean; error?: string }> {
    if (!API_BASE_URL) {
      return { success: false, error: 'Backend URL not configured' };
    }

    const userId = getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    logger.info(`Deleting account for user: ${userId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/user`, {
        method: 'DELETE',
        headers: buildHeaders(sessionToken),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Delete failed: ${response.status} ${errorText}`);
        return { success: false, error: `Delete failed: ${response.statusText}` };
      }

      logger.info('Account deleted successfully on backend');
      return { success: true };
    } catch (error: unknown) {
      logger.error('Delete user account error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage || 'Delete failed' };
    }
  },
};

export function setupIdentityHandlers() {
  ipcMain.handle('identity:export-data', async (_event, sessionToken?: string) => {
    return identityService.exportUserData(sessionToken);
  });

  ipcMain.handle('identity:delete-account', async (_event, sessionToken?: string) => {
    return identityService.deleteUserAccount(sessionToken);
  });
}
