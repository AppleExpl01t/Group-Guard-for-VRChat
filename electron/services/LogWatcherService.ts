
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { EventEmitter } from 'events';
import Store from 'electron-store';
import { oscService } from './OscService';
import { discordBroadcastService } from './DiscordBroadcastService';
import { windowService } from './WindowService';
import { processService } from './ProcessService';
import { serviceEventBus } from './ServiceEventBus';
import { locationService } from './LocationService';
import { PATTERNS, extractNameAndId, parseLogTimestamp } from './LogParserService';

const store = new Store();


// ============================================
// TYPES
// ============================================

export interface LogEvent {
  type: 'player-joined' | 'player-left' | 'location' | 'world-name' | 'destination';
  timestamp: string;
  data: Record<string, string>;
}

export interface PlayerJoinedEvent {
  displayName: string;
  userId?: string;
  timestamp: string;
  isBackfill?: boolean;
}

export interface VoteKickEvent {
  target: string;
  initiator: string;
  timestamp: string;
  isBackfill?: boolean;
}

export interface VideoPlayEvent {
  url: string;
  requestedBy: string;
  timestamp: string;
  isBackfill?: boolean;
}

export interface LocationEvent {
  worldId: string;
  worldName?: string;
  instanceId?: string;
  location?: string;
  timestamp: string;
}

// Channels that bypass the hydration suppression filter so the UI gets
// location/avatar state immediately even during the initial log scan.
const HYDRATION_ALLOWED_CHANNELS = new Set([
  'log:location',
  'log:world-name',
  'log:game-closed',
  'log:cam-adjust',
  'log:avatar',
  'log:avatar-switch',
]);

// ============================================
// STATE CACHE
// ============================================

interface WatcherState {
  currentWorldId: string | null;
  currentWorldName: string | null;
  currentLocation: string | null; // Full location string for proper tracking
  players: Map<string, PlayerJoinedEvent>; // keyed by displayName
  pendingJoins: Map<string, { timer: NodeJS.Timeout; event: PlayerJoinedEvent }>;
}

// ============================================
// SERVICE
// ============================================

class LogWatcherService extends EventEmitter {
  private currentLogPath: string | null = null;
  private currentFileSize = 0;
  private watcherInterval: NodeJS.Timeout | null = null;
  private isWatching = false;
  private isHydrating = false; // Flag to suppress IPC during initial scan
  private isProcessing = false; // Prevent concurrent reads
  private hasAnnouncedConnection = false;

  // Inactivity and Persistence tracking
  private lastActivityTime = 0;
  private lastProcessedTimestamp = 0;
  private inactivityCheckInterval: NodeJS.Timeout | null = null;

  // Context Sync
  private seekingInstanceId: string | null = null;
  private seekingStartTime: number = 0;

  // Heuristic for associating avatar switches (displayName) with avatar loading (avtr_id)
  private pendingAvatarSwitches = new Map<string, { avatarName: string; timestamp: number }>();

  private state: WatcherState = {
    currentWorldId: null,
    currentWorldName: null,
    currentLocation: null,
    players: new Map(),
    pendingJoins: new Map<string, { timer: NodeJS.Timeout; event: PlayerJoinedEvent }>()
  };

  /**
   * Returns the list of currently tracked players in the instance.
   */
  public getPlayers(): PlayerJoinedEvent[] {
    return Array.from(this.state.players.values());
  }

  public getProcessedFiles(): Set<string> {
    const list = store.get('processed_logs', []) as string[];
    return new Set(list);
  }

  public markFileAsProcessed(filename: string) {
    const list = store.get('processed_logs', []) as string[];
    if (!list.includes(filename)) {
      list.push(filename);
      // Limit size to prevent infinite growth (keep last 5000 logs ~150KB)
      if (list.length > 5000) list.shift();
      store.set('processed_logs', list);
    }
  }

