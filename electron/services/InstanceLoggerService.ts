import { app, BrowserWindow } from 'electron';
import { logWatcherService } from './LogWatcherService';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';

class InstanceLoggerService {
  private currentSessionId: string | null = null;
  private currentLogFilePath: string | null = null;
  private currentWorldId: string | null = null;
  private currentInstanceId: string | null = null;
  private currentLocationString: string | null = null;
  private currentWorldName: string | null = null; // Stored for live display
  private currentGroupId: string | null = null;
  private allowedGroupIds: Set<string> | null = null;
  
  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    logWatcherService.on('location', (event) => this.handleLocationChange(event));
    logWatcherService.on('world-name', (event) => this.handleWorldNameChange(event));
    
    // Also listen for player events to log them to session file
    logWatcherService.on('player-joined', (event) => this.logEvent('PLAYER_JOIN', event));
    logWatcherService.on('player-left', (event) => this.logEvent('PLAYER_LEFT', event));
  }

  // ...

  public getCurrentWorldId() {
      return this.currentWorldId;
  }
  
  public getCurrentWorldName() {
      return this.currentWorldName;
  }

  public getCurrentInstanceId() {
      return this.currentInstanceId;
  }

  public getCurrentLocation() {
      return this.currentLocationString;
  }

  private handleLocationChange(event: { worldId: string; instanceId: string; location: string; timestamp: string }) {
    try {
      this.currentLocationString = event.location;
      this.currentWorldName = null; // Reset world name on location change

      // 1. Close previous session if active (but don't create SESSION_END if we're rejoining same instance)
      const previousLocation = this.currentLogFilePath;

      this.currentWorldId = event.worldId;
      this.currentInstanceId = event.instanceId;
      
      // Extract Group ID if present (~group(grp_...))
      const groupMatch = event.location.match(/~group\((grp_[a-f0-9-]+)\)/);
      const groupId = groupMatch ? groupMatch[1] : null;

      // Update current group state and notify renderer
      if (this.currentGroupId !== groupId) {
          this.currentGroupId = groupId;
          BrowserWindow.getAllWindows().forEach((w: BrowserWindow) => {
              w.webContents.send('instance:group-changed', groupId);
          });
      }

      // STRICT MODE: If this is NOT a group instance, DO NOT LOG IT.
      if (!groupId) {
          log.info('[InstanceLogger] Skipping non-group instance:', event.location);
          // End previous session if it exists
          if (previousLocation && this.currentSessionId) {
              this.appendToFile({
                  type: 'SESSION_END',
                  timestamp: event.timestamp,
                  reason: 'LEFT_GROUP_INSTANCE' 
              });
          }
          this.cleanupCurrentSession();
          return;
      }

      // PERMISSION CHECK: Must be in allowed groups list (if list is populated)
      if (this.allowedGroupIds && !this.allowedGroupIds.has(groupId)) {
          log.info(`[InstanceLogger] Skipping group ${groupId} - not in moderated list`);
          if (previousLocation && this.currentSessionId) {
              this.appendToFile({
                  type: 'SESSION_END',
                  timestamp: event.timestamp,
                  reason: 'LEFT_MODERATED_GROUP' 
              });
          }
          this.cleanupCurrentSession();
          return;
      }

      // CHECK FOR EXISTING SESSION with same instance ID
      const existingSession = this.findExistingSessionForInstance(event.location);
      
      if (existingSession) {
          // REUSE existing session file - just append a rejoin event
          log.info(`[InstanceLogger] Rejoining existing session: ${existingSession.filename}`);
          this.currentSessionId = existingSession.sessionId;
          this.currentLogFilePath = path.join(this.getSessionsDir(), existingSession.filename);
          
          // Log rejoin event
          this.appendToFile({
              type: 'SESSION_REJOIN',
              timestamp: event.timestamp,
              actorDisplayName: 'System',
              details: { location: event.location }
          });
      } else {
          // Create NEW session file
          this.currentSessionId = `sess_${Date.now()}`;
          
          // Sanitized filename: timestamp_location.jsonl
          const safeLocation = event.location.replace(/[^a-zA-Z0-9_\-.]/g, '_');
          const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}_${safeLocation}.jsonl`;
          this.currentLogFilePath = path.join(this.getSessionsDir(), filename);

          // Create new session file with Metadata Header
          const metadata = {
              meta: true,
              sessionId: this.currentSessionId,
              worldId: event.worldId,
              instanceId: event.instanceId,
              location: event.location,
              groupId: groupId,
              startTime: event.timestamp,
              worldName: null
          };
          
          fs.writeFileSync(this.currentLogFilePath, JSON.stringify(metadata) + '\n');
          log.info(`[InstanceLogger] Started new session log: ${filename}`);

          // Log initial Location Change event
          this.appendToFile({
              type: 'LOCATION_CHANGE',
              timestamp: event.timestamp,
              actorDisplayName: 'System',
              details: { location: event.location }
          });
      }

    } catch (error) {
       log.error('[InstanceLogger] Failed to handle location change:', error);
    }
  }
  
  /** Find an existing session file for the same instance location */
  private findExistingSessionForInstance(location: string): { sessionId: string; filename: string } | null {
      try {
          const sessionsDir = this.getSessionsDir();
          if (!fs.existsSync(sessionsDir)) return null;
          
          const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
          
          for (const file of files) {
              const filePath = path.join(sessionsDir, file);
              try {
                  // Read first line (metadata)
                  const fd = fs.openSync(filePath, 'r');
                  const buffer = Buffer.alloc(2048);
                  fs.readSync(fd, buffer, 0, 2048, 0);
                  fs.closeSync(fd);
                  
                  const firstLine = buffer.toString('utf-8').split('\n')[0];
                  const meta = JSON.parse(firstLine);
                  
                  if (meta.meta && meta.location === location) {
                      return { sessionId: meta.sessionId, filename: file };
                  }
              } catch {
                  // Skip invalid files
              }
          }
      } catch (error) {
          log.warn('[InstanceLogger] Error searching for existing session:', error);
      }
      return null;
  }
  
  private cleanupCurrentSession() {
      this.currentSessionId = null;
      this.currentLogFilePath = null;
      // We do NOT clear currentWorldId/InstanceId/LocationString here, 
      // as they represent the current game state, not just the logging state.
  }

  private handleWorldNameChange(event: { name: string; timestamp: string }) {
      this.currentWorldName = event.name; // Update live state
      
      if (!this.currentSessionId || !this.currentLogFilePath) return;
      // We can't easily update the first line of a file without rewriting.
      // Instead, we'll log a "WORLD_NAME_UPDATE" event which acts as a secondary metadata source.
      this.appendToFile({
          type: 'WORLD_NAME_UPDATE',
          timestamp: event.timestamp,
          worldName: event.name
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logEvent(type: string, event: Record<string, any>) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private appendToFile(data: Record<string, any>) {
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
                        } catch { /* ignore read error */ }
                    }

                    sessions.push({ ...meta, filename: file });
                }
            } catch {
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
          }).filter(e => e !== null && !e.meta); // Filter out metadata line
          
          return events;
      } catch (error) {
          log.error('[InstanceLogger] Failed to get session events:', error);
          return null;
      }
  }
  public clearSessions() {
      try {
          const dir = this.getSessionsDir();
          if (fs.existsSync(dir)) {
              const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
              for (const file of files) {
                  fs.unlinkSync(path.join(dir, file));
              }
          }
          return true;
      } catch (error) {
          log.error('[InstanceLogger] Failed to clear sessions:', error);
          return false;
      }
  }

  public getCurrentGroupId() {
      return this.currentGroupId;
  }

  private getSessionsDir(): string {
      const userData = app.getPath('userData');
      const sessionsDir = path.join(userData, 'sessions');
      if (!fs.existsSync(sessionsDir)) {
          fs.mkdirSync(sessionsDir, { recursive: true });
      }
      return sessionsDir;
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
