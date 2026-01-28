
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. Mock dependencies BEFORE importing the service
// Mock electron-log
vi.mock('electron-log', () => ({
    default: {
        scope: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        }),
    },
}));

// Mock ServiceEventBus
vi.mock('./ServiceEventBus', () => ({
    serviceEventBus: {
        emit: vi.fn(),
        on: vi.fn(),
    },
}));

// Mock AuthService
vi.mock('./AuthService', () => ({
    getVRChatClient: vi.fn(() => ({})),
}));

// Mock LRUCache
vi.mock('lru-cache', () => ({
    LRUCache: class {
        get() { return null; }
        set() { }
        has() { return false; }
    }
}));

// Mock Electron Store
const mockStoreMap = new Map<string, any>();
vi.mock('electron-store', () => {
    return {
        default: class {
            constructor() { }
            get(key: string) { return mockStoreMap.get(key); }
            set(key: string, val: any) { mockStoreMap.set(key, val); }
            clear() { mockStoreMap.clear(); }
        }
    };
});

// 2. Import the service (which triggers constructor)
import { groupAuthorizationService } from './GroupAuthorizationService';

describe('GroupAuthorizationService - Cache Security Test', () => {

    beforeEach(() => {
        mockStoreMap.clear();
        groupAuthorizationService.clearAllowedGroups();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should load owner ID from persistence and validate ownership', () => {
        const OwnerUser = 'usr_owner_123';
        const AttackerUser = 'usr_attacker_666';

        // Simulate existing disk cache with an owner
        mockStoreMap.set('allowedGroupIds', ['grp_1', 'grp_2']);
        mockStoreMap.set('cacheOwnerId', OwnerUser);

        // Force reload from disk (simulating app startup)
        // Accessing private method via type casting
        (groupAuthorizationService as any).loadPersistedGroups();

        // 1. Verify Cache matches Valid Owner
        expect(groupAuthorizationService.isCacheOwnedBy(OwnerUser)).toBe(true);

        // 2. Verify Cache REJECTS Different User
        expect(groupAuthorizationService.isCacheOwnedBy(AttackerUser)).toBe(false);
    });

    it('should fully wipe cache and owner on clearAllowedGroups (Logout)', () => {
        const OwnerUser = 'usr_logout_test';

        // Setup state
        mockStoreMap.set('allowedGroupIds', ['grp_test']);
        mockStoreMap.set('cacheOwnerId', OwnerUser);
        (groupAuthorizationService as any).loadPersistedGroups(); // Load it in

        // Verify initial state
        expect(groupAuthorizationService.isCacheOwnedBy(OwnerUser)).toBe(true);
        expect(mockStoreMap.size).toBeGreaterThan(0);

        // ACT: Clear groups (Simulate Logout)
        groupAuthorizationService.clearAllowedGroups();

        // ASSERT:
        // 1. Memory State Cleared
        expect(groupAuthorizationService.isCacheOwnedBy(OwnerUser)).toBe(false);
        expect(groupAuthorizationService.getAllowedGroupIds()).toHaveLength(0);

        // 2. Disk Persistence Cleared
        expect(mockStoreMap.size).toBe(0); // store.clear() should have been called
    });

    it('should persist ownerId when saving groups', () => {
        const NewOwner = 'usr_new_login';
        const rawGroups = [{ id: 'grp_new' }];

        // We need to simulate setAllowedGroups being called in a way that sets owner,
        // BUT setAllowedGroups itself doesn't take ownerId, processAndAuthorizeGroups does.
        // Or we can manually set the internal state if we just want to test persistence logic.

        // However, we modified processAndAuthorizeGroups to set this.cacheOwnerId = userId.
        // Let's testing verify that directly by mocking the flow part-way or just manual setting.

        (groupAuthorizationService as any).cacheOwnerId = NewOwner;
        (groupAuthorizationService as any).allowedGroupIds = new Set(['grp_new']);
        (groupAuthorizationService as any).persistGroups();

        // Check store
        expect(mockStoreMap.get('cacheOwnerId')).toBe(NewOwner);
        expect(mockStoreMap.get('allowedGroupIds')).toEqual(['grp_new']);
    });
});