  /**
   * Start watching. Validates directory, finds latest log, and starts trailing.
   * If callerWindow is provided, syncs current state to it immediately.
   */
  start(callerWindow?: BrowserWindow) {
    if (callerWindow && !callerWindow.isDestroyed()) {
      this.emitStateToWindow(callerWindow);
    }

    if (this.isWatching) {
      log.info('[LogWatcher] Service already running, synced state to requestor.');
      return;
    }

    this.isWatching = true;
    log.info('[LogWatcher] Starting service (Robust Mode)...');

    processService.startMonitoring(5000);
    processService.on('status-changed', (isRunning) => {
      if (!isRunning) {
        log.info('[LogWatcher] ProcessService reports VRChat closed. Clearing state.');
        this.handleGameClosed();
      } else {
        log.debug('[LogWatcher] ProcessService reports VRChat running.');
      }
    });

    this.startFileWatcher();

    processService.checkProcess().then(isRunning => {
      if (!isRunning) {
        log.info('[LogWatcher] Initial check: Game NOT running. Enforcing closed state.');
        this.handleGameClosed();
      }
    });
  }

  private async startFileWatcher() {
    if (this.watcherInterval) return;

    this.currentFileSize = 0;
    this.state = { currentWorldId: null, currentWorldName: null, currentLocation: null, players: new Map(), pendingJoins: new Map() };

    this.findLatestLog();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchCurrentLocationFromApi } = require('./AuthService');

    try {
      const apiLoc = await fetchCurrentLocationFromApi();
      if (apiLoc) {
        this.seekingInstanceId = apiLoc;
        this.seekingStartTime = Date.now();
        log.info(`[LogWatcher] Smart Sync: Force-anchoring context to API location: ${apiLoc}`);

        const worldId = apiLoc.split(':')[0];
        this.state.currentWorldId = worldId;
        this.state.currentLocation = apiLoc;
        this.state.players.clear();

        const nowIso = new Date().toISOString();
        this.emitToRenderer('log:location', { worldId, instanceId: apiLoc, location: apiLoc, timestamp: nowIso });
        this.emit('location', { worldId, instanceId: apiLoc, location: apiLoc, timestamp: nowIso });

        this.reconcileWithApi(apiLoc);
      }
    } catch (e) {
      log.warn('[LogWatcher] Smart Sync check failed', e);
    }

    const savedPath = store.get('lastLogPath');
    const savedTimestamp = store.get('lastLogTimestamp');

    if (this.currentLogPath && savedPath === this.currentLogPath) {
      log.info(`[LogWatcher] Resuming from saved state. Last Timestamp: ${new Date(savedTimestamp as number).toISOString()}`);
      this.lastProcessedTimestamp = savedTimestamp as number;
    } else {
      log.info('[LogWatcher] New log file or no saved state. Resetting persistence.');
      this.lastProcessedTimestamp = 0;
      if (this.currentLogPath) {
        store.set('lastLogPath', this.currentLogPath);
        store.set('lastLogTimestamp', 0);
      }
    }

    if (!this.hasAnnouncedConnection) {
      this.hasAnnouncedConnection = true;
      oscService.start();

      const oscConfig = oscService.getConfig();
      if (oscConfig.enabled) {
        log.info('[LogWatcher] Sending OSC connection announcement sequence');
        oscService.send('/chatbox/input', ['Group Guard connected to VRChat successfully!', true, false]);
        setTimeout(() => {
          oscService.send('/chatbox/input', ['Initializing connection to VRChats logging service', true, true]);
          setTimeout(() => {
            oscService.send('/chatbox/input', ['VRChat Connected to Group Guard successfully!', true, false]);
          }, 2000);
        }, 1000);
      }
    }

    this.watcherInterval = setInterval(() => {
      this.findLatestLog();
      this.readNewContent();
    }, 1000);

