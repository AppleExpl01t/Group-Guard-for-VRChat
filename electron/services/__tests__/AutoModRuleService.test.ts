/**
 * AutoModRuleService Tests
 *
 * Tests the core moderation rule engine that determines whether a VRChat user
 * should be allowed, rejected, blocked, or only notified.
 *
 * All external dependencies (electron-log, LRUCache, config service, user
 * profile service) are mocked so the tests exercise the rule logic in
 * isolation without any network or filesystem access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock functions — vi.hoisted ensures these exist before vi.mock()
// calls are evaluated (vi.mock is hoisted to the top of the file by Vitest)
// ---------------------------------------------------------------------------
const { mockGetGroupConfig, mockGetUserGroups } = vi.hoisted(() => ({
    mockGetGroupConfig: vi.fn(),
    mockGetUserGroups: vi.fn(),
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

// Use a real Map so caching behaviour is transparent to tests
vi.mock('lru-cache', () => ({
    LRUCache: class {
        private map = new Map<string, unknown>();
        has(key: string) { return this.map.has(key); }
        get(key: string) { return this.map.get(key); }
        set(key: string, val: unknown) { this.map.set(key, val); }
    },
}));

vi.mock('../AutoModConfigService', () => ({
    autoModConfigService: { getGroupConfig: mockGetGroupConfig },
}));

vi.mock('../UserProfileService', () => ({
    userProfileService: { getUserGroups: mockGetUserGroups },
}));

// ---------------------------------------------------------------------------
// Import service after mocks are in place
// ---------------------------------------------------------------------------
import { autoModRuleService } from '../AutoModRuleService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_ID = 'grp_test_group';

/** Build a minimal AutoMod rule */
function makeRule(overrides: Record<string, unknown>) {
    return {
        id: 1,
        name: 'Test Rule',
        type: 'KEYWORD_BLOCK',
        enabled: true,
        config: JSON.stringify({ keywords: ['badword'] }),
        actionType: 'REJECT',
        whitelistedUserIds: [] as string[],
        whitelistedGroupIds: [] as string[],
        ...overrides,
    };
}

/** Build a minimal VRChat user object */
function makeUser(overrides: Record<string, unknown> = {}) {
    return {
        id: 'usr_test_user',
        displayName: 'TestUser',
        tags: ['system_trust_known'],
        bio: '',
        status: '',
        statusDescription: '',
        pronouns: '',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: no user groups
    mockGetUserGroups.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// No rules / all rules disabled
// ---------------------------------------------------------------------------
describe('evaluateUser — no active rules', () => {
    it('returns ALLOW when the group has no rules', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [] });
        const result = await autoModRuleService.evaluateUser(makeUser(), {}, GROUP_ID);
        expect(result.action).toBe('ALLOW');
    });

    it('returns ALLOW when all rules are disabled', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ enabled: false })],
        });
        const result = await autoModRuleService.evaluateUser(makeUser(), {}, GROUP_ID);
        expect(result.action).toBe('ALLOW');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — display name
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK on display name', () => {
    it('rejects a user whose display name contains a blocked keyword (PARTIAL)', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['griefer'] }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'xXgrieferXx' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
        expect(result.reason).toContain('griefer');
    });

    it('allows a user whose display name does not contain any blocked keyword', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['griefer'] }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'NiceUser' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });

    it('is case-insensitive for keyword matching', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['BadWord'] }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badword' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — bio / status scanning
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK scanning bio and status', () => {
    it('rejects a user whose bio contains a blocked keyword when scanBio=true', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['hater'], scanBio: true, scanStatus: false }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ bio: 'I am a total hater of fun.' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
        expect(result.reason).toContain('hater');
    });

    it('allows a user even if bio contains keyword when scanBio=false', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['hater'], scanBio: false }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'CleanName', bio: 'I am a hater of fun.' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });

    it('rejects a user whose status contains a blocked keyword when scanStatus=true', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ config: JSON.stringify({ keywords: ['crasher'], scanBio: false, scanStatus: true }) })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ statusDescription: 'proud crasher lol' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — WHOLE_WORD match mode
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK WHOLE_WORD matching', () => {
    it('does NOT flag a user when the keyword is only a substring in WHOLE_WORD mode', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({
                config: JSON.stringify({ keywords: ['bad'], matchMode: 'WHOLE_WORD' }),
            })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badminton' }),
            {},
            GROUP_ID
        );
        // "bad" should not match "badminton" as a whole word
        expect(result.action).toBe('ALLOW');
    });

    it('flags a user when the keyword appears as a whole word', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({
                config: JSON.stringify({ keywords: ['bad'], matchMode: 'WHOLE_WORD' }),
            })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'bad player' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — keyword whitelist (exempts matched text)
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK keyword whitelist', () => {
    it('allows a user when the matched keyword context is whitelisted', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({
                config: JSON.stringify({
                    keywords: ['hate'],
                    whitelist: ['charity'],
                }),
            })],
        });
        // "hate" appears but so does the whitelisted word "charity"
        const result = await autoModRuleService.evaluateUser(
            makeUser({ bio: 'I hate cancer — charity fundraiser' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — user ID whitelist
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK user ID whitelist', () => {
    it('skips the rule entirely for a whitelisted user ID', async () => {
        const userId = 'usr_whitelisted_user';
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({
                config: JSON.stringify({
                    keywords: ['griefer'],
                    whitelistedUserIds: [userId],
                }),
            })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ id: userId, displayName: 'xXgrieferXx' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });
});

// ---------------------------------------------------------------------------
// KEYWORD_BLOCK — action types
// ---------------------------------------------------------------------------
describe('evaluateUser — KEYWORD_BLOCK action types', () => {
    it('returns the configured actionType on a match (AUTO_BLOCK)', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ actionType: 'AUTO_BLOCK' })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badword' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('AUTO_BLOCK');
    });

    it('returns the configured actionType on a match (NOTIFY_ONLY)', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ actionType: 'NOTIFY_ONLY' })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badword' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('NOTIFY_ONLY');
    });
});

