import { BrowserWindow } from 'electron';
import { logWatcherService } from './LogWatcherService';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { storageService } from './StorageService';

class InstanceLoggerService {
  private currentSessionId: string | null = null;
  private currentLogFilePath: string | null = null;
  private currentWorldId: string | null = null;
  private currentInstanceId: string | null = null;
  // Removed static sessionsDir init

  constructor() {
    this.setupListeners();
  }

  private getSessionsDir() {
      const baseDir = storageService.getDataDir();
      const sessionsDir = path.join(baseDir, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
          fs.mkdirSync(sessionsDir, { recursive: true });
      }
      return sessionsDir;
  }
  
  // Removed ensureSessionsDir as it is now dynamic


  private setupListeners() {
    logWatcherService.on('location', (event) => this.handleLocationChange(event));
    logWatcherService.on('world-name', (event) => this.handleWorldNameChange(event));
    logWatcherService.on('player-joined', (event) => this.logEvent('JOIN', event));
    logWatcherService.on('player-left', (event) => this.logEvent('LEAVE', event));
    logWatcherService.on('avatar', (event) => this.logEvent('AVATAR_CHANGE', event));
  }

  private allowedGroupIds: Set<string> | null = null;

  public setAllowedGroups(groupIds: string[]) {
      this.allowedGroupIds = new Set(groupIds);
      log.info(`[InstanceLogger] Updated allowed groups: ${groupIds.length} groups`);
  }

  public clearSessions() {
      try {
          const sessionsDir = this.getSessionsDir();
          const files = fs.readdirSync(sessionsDir);
          for (const file of files) {
              if (file.endsWith('.jsonl')) {
                  fs.unlinkSync(path.join(sessionsDir, file));
              }
          }
          this.currentSessionId = null;
          this.currentLogFilePath = null;
          log.info('[InstanceLogger] Cleared all session logs');
          return true;
      } catch (error) {
          log.error('[InstanceLogger] Failed to clear sessions:', error);
          return false;
      }
  }

  private currentGroupId: string | null = null;
  
  public getCurrentGroupId() {
      return this.currentGroupId;
  }

