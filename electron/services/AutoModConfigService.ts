import Store from "electron-store";

// Simplified Types
export type AutoModActionType = "REJECT" | "AUTO_BLOCK" | "NOTIFY_ONLY";
export type AutoModRuleType = "AGE_VERIFICATION" | "INSTANCE_18_GUARD" | "INSTANCE_PERMISSION_GUARD" | string;

export interface AutoModRule {
  id: number;
  name: string;
  enabled: boolean;
  type: AutoModRuleType;
  config: string; // JSON
  actionType: AutoModActionType;
  createdAt?: string;

  // Exemptions
  whitelistedUserIds?: string[];
  whitelistedGroupIds?: string[];
}

export interface GroupConfig {
  rules: AutoModRule[];
  enableAutoProcess: boolean;
  enableAutoBan: boolean;
}

// Interface AutoModStoreSchema removed as it is unused due to 'any' typing of the store.

// Initialize store
// Fix for ESM/CJS interop (electron-store)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StoreClass = (Store as any).default || Store;

// Initialize store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const store: any = new (StoreClass as any)({
  name: "automod-rules",
  defaults: {
    groups: {},
    rules: [],
    enableAutoReject: false,
    enableAutoBan: false,
  },
  migrations: {
    "2.0.0": () => {
       // Future migration
    },
  },
});

export const autoModConfigService = {
  getGroupConfig: (groupId: string): GroupConfig => {
    const groups = store.get('groups', {});
    if (groups[groupId]) {
       const config = groups[groupId];
       // Migration: If enableAutoProcess is undefined, take enableAutoReject value if present, else false.
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if ((config as any).enableAutoProcess === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (config as any).enableAutoProcess = (config as any).enableAutoReject ?? false;
       }
       return config;
    }
    return { 
        rules: [], 
        enableAutoProcess: false, // Default OFF as requested
        enableAutoBan: false 
    };
  },

  saveGroupConfig: (groupId: string, config: GroupConfig) => {
    const groups = store.get('groups', {});
    groups[groupId] = config;
    store.set('groups', groups);
  }
};
