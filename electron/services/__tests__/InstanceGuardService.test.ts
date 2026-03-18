/**
 * InstanceGuardService Tests
 *
 * Covers:
 *  1. In-memory cache helpers (isClosed, markClosed, pruneClosedInstancesCache)
 *  2. Event history management (addEvent, getHistory, clearHistory)
 *  3. processInstanceGuard — the main enforcement loop — with all external
 *     dependencies mocked (VRChatApiService, GroupAuthorizationService,
 *     AutoModConfigService, DatabaseService, WindowService).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock functions
// ---------------------------------------------------------------------------
const {
    mockGetAllowedGroupIds,
    mockGetGroupConfig,
    mockGetGroupInstances,
    mockGetInstance,
    mockCloseInstance,
    mockGetUser,
    mockBroadcast,
    mockCreateAutoModLog,
} = vi.hoisted(() => ({
    mockGetAllowedGroupIds: vi.fn<[], string[]>(),
    mockGetGroupConfig: vi.fn(),
    mockGetGroupInstances: vi.fn(),
    mockGetInstance: vi.fn(),
    mockCloseInstance: vi.fn(),
    mockGetUser: vi.fn(),
    mockBroadcast: vi.fn(),
    mockCreateAutoModLog: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock('../GroupAuthorizationService', () => ({
    groupAuthorizationService: { getAllowedGroupIds: mockGetAllowedGroupIds },
}));

vi.mock('../AutoModConfigService', () => ({
    autoModConfigService: { getGroupConfig: mockGetGroupConfig },
}));

vi.mock('../VRChatApiService', () => ({
    vrchatApiService: {
        getGroupInstances: mockGetGroupInstances,
        getInstance: mockGetInstance,
        closeInstance: mockCloseInstance,
        getUser: mockGetUser,
    },
}));

vi.mock('../WindowService', () => ({
    windowService: { broadcast: mockBroadcast },
}));

vi.mock('../DatabaseService', () => ({
    databaseService: { createAutoModLog: mockCreateAutoModLog },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { instanceGuardService, type InstanceGuardEvent } from '../InstanceGuardService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_ID = 'grp_test';
const WORLD_ID = 'wrld_aaaa';
const INSTANCE_ID = '12345~private(usr_owner)';
const INSTANCE_KEY = `${GROUP_ID}:${WORLD_ID}:${INSTANCE_ID}`;

function makeInstance(overrides: Record<string, unknown> = {}) {
    return {
        worldId: WORLD_ID,
        instanceId: INSTANCE_ID,
        world: { id: WORLD_ID, name: 'Test World', ageGate: false },
        ownerId: 'usr_owner_1',
        n_users: 5,
        ...overrides,
    };
}

function makeEvent(overrides: Partial<InstanceGuardEvent> = {}): InstanceGuardEvent {
    return {
        id: `ig_${Date.now()}`,
        timestamp: Date.now(),
        action: 'OPENED',
        worldId: WORLD_ID,
        worldName: 'Test World',
        instanceId: INSTANCE_ID,
        groupId: GROUP_ID,
        ...overrides,
    };
}

// Reset mutable module state before each test by clearing history + cache
beforeEach(() => {
    vi.clearAllMocks();
    instanceGuardService.clearHistory();

    // Drain the closed-instances cache by using a time-hack:
    // pruneClosedInstancesCache relies on Date.now() — we reset it by
    // directly testing against an empty state after clearHistory.
    // Module-level sets persist between tests; use unique keys per test to
    // avoid cross-test contamination, or accept that markClosed is additive.
});

// ---------------------------------------------------------------------------
// isClosed / markClosed
// ---------------------------------------------------------------------------
describe('isClosed / markClosed', () => {
    it('returns false for a key that has never been marked', () => {
        expect(instanceGuardService.isClosed('grp_x:wrld_x:never_closed')).toBe(false);
    });

    it('returns true immediately after markClosed is called', () => {
        const key = `unique_key_${Date.now()}_mark`;
        instanceGuardService.markClosed(key);
        expect(instanceGuardService.isClosed(key)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// pruneClosedInstancesCache
// ---------------------------------------------------------------------------
describe('pruneClosedInstancesCache', () => {
    it('removes entries older than 30 minutes', () => {
        const key = `prune_key_${Date.now()}`;
        instanceGuardService.markClosed(key);
        expect(instanceGuardService.isClosed(key)).toBe(true);

        // Simulate 31 minutes passing by manipulating Date.now
        const future = Date.now() + 31 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValue(future);

        instanceGuardService.pruneClosedInstancesCache();

        expect(instanceGuardService.isClosed(key)).toBe(false);
        vi.restoreAllMocks();
    });

    it('keeps entries that are within the 30 minute TTL', () => {
        const key = `keep_key_${Date.now()}`;
        instanceGuardService.markClosed(key);

        // 10 minutes later — should NOT be pruned
        const soon = Date.now() + 10 * 60 * 1000;
        vi.spyOn(Date, 'now').mockReturnValue(soon);

        instanceGuardService.pruneClosedInstancesCache();

        expect(instanceGuardService.isClosed(key)).toBe(true);
        vi.restoreAllMocks();
    });
});

// ---------------------------------------------------------------------------
// addEvent / getHistory / clearHistory
// ---------------------------------------------------------------------------
describe('event history', () => {
    it('addEvent stores an event and broadcasts it', () => {
        const event = makeEvent({ action: 'OPENED' });
        instanceGuardService.addEvent(event);

        expect(instanceGuardService.getHistory()).toHaveLength(1);
        expect(mockBroadcast).toHaveBeenCalledWith('instance-guard:event', event);
    });

    it('getHistory filters by groupId when provided', () => {
        instanceGuardService.addEvent(makeEvent({ groupId: 'grp_a' }));
        instanceGuardService.addEvent(makeEvent({ groupId: 'grp_b' }));

        expect(instanceGuardService.getHistory('grp_a')).toHaveLength(1);
        expect(instanceGuardService.getHistory('grp_b')).toHaveLength(1);
        expect(instanceGuardService.getHistory()).toHaveLength(2);
    });

    it('clearHistory empties the history array', () => {
        instanceGuardService.addEvent(makeEvent());
        instanceGuardService.clearHistory();
        expect(instanceGuardService.getHistory()).toHaveLength(0);
    });

    it('addEvent inserts new events at the front (newest first)', () => {
        const older = makeEvent({ id: 'ig_older', worldName: 'Old World' });
        const newer = makeEvent({ id: 'ig_newer', worldName: 'New World' });
        instanceGuardService.addEvent(older);
        instanceGuardService.addEvent(newer);

        const history = instanceGuardService.getHistory();
        expect(history[0].id).toBe('ig_newer');
        expect(history[1].id).toBe('ig_older');
    });
});

// ---------------------------------------------------------------------------
// processInstanceGuard — guard conditions
// ---------------------------------------------------------------------------
describe('processInstanceGuard — guard conditions', () => {
    it('returns immediately with zeros when no groups are authorized', async () => {
        mockGetAllowedGroupIds.mockReturnValue([]);
        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(0);
        expect(result.groupsChecked).toBe(0);
        expect(mockGetGroupConfig).not.toHaveBeenCalled();
    });

    it('skips a group that has no instance guard rules enabled', async () => {
        mockGetAllowedGroupIds.mockReturnValue([GROUP_ID]);
        mockGetGroupConfig.mockReturnValue({ rules: [] });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.groupsChecked).toBe(0);
        expect(mockGetGroupInstances).not.toHaveBeenCalled();
    });

    it('skips a group when the API call for instances fails', async () => {
        mockGetAllowedGroupIds.mockReturnValue([GROUP_ID]);
        mockGetGroupConfig.mockReturnValue({
            rules: [{ type: 'CLOSE_ALL_INSTANCES', enabled: true, config: '{}' }],
        });
        mockGetGroupInstances.mockResolvedValue({ success: false, error: 'API error' });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// processInstanceGuard — CLOSE_ALL_INSTANCES rule
// ---------------------------------------------------------------------------
describe('processInstanceGuard — CLOSE_ALL_INSTANCES rule', () => {
    beforeEach(() => {
        mockGetAllowedGroupIds.mockReturnValue([GROUP_ID]);
        mockGetGroupConfig.mockReturnValue({
            rules: [{ type: 'CLOSE_ALL_INSTANCES', enabled: true, config: '{}' }],
        });
        mockGetUser.mockResolvedValue({ success: true, data: { displayName: 'OwnerUser' } });
        mockCreateAutoModLog.mockResolvedValue(undefined);
    });

    it('closes an instance that is not whitelisted', async () => {
        mockGetGroupInstances.mockResolvedValue({ success: true, data: [makeInstance()] });
        mockCloseInstance.mockResolvedValue({ success: true });

        const uniqueInstanceId = `close_all_${Date.now()}`;
        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({ instanceId: uniqueInstanceId })],
        });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(1);
        expect(mockCloseInstance).toHaveBeenCalledWith(WORLD_ID, uniqueInstanceId);
    });

    it('does NOT close a whitelisted world', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [{
                type: 'CLOSE_ALL_INSTANCES',
                enabled: true,
                config: JSON.stringify({ whitelistedWorlds: [WORLD_ID] }),
            }],
        });
        const uniqueId = `whitelist_${Date.now()}`;
        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({ instanceId: uniqueId })],
        });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(0);
        expect(mockCloseInstance).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// processInstanceGuard — INSTANCE_18_GUARD rule
// ---------------------------------------------------------------------------
describe('processInstanceGuard — INSTANCE_18_GUARD rule', () => {
    beforeEach(() => {
        mockGetAllowedGroupIds.mockReturnValue([GROUP_ID]);
        mockGetGroupConfig.mockReturnValue({
            rules: [{ type: 'INSTANCE_18_GUARD', enabled: true, config: '{}' }],
        });
        mockGetUser.mockResolvedValue({ success: true, data: { displayName: 'OwnerUser' } });
        mockCreateAutoModLog.mockResolvedValue(undefined);
    });

    it('closes an instance that does not have an age gate', async () => {
        const uniqueId = `no_age_gate_${Date.now()}`;
        // getInstance returns no age gate
        mockGetInstance.mockResolvedValue({
            success: true,
            data: { ageGate: false, world: { id: WORLD_ID, name: 'Test World', ageGate: false } },
        });
        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({ instanceId: uniqueId, world: { id: WORLD_ID, name: 'Test World', ageGate: false } })],
        });
        mockCloseInstance.mockResolvedValue({ success: true });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(1);
    });

    it('does NOT close an instance that has a proper 18+ age gate', async () => {
        const uniqueId = `has_age_gate_${Date.now()}`;
        mockGetInstance.mockResolvedValue({
            success: true,
            data: { ageGate: true, world: { id: WORLD_ID, name: 'Test World', ageGate: true } },
        });
        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({
                instanceId: uniqueId,
                world: { id: WORLD_ID, name: 'Test World', ageGate: true },
            })],
        });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(0);
        expect(mockCloseInstance).not.toHaveBeenCalled();
    });

    it('closes a blacklisted world regardless of its age gate status', async () => {
        const uniqueId = `blacklisted_${Date.now()}`;
        const blacklistedWorldId = 'wrld_blacklisted';
        mockGetGroupConfig.mockReturnValue({
            rules: [{
                type: 'INSTANCE_18_GUARD',
                enabled: true,
                config: JSON.stringify({ blacklistedWorlds: [blacklistedWorldId] }),
            }],
        });
        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({
                worldId: blacklistedWorldId,
                instanceId: uniqueId,
                world: { id: blacklistedWorldId, name: 'Blacklisted World', ageGate: true },
            })],
        });
        mockCloseInstance.mockResolvedValue({ success: true });

        const result = await instanceGuardService.processInstanceGuard();
        expect(result.totalClosed).toBe(1);
        expect(mockCloseInstance).toHaveBeenCalledWith(blacklistedWorldId, uniqueId);
    });
});

// ---------------------------------------------------------------------------
// processInstanceGuard — duplicate prevention
// ---------------------------------------------------------------------------
describe('processInstanceGuard — duplicate prevention', () => {
    it('does not close an instance that was already marked as closed', async () => {
        mockGetAllowedGroupIds.mockReturnValue([GROUP_ID]);
        mockGetGroupConfig.mockReturnValue({
            rules: [{ type: 'CLOSE_ALL_INSTANCES', enabled: true, config: '{}' }],
        });
        const uniqueId = `dup_check_${Date.now()}`;
        const key = `${GROUP_ID}:${WORLD_ID}:${uniqueId}`;

        // Pre-mark as closed
        instanceGuardService.markClosed(key);

        mockGetGroupInstances.mockResolvedValue({
            success: true,
            data: [makeInstance({ instanceId: uniqueId })],
        });

        await instanceGuardService.processInstanceGuard();
        expect(mockCloseInstance).not.toHaveBeenCalled();
    });
});
