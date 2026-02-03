import { ipcMain } from 'electron';
import log from 'electron-log';
import { getCurrentUserId } from './AuthService';

const logger = log.scope('IdentityService');

// TODO: Move to config
const API_BASE_URL = 'http://localhost:3000/api/v1';

export const identityService = {
  /**
   * Export user data by calling the backend API
   */
  async exportUserData(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      logger.info(`Exporting data for user: ${userId}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add Dev Auth Header if in development
      if (process.env.NODE_ENV === 'development') {
        headers['x-dev-user-id'] = userId;
      }

      // TODO: Add Authorization Bearer token when implemented

      const response = await fetch(`${API_BASE_URL}/user/export`, {
        method: 'GET',
        headers
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
   * Delete user account by calling the backend API
   */
  async deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      logger.info(`Deleting account for user: ${userId}`);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (process.env.NODE_ENV === 'development') {
        headers['x-dev-user-id'] = userId;
      }

      const response = await fetch(`${API_BASE_URL}/user`, {
        method: 'DELETE',
        headers
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
  }
};

export function setupIdentityHandlers() {
  ipcMain.handle('identity:export-data', async () => {
    return identityService.exportUserData();
  });

  ipcMain.handle('identity:delete-account', async () => {
    return identityService.deleteUserAccount();
  });
}