// ---------------------------------------------------------------------------
// TRUST_CHECK
// ---------------------------------------------------------------------------
describe('evaluateUser — TRUST_CHECK', () => {
    const trustRule = makeRule({
        type: 'TRUST_CHECK',
        config: JSON.stringify({ minTrustLevel: 'trusted' }),
        actionType: 'REJECT',
    });

    it('rejects a visitor who is below the required trust level', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [trustRule] });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ tags: ['system_trust_visitor'] }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('REJECT');
        expect(result.reason).toContain('Trust Level');
    });

    it('allows a user at or above the required trust level', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [trustRule] });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ tags: ['system_trust_trusted'] }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });

    it('allows a veteran (above required trusted level)', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [trustRule] });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ tags: ['system_trust_veteran'] }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });

    it('skips trust check when allowMissingData=true and tags array is empty', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [trustRule] });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ tags: [] }),
            { allowMissingData: true },
            GROUP_ID
        );
        expect(result.action).toBe('ALLOW');
    });
});

// ---------------------------------------------------------------------------
// BLACKLISTED_GROUPS
// ---------------------------------------------------------------------------
describe('evaluateUser — BLACKLISTED_GROUPS', () => {
    const blacklistedGroupId = 'grp_bad_actors';
    const blacklistRule = makeRule({
        type: 'BLACKLISTED_GROUPS',
        config: JSON.stringify({ groupIds: [blacklistedGroupId] }),
        actionType: 'REJECT',
    });

    it('rejects a user who is a member of a blacklisted group', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [blacklistRule] });
        mockGetUserGroups.mockResolvedValue([
            { groupId: blacklistedGroupId, name: 'Bad Actors Club' },
        ]);

        const result = await autoModRuleService.evaluateUser(makeUser(), {}, GROUP_ID);
        expect(result.action).toBe('REJECT');
        expect(result.reason).toContain('Bad Actors Club');
    });

    it('allows a user who is NOT in any blacklisted group', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [blacklistRule] });
        mockGetUserGroups.mockResolvedValue([
            { groupId: 'grp_friendly_group', name: 'Friendly Club' },
        ]);

        const result = await autoModRuleService.evaluateUser(makeUser(), {}, GROUP_ID);
        expect(result.action).toBe('ALLOW');
    });

    it('allows when the user has no group memberships', async () => {
        mockGetGroupConfig.mockReturnValue({ rules: [blacklistRule] });
        mockGetUserGroups.mockResolvedValue([]);

        const result = await autoModRuleService.evaluateUser(makeUser(), {}, GROUP_ID);
        expect(result.action).toBe('ALLOW');
    });
});

// ---------------------------------------------------------------------------
// Rule metadata is returned on a match
// ---------------------------------------------------------------------------
describe('evaluateUser — rule metadata in result', () => {
    it('includes ruleName and ruleId in the response when a rule matches', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [makeRule({ id: 42, name: 'Block Griefers', actionType: 'REJECT' })],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badword' }),
            {},
            GROUP_ID
        );
        expect(result.ruleName).toBe('Block Griefers');
        expect(result.ruleId).toBe(42);
    });
});

// ---------------------------------------------------------------------------
// Multiple rules — first match wins
// ---------------------------------------------------------------------------
describe('evaluateUser — multiple rules', () => {
    it('returns the action from the first matching rule and does not evaluate further rules', async () => {
        mockGetGroupConfig.mockReturnValue({
            rules: [
                makeRule({ id: 1, name: 'First Rule', actionType: 'NOTIFY_ONLY' }),
                makeRule({ id: 2, name: 'Second Rule', actionType: 'REJECT' }),
            ],
        });
        const result = await autoModRuleService.evaluateUser(
            makeUser({ displayName: 'badword' }),
            {},
            GROUP_ID
        );
        expect(result.action).toBe('NOTIFY_ONLY');
        expect(result.ruleId).toBe(1);
    });
});
