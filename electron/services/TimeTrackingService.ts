import { databaseService } from './DatabaseService';
import log from 'electron-log';
import { serviceEventBus } from './ServiceEventBus';
import { locationService } from './LocationService';
import path from 'path';
import fs from 'fs';

const logger = log.scope('TimeTrackingService');

/**
 * Service responsible for the "Heartbeat" mechanism of time tracking.
 * Instead of calculating "Join - Leave" duration (which fails on crash),
 * this service pulses every minute and increments counters for active users.
 */
class TimeTrackingService {
    private isInitialized = false;
    private userDataDir: string | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_MS = 60 * 1000; // 1 Minute

    private encounterQueue: string[] = [];
    private isProcessingQueue = false;

    constructor() { }

    public async initialize(userDataDir: string) {
        if (this.isInitialized) return;
        if (!userDataDir) {
            logger.error('TimeTrackingService initialize called with empty userDataDir!');
            return;
        }

        logger.info(`Initializing TimeTrackingService. Data Dir: ${userDataDir}`);
        this.userDataDir = userDataDir;
        this.isInitialized = true;
        this.startHeartbeat();

        // Perform one-time legacy log migration in the background
        setTimeout(() => {
            if (this.userDataDir) {
                this.migrateLegacyRelationDates(this.userDataDir).catch(e => {
                    logger.error('Background migration failed:', e);
                });
            }
        }, 15000); // 15s delay to let DB settle
    }

    public shutdown() {
        this.stopHeartbeat();
        this.isInitialized = false;
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        logger.info('Starting Time Tracking Heartbeat (1 min interval)');

        // Initial beat after small delay
        setTimeout(() => this.pulsate(), 10000);

        this.heartbeatInterval = setInterval(() => {
            this.pulsate();
        }, this.HEARTBEAT_MS);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * The "Pulse": Increments time for all friends currently in the same instance.
     */
    private async pulsate() {
        if (!this.isInitialized) return;

        try {
            // 1. Get current instance context
            // We rely on LocationService to know who is "With Me"
            // Note: LocationService tracks where friends are. 
            // We need to know who is in the *same* instance as the current user.

            // Actually, `instanceMonitorStore` (via IPC or shared state) has the list of players in the CURRENT instance.
            // But we are in the main process. 
            // We can use the 'active players' list from `InstanceMonitorService` (if exposed) 
            // or simply ask LocationService for friends whose location matches ours? 
            // No, LocationService tracks friends *globally*.

            // Better approach: InstanceMonitorService maintains the list of `scannedEntities`.
            // We should get the list of active users from there.

            // Let's assume we can get active users via a request/getter.
            // For now, let's use a workaround: The `ScannedUser` table has `lastSeenAt`.
            // If `lastSeenAt` is within the last minute AND they are in the current group instance, we count them.
            // But that's passive.

            // Let's use the `serviceEventBus` to track active sessions? No, too stateful.
            // Best way: InstanceMonitor emits updates. 
            // Actually, we can just query the `instanceMonitor` via electron window? No.

            // Let's use the `DatabaseService` to find users seen in the last 60 seconds?
            // "Active" defined as: `lastSeenAt` > (now - 70s).
            // Updates to `ScannedUser` happen on log events (Join/Leave/Talk/Move).
            // If a user is just standing there silent, they might not update `ScannedUser`?
            // Correct. Scanner only updates on visual detection or log event.

            // Wait, `LiveView` polls? No, it's event driven.
            // BUT, `LogWatcher` receives player location updates? No, only self.

            // FIXED LOGIC: Source of truth is LogWatcher's local instance list.
            // This works even if the API reports "private" or location tags mismatch.
            const { logWatcherService } = require('./LogWatcherService');
            const activePlayers = logWatcherService.getPlayers();

            // Filter for valid friends with User IDs
            const trackableUserIds = activePlayers
                .filter((p: any) => p.userId && locationService.getFriend(p.userId)) // Must be a friend and have ID
                .map((p: any) => p.userId as string);

            if (trackableUserIds.length === 0) return;

            logger.debug(`[Heartbeat] Tracking time for ${trackableUserIds.length} friends (Source: LogWatcher)...`);

            // Batch update DB
            await this.incrementTime(trackableUserIds);

            // Emit live update event for UI
            serviceEventBus.emit('friend-stats-updated', {
                userIds: trackableUserIds,
                addedMinutes: 1
            });

        } catch (e) {
            logger.error('[Heartbeat] Failed:', e);
        }
    }

    /**
     * Records a new "Encounter" (Session) for a user.
     * Called by LogWatcher when a player joins the instance.
     * Uses a queue to prevent SQLite locking/timeout issues during high traffic.
     */
    public recordEncounter(userId: string) {
        if (!this.isInitialized) return;

        this.encounterQueue.push(userId);
        this.processEncounterQueue();
    }

    private async processEncounterQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.encounterQueue.length > 0) {
            const userId = this.encounterQueue.shift();
            if (!userId) continue;

            try {
                const client = databaseService.getClient();
                const now = new Date();

                // @ts-ignore
                await client.friendStats.upsert({
                    where: { userId },
                    create: {
                        userId,
                        displayName: 'Unknown', // Will be updated by enricher
                        timeSpentMinutes: 0,
                        encounterCount: 1,
                        lastSeen: now,
                        lastHeartbeat: new Date(0),
                        createdAt: now
                    },
                    update: {
                        encounterCount: { increment: 1 },
                        lastSeen: now
                    }
                });
                // logger.info(`[TimeTracking] Recorded encounter for ${userId}`);

                // Emit event so UI updates immediately (score change)
                serviceEventBus.emit('friend-stats-updated', {
                    userIds: [userId],
                    addedMinutes: 0
                });

                // Small delay to let other DB ops breathe?
                // await new Promise(resolve => setTimeout(resolve, 10));

            } catch (e) {
                logger.error(`[TimeTracking] Failed to record encounter for ${userId}:`, e);
                // Put back in queue? No, just drop it to avoid infinite loops on bad data
            }
        }

