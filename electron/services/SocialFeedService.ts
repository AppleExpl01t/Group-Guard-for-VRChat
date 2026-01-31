import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { serviceEventBus } from './ServiceEventBus';

const logger = log.scope('SocialFeedService');

export interface SocialFeedEntry {
    id: string; // Unique ID (timestamp + random)
    type: 'online' | 'offline' | 'location' | 'status' | 'add' | 'remove' | 'notification' | 'avatar';
    userId: string;
    displayName: string;
    timestamp: string;
    details?: string; // Location name, or status message
    data?: Record<string, unknown>; // Extra data
}

/**
 * Manages the "Social Feed" (VRCX-style feed of friend activities).
 * Persists data to `social_feed.jsonl`.
 */
class SocialFeedService {
    private isInitialized = false;
    private dbPath: string | null = null;

    // Cache for last status to avoid spamming "Location" updates if they are identical
    // or to ignore rapid online/offline toggles
    private lastStatus = new Map<string, string>();
    private lastAvatarId = new Map<string, string>();

    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        serviceEventBus.on('friend-state-changed', (payload) => {
            if (!this.isInitialized) return;
            this.handleStateChange(payload);
        });

        serviceEventBus.on('friendship-relationship-changed', ({ event }) => {
            if (!this.isInitialized) return;
            this.handleRelationshipChange(event);
        });
    }

    public initialize(userDataDir: string) {
        this.dbPath = path.join(userDataDir, 'social_feed.jsonl');
        this.isInitialized = true;
        this.lastStatus.clear();
        this.cleanupLegacyEntries();
        logger.info(`SocialFeedService initialized. DB: ${this.dbPath}`);
    }

    public shutdown() {
        this.isInitialized = false;
        this.dbPath = null;
        this.lastStatus.clear();
    }

    private async handleStateChange(payload: { friend: any; previous: any; change: { status: boolean; location: boolean; statusDescription: boolean; representedGroup: boolean; avatar: boolean } }) {
        const { friend, previous, change } = payload;
        const userId = friend.userId;
        if (!userId) return;

        // Gather all entries to append
        const entries: Omit<SocialFeedEntry, 'id' | 'timestamp'>[] = [];

        // 1. STATUS CHANGES (Online / Offline / Status Text)
        if (change.status) {
            if (friend.status === 'offline') {
                entries.push({
                    type: 'offline',
                    userId,
                    displayName: friend.displayName,
                    details: 'Went Offline'
                });
                // RESET CACHE: Ensure we log their next avatar switch when they come back online
                this.lastAvatarId.delete(userId);
            } else if (!previous || previous.status === 'offline') {
                entries.push({
                    type: 'online',
                    userId,
                    displayName: friend.displayName,
                    details: 'Came Online'
                });
            } else {
                entries.push({
                    type: 'status',
                    userId,
                    displayName: friend.displayName,
                    details: `Status changed to ${friend.status.charAt(0).toUpperCase() + friend.status.slice(1)}`
                });
            }
        }

        // 2. STATUS DESCRIPTION / GROUP (Only if not offline)
        if (friend.status !== 'offline') {
            if (change.statusDescription) {
                const details = friend.statusDescription || 'Cleared';
                // Deduplicate status text
                if (this.lastStatus.get(userId) !== details) {
                    this.lastStatus.set(userId, details);
                    entries.push({
                        type: 'status',
                        userId,
                        displayName: friend.displayName,
                        details: friend.statusDescription ? `Status message: ${friend.statusDescription}` : 'Status message: Cleared'
                    });
                }
            }
            if (change.representedGroup) {
                entries.push({
                    type: 'status',
                    userId,
                    displayName: friend.displayName,
                    details: `Now representing: ${friend.representedGroup || 'No Group'}`
                });
            }
        }

        // 3. AVATAR CHANGE
        if (change.avatar && friend.status !== 'offline') {
            const avatarId = (friend as any).currentAvatarId;
            const avatarName = (friend as any).avatarName;

            if (avatarId && this.lastAvatarId.get(userId) !== avatarId) {
                this.lastAvatarId.set(userId, avatarId);
                entries.push({
                    type: 'avatar',
                    userId,
                    displayName: friend.displayName,
                    details: avatarName ? `Switched to ${avatarName}` : 'Avatar Changed',
                    data: {
                        currentAvatarId: avatarId,
                        avatarName: avatarName
                    }
                });
            }
        }

        // 4. LOCATION CHANGE (GPS / World Joins)
        if (change.location && friend.status !== 'offline') {
            const loc = friend.location?.toLowerCase() || '';
            const isNoisyLocation = loc === 'offline' || loc === 'private' || loc === 'travelling' || loc === 'traveling';

            if (!isNoisyLocation) {
                entries.push({
                    type: 'location',
                    userId,
                    displayName: friend.displayName,
                    details: friend.worldName || friend.location || 'Private World'
                });
            }
        }

        // PERSIST ALL GATHERED ENTRIES
        for (const entry of entries) {
            await (this as any).appendEntry(entry);
        }
    }

    private async handleRelationshipChange(event: any) {
        const { userId, displayName, type, timestamp } = event;
        const feedType = type === 'add' ? 'add' : (type === 'remove' ? 'remove' : null);

        if (!feedType) return;

        const entry: SocialFeedEntry = {
            id: `${timestamp}-${Math.random().toString(36).substr(2, 5)}`,
            type: feedType as any,
            userId,
            displayName,
            timestamp,
            details: type === 'add' ? 'Added as friend' : 'Removed from friends',
            data: event
        };
        await this.appendEntry(entry);
    }

    private async appendEntry(entry: Omit<SocialFeedEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
        if (!this.dbPath) return;

        const timestamp = entry.timestamp || new Date().toISOString();
        const fullEntry: SocialFeedEntry = {
            id: entry.id || `${timestamp}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp,
            ...entry
        };

        try {
            const line = JSON.stringify(fullEntry) + '\n';
            fs.appendFileSync(this.dbPath, line);
            serviceEventBus.emit('social-feed-entry-added', { entry: fullEntry });
        } catch (e) {
            logger.error('Failed to append social feed:', e);
        }
    }

    public async getRecentEntries(limit?: number): Promise<SocialFeedEntry[]> {
        if (!this.dbPath || !fs.existsSync(this.dbPath)) return [];
        try {
            const content = await fs.promises.readFile(this.dbPath, 'utf-8');
            const lines = content.trim().split('\n');
            const entries = (limit && limit > 0) ? lines.slice(-limit) : lines;
            return entries
                .map(line => {
                    try { return JSON.parse(line) as SocialFeedEntry; } catch { return null; }
                })
                .filter((e): e is SocialFeedEntry => e !== null)
                .reverse();
        } catch (e) {
            logger.error('Failed to read social feed:', e);
            return [];
        }
    }

    private async cleanupLegacyEntries() {
        if (!this.dbPath || !fs.existsSync(this.dbPath)) return;
        try {
            const content = await fs.promises.readFile(this.dbPath, 'utf-8');
            const lines = content.trim().split('\n');
            const newLines: string[] = [];

            let removedCount = 0;

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const entry = JSON.parse(line) as SocialFeedEntry;
                    if (entry.details === 'Status message: Cleared') {
                        removedCount++;
                        continue;
                    }
                    newLines.push(line);
                } catch {
                    newLines.push(line);
                }
            }

            if (removedCount > 0) {
                await fs.promises.writeFile(this.dbPath, newLines.join('\n') + '\n');
                logger.info(`Cleaned up ${removedCount} spam 'Status message: Cleared' entries from social feed.`);
            }

        } catch (e) {
            logger.error('Failed to cleanup legacy entries:', e);
        }
    }
}

export const socialFeedService = new SocialFeedService();