    const checkActivity = async () => {
      // SEEK TIMEOUT CHECK: If we haven't found the target instance in the log within
      // 12 seconds, force the API-reported state rather than waiting indefinitely.
      if (this.seekingInstanceId) {
        if (Date.now() - this.seekingStartTime > 12000) {
          log.warn(`[LogWatcher] Smart Sync: Seek timeout for ${this.seekingInstanceId}. Forcing API state.`);

          const target = this.seekingInstanceId;
          this.seekingInstanceId = null;

          const worldId = target.split(':')[0];
          if (this.state.currentLocation !== target) {
            this.state.currentWorldId = worldId;
            this.state.currentLocation = target;
            this.emitToRenderer('log:location', { worldId, instanceId: target, location: target, timestamp: new Date().toISOString() });
          }

          this.reconcileWithApi(target);
        }
      }

      if (this.state.currentWorldId || this.state.currentLocation) {
        // Reconcile every minute to evict ghost players (missed leave logs)
        if (this.state.currentLocation) {
          this.reconcileWithApi(this.state.currentLocation).catch(err => {
            log.warn('[LogWatcher] Periodic reconcile failed:', err);
          });
        }

        if (Date.now() - this.lastActivityTime > 300000) {
          try {
            const apiLoc = await fetchCurrentLocationFromApi();
            if (apiLoc && apiLoc !== this.state.currentLocation) {
              log.info(`[LogWatcher] Inactivity Sync: API reports DIFFERENT location (${apiLoc}). Updating state.`);

              const worldId = apiLoc.split(':')[0];
              this.state.currentWorldId = worldId;
              this.state.currentLocation = apiLoc;
              this.state.players.clear();

              const timestamp = new Date().toISOString();
              this.emitToRenderer('log:location', { worldId, instanceId: apiLoc, location: apiLoc, timestamp });
              this.reconcileWithApi(apiLoc);
            } else if (!apiLoc && this.state.currentLocation) {
              // Only clear if the game process is also gone — avoids a race with log lag
              const isGameRunning = processService.isRunning;
              if (!isGameRunning) {
                log.info(`[LogWatcher] Inactivity Sync: API reports Offline/Private and game not running. Clearing stale location: ${this.state.currentLocation}`);
                this.handleGameClosed();
              }
            }
          } catch (e) {
            log.warn('[LogWatcher] Inactivity check failed', e);
          }
        }
      }
    };

