import Store from 'electron-store';
import { ipcMain } from 'electron';
import log from 'electron-log';

// Simplified Types
export type AutoModActionType = 'REJECT' | 'AUTO_BLOCK' | 'NOTIFY_ONLY';
// We'll define new rule types as we build them
export type AutoModRuleType = string; 

export interface AutoModRule {
    id: number;
    name: string;
    enabled: boolean;
    type: AutoModRuleType;
    config: string; // JSON
    actionType: AutoModActionType;
    createdAt?: string;
}

interface AutoModStoreSchema {
    rules: AutoModRule[];
}

// Initialize store
const store = new Store<AutoModStoreSchema>({
    name: 'automod-rules',
    defaults: {
        rules: []
    }
});

// Basic check function - currently does nothing as we are resetting
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const checkJoinRequest = (_user: unknown): { action: AutoModActionType | 'ALLOW'; reason?: string; ruleName?: string } => {
    return { action: 'ALLOW' };
};

export const setupAutoModHandlers = () => {
    log.info('[AutoMod] Initializing handlers (Reset State)...');

    ipcMain.handle('automod:get-rules', () => {
        return store.get('rules');
    });

    ipcMain.handle('automod:save-rule', (_e, rule: AutoModRule) => {
        const rules = store.get('rules');
        if (rule.id) {
            const index = rules.findIndex(r => r.id === rule.id);
            if (index !== -1) {
                rules[index] = { ...rules[index], ...rule };
            } else {
                rules.push(rule);
            }
        } else {
            rule.id = Date.now();
            rule.createdAt = new Date().toISOString();
            rules.push(rule);
        }
        store.set('rules', rules);
        return rule;
    });

    ipcMain.handle('automod:delete-rule', (_e, ruleId: number) => {
        const rules = store.get('rules');
        const newRules = rules.filter(r => r.id !== ruleId);
        store.set('rules', newRules);
        return true;
    });

    ipcMain.handle('automod:check-user', (_e, user: unknown) => {
        return checkJoinRequest(user);
    });
};
