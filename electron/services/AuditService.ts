/**
 * Audit Service
 * 
 * Handles audit log IPC handlers.
 * Delegates API calls to VRChatApiService for centralized caching and error handling.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { vrchatApiService } from './VRChatApiService';

const logger = log.scope('AuditService');

export function setupAuditHandlers() {
  
  // Get group audit logs
  ipcMain.handle('audit:get-logs', async (_event, groupId: string) => {
    logger.info(`Fetching audit logs for group: ${groupId}`);
    
    const result = await vrchatApiService.getGroupAuditLogs(groupId, 100);
    
    if (result.success) {
        logger.info(`Fetched ${result.data?.length || 0} audit log entries`);
        return { success: true, logs: result.data };
    } else {
        return { success: false, error: result.error };
    }
  });
}
