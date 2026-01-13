import { ipcMain } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';
import { logWatcherService, PlayerJoinedEvent, LocationEvent } from './LogWatcherService';
import { oscService } from './OscService';
import { getVRChatClient } from './AuthService';

const logger = log.scope('OscAnnouncementService');

export interface GroupAnnouncementConfig {
    greetingEnabled: boolean;
    greetingMessage: string;
    greetingMessageMembers?: string; // Optional custom message for members
    greetingMessageRep?: string; // Optional custom message for users representing the group
    periodicEnabled: boolean;
    periodicMessage: string;
    periodicIntervalMinutes: number;
    displayDurationSeconds?: number;
}

export interface OscAnnouncementStore {
    [groupId: string]: GroupAnnouncementConfig;
}

const DEFAULT_GROUP_CONFIG: GroupAnnouncementConfig = {
    greetingEnabled: false,
    greetingMessage: "Welcome [User] to the instance! check the description for rules.",
    greetingMessageMembers: "",
    greetingMessageRep: "",
    periodicEnabled: false,
    periodicMessage: "🛡️ This instance is protected by Group Guard.",
    periodicIntervalMinutes: 15,
    displayDurationSeconds: 10
};

class OscAnnouncementService {
    private store: Store<{ announcements: OscAnnouncementStore }>;
    private activeGroupId: string | null = null;
    private activeGroupName: string = 'Group';
    private periodicTimer: NodeJS.Timeout | null = null;
    private clearMessageTimer: NodeJS.Timeout | null = null;
    private greetedPlayers: Set<string> = new Set();
    private currentPlayers: Set<string> = new Set(); // To track who is actually here if we want to be smart

    constructor() {
        this.store = new Store<{ announcements: OscAnnouncementStore }>({
            name: 'osc-announcements',
            defaults: { announcements: {} }
        });
    }

    public start() {
        this.setupLogListeners();
        logger.info('OscAnnouncementService started');
    }

    private setupLogListeners() {
        logWatcherService.on('location', (event: LocationEvent) => {
            if (event.instanceId) {
                this.handleLocationChange(event.instanceId);
            }
        });

        logWatcherService.on('player-joined', (event: PlayerJoinedEvent) => {
            this.handlePlayerJoined(event);
        });
        
        // Handle leaving to clean up sets and allow re-greeting on rejoin
        logWatcherService.on('player-left', (event: { displayName: string; userId?: string }) => {
            this.currentPlayers.delete(event.displayName);
            // Clear from greeted set so they can be greeted again if they rejoin
            if (event.userId) {
                this.greetedPlayers.delete(event.userId);
            }
            this.greetedPlayers.delete(event.displayName);
        });
    }

    private handleLocationChange(instanceId: string) {
        // Extract Group ID: ~group(grp_...)
        // Use looser regex to match InstanceLoggerService implementation
        const groupMatch = instanceId.match(/~group\((grp_[a-f0-9-]+)\)/);
        const newGroupId = groupMatch ? groupMatch[1] : null;

        if (!newGroupId && instanceId.includes('~group')) {
            logger.warn(`Potential group ID mismatch. raw: ${instanceId}`);
        }

        if (this.activeGroupId !== newGroupId) {
            logger.info(`Location changed. Group: ${newGroupId || 'None'} (was ${this.activeGroupId || 'None'})`);
            this.activeGroupId = newGroupId;
            
            // Clean up old state
            this.stopPeriodicTimer();
            this.greetedPlayers.clear();
            this.currentPlayers.clear();

            // Setup new state if valid group
            if (this.activeGroupId) {
                this.updateGroupName(this.activeGroupId);
                this.startPeriodicTimer();
            }
        }
    }

    private async updateGroupName(groupId: string) {
        try {
            const client = getVRChatClient();
            if (client) {
                const response = await client.getGroup({ path: { groupId } });
                if (!response.error && response.data) {
                    this.activeGroupName = response.data.name;
                    logger.info(`Updated active group name to: ${this.activeGroupName}`);
                }
            }
        } catch (e) {
            logger.warn(`Failed to fetch group name for ${groupId}`, e);
            this.activeGroupName = 'Group';
        }
    }