        this.isProcessingQueue = false;
    }

    private async incrementTime(userIds: string[]) {
        const client = databaseService.getClient();
        const now = new Date();

        // Transaction for safety
        await (client as any).$transaction(
            userIds.map(userId =>
                // @ts-ignore
                (client as any).friendStats.upsert({
                    where: { userId },
                    create: {
                        userId,
                        displayName: 'Unknown', // Will be updated by enricher later
                        timeSpentMinutes: 1,
                        encounterCount: 1,
                        lastSeen: now,
                        lastHeartbeat: now,
                        createdAt: now
                    },
                    update: {
                        timeSpentMinutes: { increment: 1 },
                        lastSeen: now,
                        lastHeartbeat: now
                    }
                })
            )
        );
        logger.debug(`[Heartbeat] Incremented time for ${userIds.length} users.`);
    }

    /**
     * Retrieves aggregated stats for a user from the authoritative database.
     */
    public async getPlayerStats(userId: string) {
        if (!this.isInitialized) return null;
        try {
            const client = databaseService.getClient();
            // @ts-ignore
            const stats = await (client as any).friendStats.findUnique({
                where: { userId }
            });
            return stats;
        } catch (e) {
            logger.error(`Failed to get stats for ${userId}:`, e);
            return null;
        }
    }

    /**
     * Bulk fetch for Friend List View.
     */
    public async getBulkFriendStats(userIds: string[]): Promise<Map<string, { timeSpent: number; encounterCount: number; lastSeen: Date; createdAt: Date; friendSince: Date | null }>> {
        if (!this.isInitialized || userIds.length === 0) return new Map();

        const map = new Map();
        try {
            const client = databaseService.getClient();
            // @ts-ignore
            const results = await (client as any).friendStats.findMany({
                where: {
                    userId: { in: userIds }
                }
            });

            for (const row of results) {
                map.set(row.userId, {
                    timeSpent: row.timeSpentMinutes * 60 * 1000, // Convert minutes to ms for frontend compatibility
                    encounterCount: row.encounterCount,
                    lastSeen: row.lastSeen,
                    createdAt: row.createdAt || new Date(), // Fallback if old data is null
                    friendSince: row.friendSince || null
                });
            }
        } catch (e) {
            logger.error('Failed to fetch bulk stats:', e);
        }
        return map;
    }

    /**
     * Updates the "Friend Since" date for a user in the database.
     * This is an authoritative, one-way update (only if not already set).
     */
    public async updateFriendSince(userId: string, date: Date | string) {
        if (!this.isInitialized) return;

        try {
            const client = databaseService.getClient();
            const friendSince = date instanceof Date ? date : new Date(date);

            // Fetch existing to see if we need to update
            // @ts-ignore
            const existing = await (client as any).friendStats.findUnique({
                where: { userId }
            });

            if (existing && existing.friendSince) {
                // Already has a date, don't overwrite the original "Added" date
                return;
            }

            // Upsert with the date
            // @ts-ignore
            await (client as any).friendStats.upsert({
                where: { userId },
                create: {
                    userId,
                    displayName: 'Unknown',
                    timeSpentMinutes: 0,
                    encounterCount: 0,
                    lastSeen: new Date(),
                    friendSince: friendSince,
                    createdAt: new Date()
                },
                update: {
                    friendSince: friendSince
                }
            });

            logger.info(`Updated friendSince date for ${userId}: ${friendSince.toISOString()}`);
        } catch (e) {
            logger.error(`Failed to update friendSince for ${userId}:`, e);
        }
    }

    /**
     * Migration Utility: Reads the entire legacy relationships.jsonl ONCE,
     * extracts "Added" dates, and saves them to the DB.
     * This eliminates the need to parse the log every time the Friend List opens.
     */
    private async migrateLegacyRelationDates(userDataDir: string) {
        if (!userDataDir) return;
        const logPath = path.join(userDataDir, 'relationships.jsonl');

        if (!fs.existsSync(logPath)) return;

        logger.info('Starting one-time legacy relation date migration...');

        try {
            const content = fs.readFileSync(logPath, 'utf-8');
            const lines = content.trim().split('\n');

            // Map of userId -> Earliest ADD date
            const addedDates = new Map<string, string>();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    if (event.type === 'add' && event.userId && event.timestamp) {
                        // Keep the earliest one found (log is chronologically ordered, but we reverse it later?)
                        // Log is appended, so first seen is oldest.
                        if (!addedDates.has(event.userId)) {
                            addedDates.set(event.userId, event.timestamp);
                        }
                    }
                } catch { /* ignore broken lines */ }
            }

            if (addedDates.size === 0) {
                logger.info('No legacy "add" events found to migrate.');
                return;
            }

            logger.info(`Found ${addedDates.size} friends to migrate from legacy logs.`);

            // Perform batch update to DB
            for (const [userId, timestamp] of addedDates.entries()) {
                await this.updateFriendSince(userId, timestamp);
            }

            logger.info('Legacy relation date migration complete.');
        } catch (e) {
            logger.error('Failed to parse legacy relationship log for migration:', e);
        }
    }
}

export const timeTrackingService = new TimeTrackingService();
