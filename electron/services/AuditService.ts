import { ipcMain } from 'electron';
import log from 'electron-log';
const logger = log.scope('AuditService');
import { getVRChatClient } from './AuthService';
import { networkService } from './NetworkService';

export function setupAuditHandlers() {
  
  // Get group audit logs
  ipcMain.handle('audit:get-logs', async (_event, groupId: string) => {
    return networkService.execute(async () => {
        const client = getVRChatClient();
        if (!client) throw new Error('Not authenticated. Please log in first.');

        logger.info(`Fetching audit logs for group: ${groupId}`);
        
        const response = await client.getGroupAuditLogs({ 
            groupId,
            n: 100,
            throwOnError: true
        });
        
        const logs = response?.data ?? [];
        log.info(`Fetched ${Array.isArray(logs) ? logs.length : 0} audit log entries`);
        return logs;
    }, `audit:get-logs:${groupId}`).then(result => {
        if (result.success) {
            return { success: true, logs: result.data };
        } else {
            return { success: false, error: result.error };
        }
    });
  });
}
