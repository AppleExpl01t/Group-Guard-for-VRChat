import DiscordRPC from 'discord-rpc';
import log from 'electron-log';
import { ipcMain } from 'electron';
import Store from 'electron-store';

const logger = log.scope('DiscordRPC');

// Config store for Discord RPC settings
const store = new Store<{ discordRpc: DiscordRpcConfig }>({ 
    name: 'discord-rpc-config',
    defaults: {
        discordRpc: {
            enabled: true,
            showGroupName: true,
            showMemberCount: true,
            showElapsedTime: true,
            customDetails: '',
            customState: ''
        }
    }
});

export interface DiscordRpcConfig {
    enabled: boolean;
    showGroupName: boolean;
    showMemberCount: boolean;
    showElapsedTime: boolean;
    customDetails: string;  // Custom "details" text (first line)
    customState: string;    // Custom "state" text (second line)
}

// Default Discord Application Client ID
const DEFAULT_CLIENT_ID = '1459680492478664815';

export class DiscordBroadcastService {
    private rpc: DiscordRPC.Client;
    private isReady: boolean = false;
    private startTime: Date;
    private config: DiscordRpcConfig;
    private currentGroupName: string = '';
    private currentMemberCount: number = 0;

    constructor() {
        this.rpc = new DiscordRPC.Client({ transport: 'ipc' });
        this.startTime = new Date();
        this.config = store.get('discordRpc');

        this.rpc.on('ready', () => {
            this.isReady = true;
            logger.info('Connected to Discord!');
            this.refreshPresence();
        });

        this.rpc.on('disconnected', () => {
            this.isReady = false;
            logger.warn('Disconnected from Discord.');
        });

        // Setup IPC handlers
        this.setupIpcHandlers();
    }

    private setupIpcHandlers() {
        // Get current config
        ipcMain.handle('discord-rpc:get-config', async () => {
            return this.config;
        });

        // Set config
        ipcMain.handle('discord-rpc:set-config', async (_event, newConfig: DiscordRpcConfig) => {
            this.config = newConfig;
            store.set('discordRpc', newConfig);
            
            // If disabled, clear presence; otherwise refresh
            if (!newConfig.enabled) {
                this.clearPresence();
            } else {
                // Reconnect if not ready
                if (!this.isReady) {
                    await this.connect();
                }
                this.refreshPresence();
            }
            
            return { success: true };
        });

        // Get connection status
        ipcMain.handle('discord-rpc:get-status', async () => {
            return {
                connected: this.isReady,
                enabled: this.config.enabled
            };
        });

        // Manual reconnect
        ipcMain.handle('discord-rpc:reconnect', async () => {
            try {
                await this.disconnect();
                await this.connect();
                return { success: true };
            } catch (error) {
                logger.error('Reconnect failed:', error);
                return { success: false, error: String(error) };
            }
        });

        // Manual disconnect
        ipcMain.handle('discord-rpc:disconnect', async () => {
            await this.disconnect();
            return { success: true };
        });
    }

    public async connect(clientId: string = DEFAULT_CLIENT_ID) {
        if (!this.config.enabled) {
            logger.info('Discord RPC is disabled, skipping connection');
            return;
        }

        try {
            await this.rpc.login({ clientId }).catch(err => {
                logger.warn('Login failed (is Discord running?):', err);
            });
        } catch (error) {
            logger.error('Connection error:', error);
        }
    }

    public async disconnect() {
        if (this.rpc) {
            try {
                await this.rpc.destroy();
            } catch {
                // Ignore destroy errors
            }
            this.isReady = false;
            // Reinitialize RPC client for potential reconnection
            this.rpc = new DiscordRPC.Client({ transport: 'ipc' });
            this.rpc.on('ready', () => {
                this.isReady = true;
                logger.info('Reconnected to Discord!');
                this.refreshPresence();
            });
            this.rpc.on('disconnected', () => {
                this.isReady = false;
            });
        }
    }

    private clearPresence() {
        if (!this.isReady) return;
        try {
            this.rpc.clearActivity().catch(() => {});
        } catch {
            // Ignore
        }
    }

    private refreshPresence() {
        if (!this.isReady || !this.config.enabled) return;

        let details = 'Guarding Groups';
        let state = 'Idle';

        // Apply custom text if specified
        if (this.config.customDetails) {
            details = this.config.customDetails;
        } else if (this.config.showGroupName && this.currentGroupName) {
            details = `Guarding: ${this.currentGroupName}`;
        }

        if (this.config.customState) {
            state = this.config.customState;
        } else if (this.config.showMemberCount && this.currentMemberCount > 0) {
            state = `${this.currentMemberCount} players in instance`;
        }

        const activity: DiscordRPC.Presence = {
            details,
            state,
            largeImageKey: 'logo',
            largeImageText: 'VRChat Group Guard',
            instance: false,
        };

        if (this.config.showElapsedTime) {
            activity.startTimestamp = this.startTime;
        }

        this.rpc.setActivity(activity).catch(err => 
            logger.error('Failed to set activity:', err)
        );
    }

    public setActivity(activity: DiscordRPC.Presence) {
        if (!this.isReady || !this.config.enabled) return;
        
        const finalActivity = { ...activity };
        if (this.config.showElapsedTime) {
            finalActivity.startTimestamp = this.startTime;
        }

        this.rpc.setActivity(finalActivity).catch(err => 
            logger.error('Failed to set activity:', err)
        );
    }
    
    public updateGroupStatus(groupName: string, memberCount?: number) {
        this.currentGroupName = groupName;
        this.currentMemberCount = memberCount || 0;
        
        if (!this.config.enabled) return;
        
        this.refreshPresence();
    }

    public setIdle() {
        this.currentGroupName = '';
        this.currentMemberCount = 0;
        
        if (!this.config.enabled) return;

        this.setActivity({
            details: this.config.customDetails || 'Idling',
            state: this.config.customState || 'Waiting for connection...',
            largeImageKey: 'logo',
            instance: false
        });
    }

    public getConfig(): DiscordRpcConfig {
        return this.config;
    }

    public isConnected(): boolean {
        return this.isReady;
    }
}

export const discordBroadcastService = new DiscordBroadcastService();
