import { ipcMain } from 'electron';
import log from 'electron-log';
const logger = log.scope('AuditService');
import { getVRChatClient } from './AuthService';

export function setupAuditHandlers() {
  
  // Get group audit logs
  ipcMain.handle('audit:get-logs', async (_event, groupId: string) => {
    try {
      const client = getVRChatClient();
      if (!client) throw new Error('Not authenticated. Please log in first.');

      logger.info(`Fetching audit logs for group: ${groupId}`);
      
      // Use the SDK's built-in getGroupAuditLogs method
      const response = await client.getGroupAuditLogs({ 
        groupId,
        n: 100,
        throwOnError: true
      });
      
      const logs = response?.data ?? [];
      
      log.info(`Fetched ${Array.isArray(logs) ? logs.length : 0} audit log entries`);
      return { success: true, logs };
      
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number } };
      log.error('Failed to fetch audit logs:', error);
      
      // Handle auth errors
      if (err.response?.status === 401) {
        return { success: false, error: 'Session expired. Please log in again.' };
      }
      
      // Handle permission errors
      if (err.response?.status === 403) {
        return { success: false, error: 'You do not have permission to view audit logs for this group.' };
      }
      
      return { success: false, error: err.message || 'Failed to fetch audit logs' };
    }
  });
}
