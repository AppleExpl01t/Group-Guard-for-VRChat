import { ipcMain } from "electron";
import log from "electron-log";
import Store from "electron-store";
import { autoModConfigService } from "./AutoModConfigService";
import { vrchatApiService } from "./VRChatApiService";

const logger = log.scope("StaffService");

// Store for protection settings per group - lazy initialized
let staffStore: Store | null = null;

function getStore(): Store {
    if (!staffStore) {
        staffStore = new Store({
            name: "staff-settings",
            defaults: {}
        });
    }
    return staffStore;
}

interface StaffSettings {
    skipAutoModScans: boolean;
    preventKicks: boolean;
    preventBans: boolean;
    allowAllInstances: boolean;
}

interface StaffMember {
    id: string;
    name: string;
    rules: string[];
}

const DEFAULT_SETTINGS: StaffSettings = {
    skipAutoModScans: true,
    preventKicks: true,
    preventBans: true,
    allowAllInstances: true
};

export const staffService = {
    /**
     * Get staff members for a group - delegates to AutoMod whitelist
     * Staff = whitelisted users
     */
    async getMembers(groupId: string): Promise<StaffMember[]> {
        if (!groupId) return [];

        const config = autoModConfigService.getGroupConfig(groupId);
        const rules = config.rules;
        const userMap = new Map<string, StaffMember>();

        for (const rule of rules) {
            if (rule.whitelistedUserIds) {
                for (const userId of rule.whitelistedUserIds) {
                    if (!userId) continue;
                    if (!userMap.has(userId)) {
                        let name = userId;
                        try {
                            const result = await vrchatApiService.getUser(userId);
                            if (result.success && result.data) name = result.data.displayName;
                        } catch { /* ignore */ }
                        userMap.set(userId, { id: userId, name, rules: [] });
                    }
                    userMap.get(userId)?.rules.push(rule.name);
                }
            }
        }

        return Array.from(userMap.values());
    },

    /**
     * Add a user to staff - adds them to ALL AutoMod rules' whitelists
     */
    async addMember(groupId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!groupId || !userId) return { success: false, error: "Invalid parameters" };

        const config = autoModConfigService.getGroupConfig(groupId);
        const rules = config.rules;
        let updated = false;

        // Add user to ALL rules' whitelists
        for (let i = 0; i < rules.length; i++) {
            if (!rules[i].whitelistedUserIds) {
                rules[i].whitelistedUserIds = [];
            }
            if (!rules[i].whitelistedUserIds!.includes(userId)) {
                rules[i].whitelistedUserIds!.push(userId);
                updated = true;
            }
        }

        if (updated) {
            autoModConfigService.saveGroupConfig(groupId, { ...config, rules });
            logger.info(`[Staff] Added user ${userId} to staff for group ${groupId}`);
        }

        return { success: true };
    },

    /**
     * Remove a user from staff - removes from ALL AutoMod rules' whitelists
     */
    async removeMember(groupId: string, userId: string): Promise<{ success: boolean; error?: string }> {
        if (!groupId || !userId) return { success: false, error: "Invalid parameters" };

        const config = autoModConfigService.getGroupConfig(groupId);
        const rules = config.rules;
        let updated = false;

        for (let i = 0; i < rules.length; i++) {
            if (rules[i].whitelistedUserIds?.includes(userId)) {
                rules[i].whitelistedUserIds = rules[i].whitelistedUserIds!.filter(uid => uid !== userId);
                updated = true;
            }
        }

        if (updated) {
            autoModConfigService.saveGroupConfig(groupId, { ...config, rules });
            logger.info(`[Staff] Removed user ${userId} from staff for group ${groupId}`);
        }

        return { success: true };
    },

    /**
     * Get protection settings for a group
     */
    getSettings(groupId: string): StaffSettings {
        if (!groupId) return DEFAULT_SETTINGS;
        const key = `settings.${groupId}`;
        return getStore().get(key, DEFAULT_SETTINGS) as StaffSettings;
    },

    /**
     * Save protection settings for a group
     */
    async setSettings(groupId: string, settings: Partial<StaffSettings>): Promise<{ success: boolean; error?: string }> {
        if (!groupId) return { success: false, error: "Invalid group ID" };
        const key = `settings.${groupId}`;
        const current = this.getSettings(groupId);
        const updated = { ...current, ...settings };
        getStore().set(key, updated);
        logger.info(`[Staff] Updated protection settings for group ${groupId}:`, updated);
        return { success: true };
    }
};

// ===== IPC HANDLERS =====
export const setupStaffHandlers = () => {
    logger.info("Initializing Staff handlers...");

    ipcMain.handle("staff:get-members", async (_, groupId: string) => {
        return staffService.getMembers(groupId);
    });

    ipcMain.handle("staff:add-member", async (_, { groupId, userId }: { groupId: string; userId: string }) => {
        return staffService.addMember(groupId, userId);
    });

    ipcMain.handle("staff:remove-member", async (_, { groupId, userId }: { groupId: string; userId: string }) => {
        return staffService.removeMember(groupId, userId);
    });

    ipcMain.handle("staff:get-settings", (_, groupId: string) => {
        return staffService.getSettings(groupId);
    });

    ipcMain.handle("staff:set-settings", (_, { groupId, settings }: { groupId: string; settings: Partial<StaffSettings> }) => {
        return staffService.setSettings(groupId, settings);
    });
};
