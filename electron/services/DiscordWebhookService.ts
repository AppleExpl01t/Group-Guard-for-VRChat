import Store from 'electron-store';
import { ipcMain } from 'electron';
import log from 'electron-log';
import fetch from 'cross-fetch'; // or use native fetch if node version > 18 (Electron 39 is node 20+)

const logger = log.scope('DiscordWebhookService');

interface WebhookConfigStore {
    webhooks: { [groupId: string]: string };
}

const store = new Store<WebhookConfigStore>({
    name: 'discord-webhooks',
    defaults: {
        webhooks: {}
    }
});

export interface WebhookEventData {
    title: string;
    description?: string;
    type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
    fields?: { name: string; value: string; inline?: boolean }[];
    targetUser?: { displayName: string; id: string; avatarUrl?: string };
    actor?: { displayName: string; id: string; avatarUrl?: string };
    footer?: string;
}

export class DiscordWebhookService {

    constructor() {}

    public getWebhook(groupId: string): string | undefined {
        return store.get(`webhooks.${groupId}`);
    }

    public setWebhook(groupId: string, url: string) {
        if (!url || url.trim() === '') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            store.delete(`webhooks.${groupId}` as any);
        } else {
            store.set(`webhooks.${groupId}`, url.trim());
        }
    }

    public async sendTestMessage(groupId: string) {
        await this.sendEvent(groupId, {
            title: 'Webhook Test',
            description: 'Your Group Guard webhook is configured correctly!',
            type: 'SUCCESS',
            fields: [
                { name: 'Status', value: 'Active', inline: true },
                { name: 'Group ID', value: groupId, inline: true }
            ],
            footer: 'Group Guard System'
        });
    }

    public async sendMockBan(groupId: string) {
        await this.sendEvent(groupId, {
            title: '🚫 User Banned (Simulation)',
            description: 'This is a **simulation** of a ban event. No actual user was banned.',
            type: 'ERROR',
            fields: [
                { name: 'User', value: '[BadActor123](https://vrchat.com)', inline: true },
                { name: 'Reason', value: 'Harassment / AutoMod', inline: true },
                { name: 'Admin', value: 'Group Guard System', inline: true }
            ],
            targetUser: {
                 displayName: 'BadActor123',
                 id: 'usr_fake_12345',
                 avatarUrl: 'https://assets.vrchat.com/www/brand/vrchat-logo-white-transparent.png' 
            },
            footer: 'Group Guard Simulation'
        });
    }

    public async sendEvent(groupId: string, data: WebhookEventData) {
        const url = this.getWebhook(groupId);
        if (!url) {
            logger.warn(`No webhook URL configured for group ${groupId}, skipping event: ${data.title}`);
            return;
        }

        logger.info(`Sending webhook event for group ${groupId}:`, JSON.stringify(data, null, 2));

        // Map type to color
        const colors: Record<string, number> = {
            'SUCCESS': 0x57F287, // Green
            'WARNING': 0xFEE75C, // Yellow
            'ERROR': 0xED4245,   // Red
            'INFO': 0x5865F2     // Blurple
        };

        const color = colors[data.type] || colors['INFO'];

        const embed: any = {
            title: data.title,
            description: data.description,
            color: color,
            fields: data.fields || [],
            footer: {
                text: data.footer || "VRChat Group Guard",
                icon_url: "https://assets.vrchat.com/www/brand/vrchat-logo-white-transparent.png"
            },
            timestamp: new Date().toISOString()
        };

        // Add Thumbnail (Target User)
        if (data.targetUser?.avatarUrl) {
            embed.thumbnail = { url: data.targetUser.avatarUrl };
        }

        // Add Author (Actor)
        if (data.actor) {
            embed.author = {
                name: data.actor.displayName,
                icon_url: data.actor.avatarUrl
            };
        }

        logger.info('Constructed Embed:', JSON.stringify(embed, null, 2));

        try {
            await this.postToDiscord(url, { embeds: [embed] });
        } catch (e) {
            logger.error(`Failed to send event to webhook for group ${groupId}`, e);
        }
    }

    private async postToDiscord(url: string, body: Record<string, unknown>) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                 const text = await response.text();
                 throw new Error(`Discord API Error ${response.status}: ${text}`);
            }
        } catch (error) {
            logger.error('Webhook POST failed', error);
            throw error;
        }
    }
}

export const discordWebhookService = new DiscordWebhookService();

export function setupDiscordWebhookHandlers() {
    ipcMain.handle('webhook:get-url', (_e, { groupId }: { groupId: string }) => {
        return discordWebhookService.getWebhook(groupId) || '';
    });

    ipcMain.handle('webhook:set-url', (_e, { groupId, url }: { groupId: string, url: string }) => {
        discordWebhookService.setWebhook(groupId, url);
        return true;
    });

    ipcMain.handle('webhook:test', async (_e, { groupId }: { groupId: string }) => {
        await discordWebhookService.sendTestMessage(groupId);
        return true;
    });

    ipcMain.handle('webhook:test-mock', async (_e, { groupId }: { groupId: string }) => {
        await discordWebhookService.sendMockBan(groupId);
        return true;
    });
}
