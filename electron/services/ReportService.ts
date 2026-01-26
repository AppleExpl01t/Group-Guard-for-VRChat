import { ipcMain } from 'electron';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Store = require('electron-store');
import log from 'electron-log';

export interface ReportTemplate {
    id: string;
    name: string;
    content: string; // The template string with {{variables}}
    type: 'moderation' | 'general' | 'incident';
}

export interface ReportContext {
    target?: {
        displayName: string;
        id: string;
        userIcon?: string;
    };
    actor?: { // The moderator
        displayName: string;
        id: string;
    };
    world?: {
        name: string;
        id: string;
    };
    instance?: {
        id: string;
        name?: string;
    };
    reason?: string;
    evidence?: string[]; // URLs or text
    timestamp: string;
    notes?: string;
}

// Store setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: any = new Store({
    name: 'group-guard-reports',
    defaults: {
        templates: [
            {
                id: 'default-mod-report',
                name: 'Standard Moderation Report',
                type: 'moderation',
                content: `**Moderation Report**
**Target:** {{target.displayName}} ({{target.id}})
**Reason:** {{reason}}
**Location:** {{world.name}}
**Time:** {{timestamp}}

**Evidence:**
{{evidence_list}}

**Notes:**
{{notes}}`
            },
            {
                id: 'ban-appeal-stub',
                name: 'Ban Notification',
                type: 'moderation', 
                content: `User {{target.displayName}} has been banned from the group instance.
Reason: {{reason}}
Evidence has been logged.`
            }
        ]
    }
});

/**
 * Replace placeholders like {{target.displayName}} with actual values
 */
function compileTemplate(template: string, context: ReportContext): string {
    let result = template;

    // Helper to resolve nested properties safely, e.g. "target.displayName"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getValue = (obj: any, path: string): string => {
        const parts = path.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = obj;
        for (const part of parts) {
            if (current === undefined || current === null) return '';
            current = current[part];
        }
        return current !== undefined && current !== null ? String(current) : '';
    };

    // Replace basic variables
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        
        // Special handlers
        if (trimmedKey === 'evidence_list') {
            return (context.evidence || []).map(e => `- ${e}`).join('\n') || '(No evidence attached)';
        }
        
        return getValue(context, trimmedKey);
    });

    return result;
}

export function setupReportHandlers() {
    ipcMain.handle('report:get-templates', () => {
        return store.get('templates');
    });

    ipcMain.handle('report:save-template', (_event, template: ReportTemplate) => {
        const templates = store.get('templates') as ReportTemplate[];
        const index = templates.findIndex(t => t.id === template.id);
        
        if (index >= 0) {
            templates[index] = template;
        } else {
            templates.push(template);
        }
        
        store.set('templates', templates);
        return true;
    });

    ipcMain.handle('report:delete-template', (_event, templateId: string) => {
        let templates = store.get('templates') as ReportTemplate[];
        templates = templates.filter(t => t.id !== templateId);
        store.set('templates', templates);
        return true;
    });

    ipcMain.handle('report:generate', (_event, { templateId, context }: { templateId: string; context: ReportContext }) => {
        const templates = store.get('templates') as ReportTemplate[];
        const template = templates.find(t => t.id === templateId);
        
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        
        return compileTemplate(template.content, context);
    });
    
    log.info('ReportService initialized');
}