    private handlePlayerJoined(event: PlayerJoinedEvent) {
        logger.info(`[handlePlayerJoined] Player: ${event.displayName}, ActiveGroup: ${this.activeGroupId}, isBackfill: ${event.isBackfill}`);
        
        this.currentPlayers.add(event.displayName);
        
        if (!this.activeGroupId) {
            logger.debug(`[handlePlayerJoined] No active group, skipping greeting.`);
            return;
        }

        const config = this.getGroupConfig(this.activeGroupId);
        logger.debug(`[handlePlayerJoined] Config: greetingEnabled=${config?.greetingEnabled}, greetingMessage=${!!config?.greetingMessage}`);
        
        if (!config || !config.greetingEnabled || !config.greetingMessage) {
            logger.debug(`[handlePlayerJoined] Greeting disabled or no message, skipping.`);
            return;
        }

        // Use userId for deduping if available, otherwise fallback to name
        const trackingId = event.userId || event.displayName;

        if (this.greetedPlayers.has(trackingId)) {
            logger.debug(`Skipping greeting for ${event.displayName} (already greeted)`);
            return;
        }

        this.greetedPlayers.add(trackingId);

        // Schedule greeting
        logger.info(`Scheduling greeting for ${event.displayName} in 10s`);
        setTimeout(async () => {
            // Verify player is still here/we are still in the group
            if (!this.activeGroupId) return;
            
            const currentConfig = this.getGroupConfig(this.activeGroupId);
            if (!currentConfig?.greetingEnabled) return;

            // Determine which message to use (Priority: Rep > Member > Default)
            let message = currentConfig.greetingMessage;
            let messageType = 'default';
            
            try {
                const client = getVRChatClient();
                if (client && event.userId && this.activeGroupId) {
                    // 1. First check if user is REPRESENTING the group
                    if (currentConfig.greetingMessageRep && currentConfig.greetingMessageRep.trim() !== '') {
                        try {
                            const repResponse = await client.get('/users/{userId}/groups/represented', {
                                params: { path: { userId: event.userId } }
                            });
                            if (repResponse.data && (repResponse.data as { groupId?: string }).groupId === this.activeGroupId) {
                                message = currentConfig.greetingMessageRep;
                                messageType = 'rep';
                                logger.info(`${event.displayName} is representing the group! Using rep message.`);
                            }
                        } catch (repErr) {
                            // User may not be representing any group, that's fine
                            logger.debug(`Rep check for ${event.displayName}:`, repErr);
                        }
                    }
                    
                    // 2. If not rep, check if they are a MEMBER
                    if (messageType === 'default' && currentConfig.greetingMessageMembers && currentConfig.greetingMessageMembers.trim() !== '') {
                        try {
                            const memResponse = await client.getGroupMember({ path: { groupId: this.activeGroupId, userId: event.userId } });
                            if (memResponse && !memResponse.error) {
                                message = currentConfig.greetingMessageMembers;
                                messageType = 'member';
                            }
                        } catch (memErr) {
                            logger.debug(`Member check for ${event.displayName}:`, memErr);
                        }
                    }
                }
            } catch (e) {
                logger.warn('Failed to check rep/membership for greeting', e);
            }

            // Replace Placeholders
            const finalMessage = message
                .replace(/\[User\]/g, event.displayName)
                .replace(/\[Group\]/g, this.activeGroupName);

            this.sendOscMessage(finalMessage, currentConfig.displayDurationSeconds);

        }, 10000);
    }

    private startPeriodicTimer() {
        if (!this.activeGroupId) return;
        
        const config = this.getGroupConfig(this.activeGroupId);
        if (!config || !config.periodicEnabled || !config.periodicMessage || config.periodicIntervalMinutes <= 0) return;

        logger.info(`Starting periodic announcement every ${config.periodicIntervalMinutes}m for ${this.activeGroupId}`);
        
        this.periodicTimer = setInterval(() => {
            if (!this.activeGroupId) {
                this.stopPeriodicTimer();
                return;
            }
            
            // Re-fetch config in case it changed during interval
            const currentConfig = this.getGroupConfig(this.activeGroupId);
            if (!currentConfig?.periodicEnabled) {
                this.stopPeriodicTimer();
                return;
            }

            const message = currentConfig.periodicMessage.replace(/\[Group\]/g, this.activeGroupName);
            this.sendOscMessage(message, currentConfig.displayDurationSeconds);

        }, config.periodicIntervalMinutes * 60 * 1000);
    }

    private stopPeriodicTimer() {
        if (this.periodicTimer) {
            clearInterval(this.periodicTimer);
            this.periodicTimer = null;
        }
    }

    private sendOscMessage(text: string, durationSeconds?: number) {
        // Clear pending clear-timer
        if (this.clearMessageTimer) {
            clearTimeout(this.clearMessageTimer);
            this.clearMessageTimer = null;
        }

        // VRChat Chatbox Limit is 144 chars. 
        const SAFE_TEXT = text.substring(0, 144);
        logger.info(`Sending OSC announcement: "${SAFE_TEXT}"`);
        oscService.send('/chatbox/input', [SAFE_TEXT, true, false]); // Message, Instant, No Sound
        
        // Schedule clear if duration is set and > 0
        if (durationSeconds && durationSeconds > 0) {
             this.clearMessageTimer = setTimeout(() => {
                 logger.info('Clearing OSC announcement (duration expired)');
                 oscService.send('/chatbox/input', ["", true, false]);
                 this.clearMessageTimer = null;
             }, durationSeconds * 1000);
        }
    }

    // Public API for IPC
    public getGroupConfig(groupId: string): GroupAnnouncementConfig {
        const stored = this.store.get(`announcements.${groupId}`) || {};
        return { ...DEFAULT_GROUP_CONFIG, ...stored };
    }

    public setGroupConfig(groupId: string, config: Partial<GroupAnnouncementConfig>) {
        const current = this.getGroupConfig(groupId);
        const updated = { ...current, ...config };
        this.store.set(`announcements.${groupId}`, updated);
        
        // If this is the active group, restart timers
        if (this.activeGroupId === groupId) {
            this.stopPeriodicTimer();
            if (updated.periodicEnabled) {
                this.startPeriodicTimer();
            }
        }
        
        return updated;
    }
}

export const oscAnnouncementService = new OscAnnouncementService();

export function setupOscAnnouncementHandlers() {
    // Start the service listeners
    oscAnnouncementService.start();

    ipcMain.handle('osc:get-announcement-config', (_event, groupId: string) => {
        return oscAnnouncementService.getGroupConfig(groupId);
    });

    ipcMain.handle('osc:set-announcement-config', (_event, { groupId, config }: { groupId: string, config: Partial<GroupAnnouncementConfig> }) => {
        return oscAnnouncementService.setGroupConfig(groupId, config);
    });
}