  private handleLocationChange(event: { worldId: string; instanceId: string; location: string; timestamp: string }) {
    try {
      // 1. Close previous session if active
      if (this.currentSessionId && this.currentLogFilePath) {
         this.appendToFile({
             type: 'SESSION_END',
             timestamp: event.timestamp,
             reason: 'LOCATION_CHANGE' 
         });
      }

      this.currentWorldId = event.worldId;
      this.currentInstanceId = event.instanceId;
      
      // Extract Group ID if present (~group(grp_...))
      const groupMatch = event.location.match(/~group\((grp_[a-f0-9\-]+)\)/);
      const groupId = groupMatch ? groupMatch[1] : null;

      // Update current group state and notify renderer
      if (this.currentGroupId !== groupId) {
          this.currentGroupId = groupId;
          BrowserWindow.getAllWindows().forEach(w => {
              w.webContents.send('instance:group-changed', groupId);
          });
      }

      // STRICT MODE: If this is NOT a group instance, DO NOT LOG IT.
      if (!groupId) {
          log.info('[InstanceLogger] Skipping non-group instance:', event.location);
          this.cleanupCurrentSession();
          return;
      }

      // PERMISSION CHECK: Must be in allowed groups list (if list is populated)
      if (this.allowedGroupIds && !this.allowedGroupIds.has(groupId)) {
          log.info(`[InstanceLogger] Skipping group ${groupId} - not in moderated list`);
          this.cleanupCurrentSession();
          return;
      }

      this.currentSessionId = `sess_${Date.now()}`;
      
      // Sanitized filename: timestamp_worldId.jsonl
      const safeLocation = event.location.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}_${safeLocation}.jsonl`;
      this.currentLogFilePath = path.join(this.getSessionsDir(), filename);

      // 2. Create new session file with Metadata Header
      const metadata = {
          meta: true,
          sessionId: this.currentSessionId,
          worldId: event.worldId,
          instanceId: event.instanceId,
          location: event.location,
          groupId: groupId, // Store Group ID for filtering
          startTime: event.timestamp,
          worldName: null // Will update if found
      };
      
      fs.writeFileSync(this.currentLogFilePath, JSON.stringify(metadata) + '\n');
      log.info(`[InstanceLogger] Started new session log: ${filename}`);

    } catch (error) {
       log.error('[InstanceLogger] Failed to handle location change:', error);
    }
  }
  
  private cleanupCurrentSession() {
      this.currentSessionId = null;
      this.currentLogFilePath = null;
  }

  private handleWorldNameChange(event: { name: string; timestamp: string }) {
      if (!this.currentSessionId || !this.currentLogFilePath) return;
      // We can't easily update the first line of a file without rewriting.
      // Instead, we'll log a "WORLD_NAME_UPDATE" event which acts as a secondary metadata source.
      this.appendToFile({
          type: 'WORLD_NAME_UPDATE',
          timestamp: event.timestamp,
          worldName: event.name
      });
  }

  private logEvent(type: string, event: any) {
      if (!this.currentSessionId || !this.currentLogFilePath) return;

      const logEntry = {
          type: type,
          timestamp: event.timestamp,
          actorDisplayName: event.displayName || 'Self',
          actorUserId: event.userId,
          details: event.avatarId ? { avatarId: event.avatarId } : undefined
      };
      
      this.appendToFile(logEntry);
  }

  private appendToFile(data: any) {
      if (!this.currentLogFilePath) return;
      try {
          fs.appendFileSync(this.currentLogFilePath, JSON.stringify(data) + '\n');
      } catch (error) {
          log.error('[InstanceLogger] Failed to write to log file:', error);
      }
  }

  public getSessions(groupIdFilter?: string) {
    try {
        const files = fs.readdirSync(this.getSessionsDir()).filter(f => f.endsWith('.jsonl'));
        const sessions = [];

        for (const file of files) {
            const filePath = path.join(this.getSessionsDir(), file);
            // Read first line for metadata
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(4096); // Read first 4KB should cover metadata
            fs.readSync(fd, buffer, 0, 4096, 0);
            fs.closeSync(fd);
            
            const firstLine = buffer.toString('utf-8').split('\n')[0];
            try {
                const meta = JSON.parse(firstLine);
                if (meta.meta) {
                    // Filter by group if requested
                    if (groupIdFilter && meta.groupId !== groupIdFilter) {
                        continue;
                    }

                    // Fix for "Unknown World": If name is missing, scan file for update event
                    if (!meta.worldName) {
                        try {
                             const content = fs.readFileSync(filePath, 'utf-8');
                             const nameUpdate = content.split('\n')
                                .map(line => { try { return JSON.parse(line); } catch { return null; } })
                                .find(e => e && e.type === 'WORLD_NAME_UPDATE');
                             
                             if (nameUpdate && nameUpdate.worldName) {
                                 meta.worldName = nameUpdate.worldName;
                             }
                        } catch (e) { /* ignore read error */ }
                    }

                    sessions.push({ ...meta, filename: file });
                }
            } catch (e) {
                // Invalid file, skip
            }
        }
        
        // Sort by startTime desc
        return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (error) {
        log.error('[InstanceLogger] Failed to get sessions:', error);
        return [];
    }
  }

  public getSessionEvents(filename: string) {
      try {
          const filePath = path.join(this.getSessionsDir(), filename);
          if (!fs.existsSync(filePath)) return null;
          
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          const events = lines.map(l => {
              try { return JSON.parse(l); } catch { return null; }
          }).filter(e => e !== null);
          
          return events;
      } catch (error) {
          log.error('[InstanceLogger] Failed to get session events:', error);
          return null;
      }
  }
}

export const instanceLoggerService = new InstanceLoggerService();

import { ipcMain } from 'electron';
ipcMain.handle('database:get-sessions', async (_, groupId) => {
    return instanceLoggerService.getSessions(groupId);
});
ipcMain.handle('database:get-session-events', async (_, filename) => {
    return instanceLoggerService.getSessionEvents(filename);
});
ipcMain.handle('database:clear-sessions', async () => {
    return instanceLoggerService.clearSessions();
});
ipcMain.handle('instance:get-current-group', async () => {
    return instanceLoggerService.getCurrentGroupId();
});
