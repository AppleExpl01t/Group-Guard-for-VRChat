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
        const url = this.getWebhook(groupId);
        if (!url) throw new Error("No webhook configured for this group.");

        await this.postToDiscord(url, {
            content: "Group Guard webhook test successful"
        });
    }

    public async sendEvent(groupId: string, title: string, description: string, color: number = 0x5865F2, fields: {name: string, value: string, inline?: boolean}[] = []) {
        const url = this.getWebhook(groupId);
        if (!url) return; // No webhook, silent fail

        const embed = {
            title,
            description,
            color,
            fields,
            footer: {
                text: "VRChat Group Guard",
                icon_url: "https://assets.vrchat.com/www/brand/vrchat-logo-white-transparent.png"
            },
            timestamp: new Date().toISOString()
        };

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
}
