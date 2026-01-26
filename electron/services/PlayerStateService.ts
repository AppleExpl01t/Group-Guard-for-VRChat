/**
 * PlayerStateService
 * 
 * Centralized service for managing player/entity state across the application.
 * Provides a single source of truth for "who is in the current instance" and
 * cached entity details (rank, group membership, avatar, etc.).
 * 
 * This service consolidates player tracking that was previously scattered across:
 * - LogWatcherService (players Map)
 * - InstanceService (entityCache LRU)
 */

import log from 'electron-log';
import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';

const logger = log.scope('PlayerStateService');

// ============================================
// TYPES
// ============================================

export interface PlayerJoinedEvent {
    displayName: string;
    userId?: string;
    timestamp: string;
    isBackfill?: boolean;
}

export interface LiveEntity {
    id: string; // userId (usr_...)
    displayName: string;
    rank: string; // 'Visitor' | 'New User' | 'User' | 'Known' | 'Trusted' | 'Veteran' | 'Legend' | 'Loading...'
    isGroupMember: boolean;
    status: 'active' | 'kicked' | 'joining';
    avatarUrl?: string;
    lastUpdated: number;
}

export interface InstanceState {
    worldId: string | null;
    worldName: string | null;
    location: string | null; // Full location string (worldId:instanceId)
}

// ============================================
// SERVICE CLASS
// ============================================

class PlayerStateService extends EventEmitter {
    // Current instance players (keyed by displayName for compatibility with LogWatcher)
    private players: Map<string, PlayerJoinedEvent> = new Map();
    
    // Current instance state
    private instanceState: InstanceState = {
        worldId: null,
        worldName: null,
        location: null
    };
    
    // Entity cache (enriched player data with rank, group membership, etc.)
    // Key format: "groupId:userId" or "roam:userId"
    private entityCache: LRUCache<string, LiveEntity>;

    constructor() {
        super();
        this.entityCache = new LRUCache<string, LiveEntity>({
            max: 5000,
            ttl: 1000 * 60 * 60 * 2, // 2 hours TTL
            updateAgeOnGet: true
        });
    }

    // ========================================
    // INSTANCE STATE
    // ========================================

    getInstanceState(): InstanceState {
        return { ...this.instanceState };
    }

    getCurrentWorldId(): string | null {
        return this.instanceState.worldId;
    }

    getCurrentWorldName(): string | null {
        return this.instanceState.worldName;
    }

    getCurrentLocation(): string | null {
        return this.instanceState.location;
    }

    setInstanceState(worldId: string | null, worldName: string | null, location: string | null): void {
        const locationChanged = this.instanceState.location !== location;
        
        this.instanceState = { worldId, worldName, location };
        
        if (locationChanged) {
            logger.info(`Instance state changed: ${location || 'null'}`);
            this.emit('instance-changed', this.instanceState);
            
            // Clear players on location change
            if (location !== null) {
                this.clearPlayers();
            }
        }
    }

    updateWorldName(name: string): void {
        this.instanceState.worldName = name;
        this.emit('world-name-changed', name);
    }

    // ========================================
    // PLAYERS (Current Instance)
    // ========================================

    getPlayers(): PlayerJoinedEvent[] {
        return Array.from(this.players.values());
    }

    getPlayerCount(): number {
        return this.players.size;
    }

    hasPlayer(displayName: string): boolean {
        return this.players.has(displayName);
    }

    hasPlayerById(userId: string): boolean {
        return Array.from(this.players.values()).some(p => p.userId === userId);
    }

    getPlayer(displayName: string): PlayerJoinedEvent | undefined {
        return this.players.get(displayName);
    }

    addPlayer(event: PlayerJoinedEvent): void {
        this.players.set(event.displayName, event);
        logger.info(`Player added: ${event.displayName} (${event.userId || 'No ID'})`);
        this.emit('player-added', event);
    }

    removePlayer(displayName: string): PlayerJoinedEvent | undefined {
        const player = this.players.get(displayName);
        if (player) {
            this.players.delete(displayName);
            logger.info(`Player removed: ${displayName}`);
            this.emit('player-removed', player);
        }
        return player;
    }

    clearPlayers(): void {
        const count = this.players.size;
        this.players.clear();
        if (count > 0) {
            logger.info(`Cleared ${count} players`);
            this.emit('players-cleared');
        }
    }

    // ========================================
    // ENTITY CACHE (Enriched Player Data)
    // ========================================

    getEntity(cacheKey: string): LiveEntity | undefined {
        return this.entityCache.get(cacheKey);
    }

    hasEntity(cacheKey: string): boolean {
        return this.entityCache.has(cacheKey);
    }

    setEntity(cacheKey: string, entity: LiveEntity): void {
        this.entityCache.set(cacheKey, entity);
        this.emit('entity-updated', entity);
    }

    /**
     * Build a cache key for entity lookups
     * @param groupId - The group ID context, or undefined for roaming mode
     * @param userId - The user's ID
     */
    buildEntityCacheKey(groupId: string | undefined, userId: string): string {
        return groupId ? `${groupId}:${userId}` : `roam:${userId}`;
    }

    /**
     * Get or create a placeholder entity for a player
     */
    getOrCreateEntity(cacheKey: string, displayName: string, userId: string): LiveEntity {
        let entity = this.entityCache.get(cacheKey);
        
        if (!entity) {
            entity = {
                id: userId,
                displayName,
                rank: 'Loading...',
                isGroupMember: false,
                status: 'active',
                lastUpdated: 0
            };
        }
        
        return entity;
    }

    // ========================================
    // BULK OPERATIONS
    // ========================================

    /**
     * Reset all state (called on game close or logout)
     */
    reset(): void {
        logger.info('Resetting player state');
        this.players.clear();
        this.instanceState = { worldId: null, worldName: null, location: null };
        // Note: entityCache is preserved since it's expensive to refetch
        this.emit('state-reset');
    }

    /**
     * Clear entity cache (for debugging or memory management)
     */
    clearEntityCache(): void {
        this.entityCache.clear();
        logger.info('Entity cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { players: number; entities: number } {
        return {
            players: this.players.size,
            entities: this.entityCache.size
        };
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const playerStateService = new PlayerStateService();

// ============================================
// SERVICE EXPORT
// ============================================

export default playerStateService;