    this.inactivityCheckInterval = setInterval(checkActivity, 60000);
    setTimeout(checkActivity, 5000);
  }

  private stopFileWatcher() {
    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
      this.watcherInterval = null;
    }
    if (this.inactivityCheckInterval) {
      clearInterval(this.inactivityCheckInterval);
      this.inactivityCheckInterval = null;
    }
    oscService.stop();
  }

  stop() {
    this.isWatching = false;
    this.stopFileWatcher();

    processService.stopMonitoring();
    processService.removeAllListeners('status-changed');

    log.info('[LogWatcher] Service stopped');
  }

  private emitStateToWindow(window: BrowserWindow) {
    if (this.isHydrating) {
      log.info('[LogWatcher] Skipping state sync - Hydration in progress');
      return;
    }

    log.debug('[LogWatcher] Syncing state to renderer...');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.');

    if (this.state.currentWorldName) {
      window.webContents.send('log:world-name', { name: this.state.currentWorldName, timestamp });
    }
    if (this.state.currentWorldId) {
      window.webContents.send('log:location', {
        worldId: this.state.currentWorldId,
        instanceId: this.state.currentLocation,
        location: this.state.currentLocation,
        timestamp
      });
    }

    for (const player of this.state.players.values()) {
      window.webContents.send('log:player-joined', player);
    }
  }

  private getLogDirectory(): string {
    const appData = app.getPath('appData');
    const localLow = path.join(appData, '..', 'LocalLow');
    return path.join(localLow, 'VRChat', 'VRChat');
  }

  private findLatestLog() {
    try {
      const logDir = this.getLogDirectory();
      if (!fs.existsSync(logDir)) {
        log.warn(`[LogWatcher] VRChat log directory not found: ${logDir}`);
        return;
      }

      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith('output_log_') && f.endsWith('.txt'))
        .map(f => {
          const fullPath = path.join(logDir, f);
          return {
            name: f,
            path: fullPath,
            stat: fs.statSync(fullPath)
          };
        })
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      if (files.length > 0) {
        const latest = files[0];
        if (latest.path !== this.currentLogPath) {
          log.info(`[LogWatcher] Found new log file: ${latest.name}`);
          this.currentLogPath = latest.path;
          this.currentFileSize = 0;
          this.state = { currentWorldId: null, currentWorldName: null, currentLocation: null, players: new Map(), pendingJoins: new Map() };
          // Mark as processed so LogScannerService skips it
          this.markFileAsProcessed(latest.name);
        }
      }
    } catch (error) {
      log.error('[LogWatcher] Error searching for logs:', error);
    }
  }

  private async readNewContent() {
    if (!this.currentLogPath || this.isProcessing) return;

    try {
      const stat = fs.statSync(this.currentLogPath);
      if (stat.size > this.currentFileSize) {
        this.isProcessing = true;

        if (this.currentFileSize === 0) {
          this.isHydrating = true;
          log.debug(`[LogWatcher] Initial hydration started for ${path.basename(this.currentLogPath)} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        const stream = fs.createReadStream(this.currentLogPath, {
          start: this.currentFileSize,
          end: stat.size
        });

        const rl = readline.createInterface({
          input: stream,
          crlfDelay: Infinity
        });

        let lineCount = 0;
        for await (const line of rl) {
          if (line.trim()) {
            this.parseLine(line.trim());
          }
          lineCount++;

          // Yield every 2000 lines to avoid blocking the event loop during large initial scans
          if (this.isHydrating && lineCount % 2000 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }

        this.currentFileSize = stat.size;

        if (this.lastProcessedTimestamp > 0) {
          store.set('lastLogTimestamp', this.lastProcessedTimestamp);
        }

        if (this.isHydrating) {
          this.isHydrating = false;
          log.debug(`[LogWatcher] Initial hydration complete. Processed ${lineCount} lines.`);
          BrowserWindow.getAllWindows().forEach(win => this.emitStateToWindow(win));
        }
      }
    } catch (err) {
      log.error('[LogWatcher] Error reading log:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private handleGameClosed() {
    log.info('[LogWatcher] Game Closed Detected. Clearing internal and renderer states.');

    if (this.state.currentWorldId || this.state.currentLocation || this.state.players.size > 0) {
      this.state.currentWorldId = null;
      this.state.currentWorldName = null;
      this.state.currentLocation = null;
      this.state.players.clear();
    }

    this.emitToRenderer('log:game-closed', {});
    this.emit('game-closed', {});

    discordBroadcastService.setIdle();
  }

  // Helper to sync missing players from API
  private async reconcileWithApi(location: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchInstancePlayers } = require('./AuthService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { timeTrackingService } = require('./TimeTrackingService');

    log.debug(`[LogWatcher] Syncing instance state via API: ${location}`);
    const apiPlayers = await fetchInstancePlayers(location);

    // Abort if the user changed worlds while the API call was in flight
    if (this.state.currentLocation !== location) {
      log.warn(`[LogWatcher] Reconcile aborted: Context changed during fetch (Req: ${location}, Curr: ${this.state.currentLocation})`);
      return;
    }

    let added = 0;
    const apiPlayerIds = new Set<string>();

    for (const p of apiPlayers) {
      apiPlayerIds.add(p.id);

      // Check by userId (preferred) or display name
      let exists = false;
      for (const existing of this.state.players.values()) {
        if ((existing.userId && existing.userId === p.id) || existing.displayName === p.displayName) {
          exists = true;
          break;
        }
      }

      if (!exists) {
        const timestamp = new Date().toISOString();
        const event: PlayerJoinedEvent = {
          displayName: p.displayName,
          userId: p.id,
          timestamp,
          isBackfill: true // Mark as backfill so we don't spam notifications
        };
        this.state.players.set(p.displayName, event);
        this.state.pendingJoins.delete(p.displayName);
        this.emitToRenderer('log:player-joined', event);
        serviceEventBus.emit('player-joined', event);
        timeTrackingService.recordEncounter(p.id);

        added++;
      }
    }

    // Only remove ghost players when the API returned a valid non-empty list —
    // an empty list on API error would otherwise wipe the entire state.
    let removed = 0;
    if (apiPlayers.length > 0) {
      // Snapshot keys to avoid mutating during iteration
      for (const [displayName, player] of [...this.state.players.entries()]) {
        if (player.userId) {
          if (!apiPlayerIds.has(player.userId)) {
            this.removeGhostPlayer(displayName, player);
            removed++;
          }
        } else {
          // No userId: fall back to display name match
          const nameExists = apiPlayers.some((ap: { displayName: string }) => ap.displayName === displayName);
          if (!nameExists) {
            this.removeGhostPlayer(displayName, player);
            removed++;
          }
        }
      }
    }

    if (added > 0 || removed > 0) {
      log.info(`[LogWatcher] Reconcile complete: Added ${added}, Removed ${removed} (Ghosts).`);
      if (this.state.currentLocation?.includes('~group(')) {
        discordBroadcastService.updateGroupStatus(this.state.currentWorldName || 'Group Instance', this.state.players.size);
      }
    } else {
      log.debug('[LogWatcher] Reconcile complete: State matches API.');
    }
  }

  private removeGhostPlayer(displayName: string, player: PlayerJoinedEvent) {
    log.info(`[LogWatcher] Removing Ghost Player: ${displayName} (${player.userId || 'No ID'})`);
    this.state.players.delete(displayName);

    this.emitToRenderer('log:player-left', {
      displayName,
      userId: player.userId,
      timestamp: new Date().toISOString()
    });

    serviceEventBus.emit('player-left', {
      displayName,
      userId: player.userId,
      timestamp: new Date().toISOString()
    });
  }

  private parseLine(line: string) {
    if (!line || !line.trim()) return;

    // Smart sync: skip lines until we find the expected instance in the log
    if (this.seekingInstanceId) {
      const getBaseId = (id: string) => id.split('~')[0];
      const targetBase = getBaseId(this.seekingInstanceId as string);

      const match = line.match(PATTERNS.joining);

      if (match) {
        const logId = `${match[1]}:${match[2]}`;
        const logBase = getBaseId(logId);

        if (logBase === targetBase) {
          log.info(`[LogWatcher] Smart Sync: Target context found via regex! Resuming processing.`);
          this.seekingInstanceId = null;
          this.reconcileWithApi(logId);
        } else {
          log.info(`[LogWatcher] Smart Sync: User joined a DIFFERENT world (${logId}) while seeking ${this.seekingInstanceId}. Aborting seek and syncing to NEW world.`);
          this.seekingInstanceId = null;
          // Continue processing this line normally so it triggers the location change below
        }
      } else if (line.includes('Entering Room:')) {
        // If we hit "Entering Room" while still seeking, we definitely missed the "Joining" line
        log.info(`[LogWatcher] Smart Sync: Hit 'Entering Room' while seeking. Aborting seek to avoid state lag.`);
        this.seekingInstanceId = null;
      } else if (line.includes(targetBase)) {
        log.info(`[LogWatcher] Smart Sync: Target context found via string match! Resuming processing.`);
        const target = this.seekingInstanceId;
        this.seekingInstanceId = null;
        this.reconcileWithApi(target as string);
      } else {
        return;
      }
    }

    const timestamp = line.substring(0, 19);
    const parsedTime = parseLogTimestamp(timestamp);
    if (parsedTime > 0) {
      this.lastActivityTime = parsedTime;
    }

    const isBackfill = this.lastActivityTime < this.lastProcessedTimestamp;
    if (parsedTime > this.lastProcessedTimestamp) {
      this.lastProcessedTimestamp = parsedTime;
    }

    // 1. World Location
    const joinMatch = line.match(PATTERNS.joining);
    if (joinMatch) {
      const worldId = joinMatch[1];
      const instanceId = joinMatch[2];
      const location = `${worldId}:${instanceId}`;

      log.debug(`[LogWatcher] Joining World: ${location}`);

      // During hydration of a stale log, reject old location events if the game isn't running
      if (this.isHydrating) {
        const isOld = (Date.now() - this.lastActivityTime) > 30 * 60 * 1000;
        if (isOld && !processService.isRunning) {
          log.debug(`[LogWatcher] Hydration Guard: Rejecting stale location event (${timestamp}) as game is not running.`);
          return;
        }
      }

      if (this.state.currentLocation !== location) {
        log.debug(`[LogWatcher] Location transitioned to ${location}`);

        this.state.players.clear();
        this.state.currentWorldId = worldId;
        this.state.currentLocation = location;
        this.state.currentWorldName = null;

        this.emitToRenderer('log:location', { worldId, instanceId, location, timestamp });
        this.emit('location', { worldId, instanceId, location, timestamp });
        serviceEventBus.emit('location', { worldId, instanceId, location, timestamp });

        if (!this.isHydrating && !isBackfill) {
          this.reconcileWithApi(location);
        }

        if (location.includes('~group(')) {
          discordBroadcastService.updateGroupStatus('Group Instance', 0);
        } else {
          discordBroadcastService.setIdle();
        }
      }
    }

    // 2. Avatar
    const avatarMatch = line.match(PATTERNS.avatar);
    if (avatarMatch) {
      const avatarId = avatarMatch[1];
      this.emitToRenderer('log:avatar', { avatarId, timestamp });
      if (!isBackfill) {
        this.emit('avatar', { avatarId, timestamp });

        // Find the most recent pending avatar-switch to associate with this load event.
        // Switches are logged before the load, so we pick the newest one within 10s.
        let bestMatch: { displayName: string; avatarName: string; timestamp: number } | null = null;
        for (const [displayName, data] of this.pendingAvatarSwitches.entries()) {
          if (!bestMatch || data.timestamp > bestMatch.timestamp) {
            bestMatch = { displayName, ...data };
          }
        }

        if (bestMatch && this.lastActivityTime - bestMatch.timestamp < 10000) {
          const { displayName, avatarName } = bestMatch;
          const player = this.state.players.get(displayName);
          if (player && player.userId) {
            log.info(`[LogWatcher] Associated avatar ${avatarId} (${avatarName}) with user ${displayName} (${player.userId})`);
            locationService.updateFriend({
              userId: player.userId,
              currentAvatarId: avatarId,
              avatarName: avatarName
            });
            this.pendingAvatarSwitches.delete(displayName);
          }
        }
      }
    }

    // 3. World Name
    const enterMatch = line.match(PATTERNS.entering);
    if (enterMatch) {
      const worldName = enterMatch[1].trim();
      this.state.currentWorldName = worldName;
      this.emitToRenderer('log:world-name', { name: worldName, timestamp });
      this.emit('world-name', { name: worldName, timestamp });
      if (this.state.currentLocation?.includes('~group(')) {
        discordBroadcastService.updateGroupStatus(worldName, this.state.players.size);
      }
    }

    // 4. Player Joined
    if (line.includes('OnPlayerJoined')) {
      const match = line.match(PATTERNS.playerJoinPrefix);
      if (match) {
        const restOfLine = line.substring(match.index! + match[0].length);
        let { displayName, userId } = extractNameAndId(restOfLine);

        // VRChat sometimes logs "/ player=Name" or "Name (local)" — strip those
        if (displayName.startsWith('/ player=')) displayName = displayName.substring(9).trim();
        if (displayName.endsWith('(local)')) displayName = displayName.substring(0, displayName.length - 7).trim();

        // Internal VRChat debug message occasionally matches the join pattern
        if (displayName.includes('called, updating lock state')) return;

        if (displayName) {
          if (!this.isHydrating) {
            log.info(`[LogWatcher] Player Joined: ${displayName}${userId ? ` (${userId})` : ''}`);
          }

          const playerEvent: PlayerJoinedEvent = { displayName, userId, timestamp, isBackfill };

          if (userId) {
            // Detailed join — cancel any buffered raw join for the same name
            if (this.state.pendingJoins.has(displayName)) {
              clearTimeout(this.state.pendingJoins.get(displayName)!.timer);
              this.state.pendingJoins.delete(displayName);
            }

            this.state.players.set(displayName, playerEvent);
            this.emitToRenderer('log:player-joined', playerEvent);

            if (!isBackfill) {
              serviceEventBus.emit('player-joined', playerEvent);
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { timeTrackingService } = require('./TimeTrackingService');
              timeTrackingService.recordEncounter(userId);
            }

            if (this.state.currentLocation?.includes('~group(')) {
              discordBroadcastService.updateGroupStatus(this.state.currentWorldName || 'Group Instance', this.state.players.size);
            }
          } else {
            // Raw join (no userId yet) — buffer for 1.5s to see if a detailed one follows
            if (this.state.pendingJoins.has(displayName)) {
              clearTimeout(this.state.pendingJoins.get(displayName)!.timer);
            }

            const timer = setTimeout(() => {
              this.state.pendingJoins.delete(displayName);
              if (!this.state.players.has(displayName)) {
                this.state.players.set(displayName, playerEvent);
                this.emitToRenderer('log:player-joined', playerEvent);
                if (!isBackfill) {
                  serviceEventBus.emit('player-joined', playerEvent);
                }
                if (this.state.currentLocation?.includes('~group(')) {
                  discordBroadcastService.updateGroupStatus(this.state.currentWorldName || 'Group Instance', this.state.players.size);
                }
              }
            }, 1500);

            this.state.pendingJoins.set(displayName, { timer, event: playerEvent });
          }
        }
      }
    }

    // 5. Player Left
    if (line.includes('OnPlayerLeft')) {
      const match = line.match(PATTERNS.playerLeftPrefix);
      if (match) {
        const restOfLine = line.substring(match.index! + match[0].length);
        let { displayName, userId } = extractNameAndId(restOfLine);

        if (displayName.startsWith('/ player=')) displayName = displayName.substring(9).trim();
        if (displayName.endsWith('(local)')) displayName = displayName.substring(0, displayName.length - 7).trim();

        if (displayName.includes('called, updating lock state')) return;

        if (displayName) {
          if (!this.isHydrating) {
            log.info(`[LogWatcher] Player Left: ${displayName}${userId ? ` (${userId})` : ''}`);
          }

          if (this.state.players.has(displayName)) {
            const entry = this.state.players.get(displayName)!;
            this.state.players.delete(displayName);
            // Prefer the ID from the log; fall back to the one stored at join time
            const finalId = userId || entry.userId;
            const leaveEvent = { displayName, userId: finalId, timestamp, isBackfill };
            this.emitToRenderer('log:player-left', leaveEvent);
            serviceEventBus.emit('player-left', leaveEvent);

            if (this.state.currentLocation?.includes('~group(')) {
              discordBroadcastService.updateGroupStatus(this.state.currentWorldName || 'Group Instance', this.state.players.size);
            }
          }
        }
      }
    }

    // 6. Vote Kick
    const voteMatch = line.match(PATTERNS.voteKick);
    if (voteMatch) {
      const event: VoteKickEvent = { target: voteMatch[1].trim(), initiator: voteMatch[2].trim(), timestamp, isBackfill };
      this.emitToRenderer('log:vote-kick', event);
      if (!isBackfill) {
        this.emit('vote-kick', event);
        serviceEventBus.emit('vote-kick', { target: event.target, initiator: event.initiator, timestamp: event.timestamp });
      }
    }

    // 7. Video Play
    const videoMatch = line.match(PATTERNS.video);
    if (videoMatch) {
      const event: VideoPlayEvent = { url: videoMatch[1].trim(), requestedBy: videoMatch[2] ? videoMatch[2].trim() : 'Unknown', timestamp, isBackfill };
      this.emitToRenderer('log:video-play', event);
      if (!isBackfill) {
        this.emit('video-play', event);
        serviceEventBus.emit('video-play', { url: event.url, requestedBy: event.requestedBy, timestamp: event.timestamp });
      }
    }

    // 8. Notifications
    if (line.includes('Received Notification:')) {
      const match = line.match(PATTERNS.notification);
      if (match) {
        const receiverMatch = line.match(PATTERNS.notificationReceiver);
        const event = {
          senderUsername: match[1],
          senderUserId: match[2],
          type: match[3],
          notificationId: match[4],
          message: match[5],
          receiverUserId: receiverMatch ? receiverMatch[1] : undefined,
          timestamp,
          isBackfill
        };
        this.emitToRenderer('log:notification', event);
        if (!isBackfill) {
          this.emit('notification', event);
        }
      }
    }

    // 9. Avatar Switch
    if (line.includes('[Behaviour] Switching')) {
      const match = line.match(PATTERNS.avatarSwitch);
      if (match) {
        const displayName = match[1];
        const avatarName = match[2];

        this.pendingAvatarSwitches.set(displayName, { avatarName, timestamp: this.lastActivityTime });

        // Evict entries older than 1 minute
        const now = this.lastActivityTime;
        for (const [key, val] of this.pendingAvatarSwitches.entries()) {
          if (now - val.timestamp > 60000) {
            this.pendingAvatarSwitches.delete(key);
          }
        }

        const event = { displayName, avatarName, timestamp, isBackfill };
        this.emitToRenderer('log:avatar-switch', event);
        if (!isBackfill) {
          this.emit('avatar-switch', event);
        }
      }
    }

    // 10. Sticker Spawn
    if (line.includes('[StickersManager] User')) {
      const match = line.match(PATTERNS.stickerSpawn);
      if (match) {
        const event = {
          userId: match[1],
          displayName: match[2],
          stickerId: match[3],
          timestamp,
          isBackfill
        };
        this.emitToRenderer('log:sticker-spawn', event);
        if (!isBackfill) {
          this.emit('sticker-spawn', event);
        }
      }
    }
  }

  private emitToRenderer(channel: string, data: unknown) {
    if (this.isHydrating && !HYDRATION_ALLOWED_CHANNELS.has(channel)) {
      return;
    }
    windowService.broadcast(channel, data);
  }
}

export const logWatcherService = new LogWatcherService();

/**
 * Sets up IPC handlers for the log watcher service
 */
export function setupLogWatcherHandlers() {
  ipcMain.handle('log-watcher:start', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    logWatcherService.start(win || undefined);
    return { success: true };
  });

  ipcMain.handle('log-watcher:stop', () => {
    logWatcherService.stop();
    return { success: true };
  });
}
