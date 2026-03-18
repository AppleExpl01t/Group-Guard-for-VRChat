/**
 * WatchlistService Tests
 *
 * Tests CRUD operations for watched entities and moderation tags.
 * electron-store, electron (ipcMain), electron-log, WindowService, and
 * DatabaseService are all mocked so no filesystem or IPC is involved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted store state — must exist before vi.mock() factories are evaluated
// ---------------------------------------------------------------------------
const { getStoreData, setStoreData } = vi.hoisted(() => {
    let _data: Record<string, unknown> = {};
    return {
        getStoreData: () => _data,
        setStoreData: (d: Record<string, unknown>) => { _data = d; },
    };
});

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

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn() },
}));

vi.mock('../WindowService', () => ({
    windowService: { broadcast: vi.fn() },
}));

vi.mock('../DatabaseService', () => ({
    databaseService: {
        searchScannedUsers: vi.fn().mockResolvedValue([]),
        getScannedUser: vi.fn().mockResolvedValue(null),
    },
}));

// ---------------------------------------------------------------------------
// In-memory electron-store mock
// ---------------------------------------------------------------------------
vi.mock('electron-store', () => ({
    default: class {
        private defaults: Record<string, unknown>;

        constructor(opts: { defaults?: Record<string, unknown> } = {}) {
            this.defaults = opts.defaults || {};
            setStoreData({ ...this.defaults });
        }

        get(key: string) {
            return getStoreData()[key] ?? this.defaults[key];
        }

        set(key: string, value: unknown) {
            getStoreData()[key] = value;
        }

        get store() {
            return getStoreData();
        }
    },
}));

// ---------------------------------------------------------------------------
// Import service AFTER mocks
// ---------------------------------------------------------------------------
import { watchlistService, type WatchedEntity, type ModerationTag } from '../WatchlistService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<WatchedEntity> = {}): WatchedEntity {
    return {
        id: 'usr_test_entity',
        type: 'user',
        displayName: 'TestUser',
        tags: [],
        notes: '',
        priority: 0,
        critical: false,
        silent: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}

function makeTag(overrides: Partial<ModerationTag> = {}): ModerationTag {
    return {
        id: 'test-tag',
        label: 'Test Tag',
        description: 'A test moderation tag',
        color: '#FFFFFF',
        ...overrides,
    };
}

// Reset store state before every test
beforeEach(() => {
    vi.clearAllMocks();
    setStoreData({
        entities: {},
        tags: [
            { id: 'nuisance', label: 'Nuisance', description: 'General annoyance', color: '#FFA500' },
            { id: 'malicious', label: 'Malicious', description: 'Crasher or attacker', color: '#FF0000' },
            { id: 'community', label: 'Community', description: 'Safe or known user', color: '#00FF00' },
        ],
    });
});

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------
describe('WatchlistService — entity management', () => {
    describe('saveEntity', () => {
        it('creates a new entity and returns it', () => {
            const entity = watchlistService.saveEntity({
                id: 'usr_new',
                type: 'user',
                displayName: 'NewUser',
            });

            expect(entity.id).toBe('usr_new');
            expect(entity.displayName).toBe('NewUser');
            expect(entity.type).toBe('user');
            expect(entity.createdAt).toBeGreaterThan(0);
            expect(entity.updatedAt).toBeGreaterThan(0);
        });

        it('merges with an existing entity, preserving createdAt', () => {
            const first = watchlistService.saveEntity({ id: 'usr_merge', type: 'user', notes: 'first note' });
            const firstCreatedAt = first.createdAt;

            const second = watchlistService.saveEntity({ id: 'usr_merge', type: 'user', notes: 'updated note' });

            expect(second.notes).toBe('updated note');
            expect(second.createdAt).toBe(firstCreatedAt);
            expect(second.updatedAt).toBeGreaterThanOrEqual(firstCreatedAt);
        });

        it('defaults missing fields when creating', () => {
            const entity = watchlistService.saveEntity({ id: 'usr_defaults', type: 'group' });

            expect(entity.displayName).toBe('Unknown');
            expect(entity.tags).toEqual([]);
            expect(entity.notes).toBe('');
            expect(entity.priority).toBe(0);
            expect(entity.critical).toBe(false);
            expect(entity.silent).toBe(false);
        });

        it('stores the entity so getEntity can retrieve it', () => {
            watchlistService.saveEntity(makeEntity({ id: 'usr_retrieve' }));
            const fetched = watchlistService.getEntity('usr_retrieve');
            expect(fetched).toBeDefined();
            expect(fetched!.id).toBe('usr_retrieve');
        });
    });

    describe('getEntity', () => {
        it('returns undefined for a non-existent id', () => {
            expect(watchlistService.getEntity('usr_nonexistent')).toBeUndefined();
        });
    });

    describe('getEntities', () => {
        it('returns an empty array when no entities exist', () => {
            expect(watchlistService.getEntities()).toEqual([]);
        });

        it('returns all saved entities', () => {
            watchlistService.saveEntity(makeEntity({ id: 'usr_a' }));
            watchlistService.saveEntity(makeEntity({ id: 'usr_b' }));
            expect(watchlistService.getEntities()).toHaveLength(2);
        });
    });

    describe('deleteEntity', () => {
        it('removes an existing entity and returns true', () => {
            watchlistService.saveEntity(makeEntity({ id: 'usr_to_delete' }));
            const result = watchlistService.deleteEntity('usr_to_delete');
            expect(result).toBe(true);
            expect(watchlistService.getEntity('usr_to_delete')).toBeUndefined();
        });

        it('returns false when the entity does not exist', () => {
            expect(watchlistService.deleteEntity('usr_ghost')).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Tag management
// ---------------------------------------------------------------------------
describe('WatchlistService — tag management', () => {
    describe('getTags', () => {
        it('returns the default tags on a fresh store', () => {
            const tags = watchlistService.getTags();
            expect(tags.some(t => t.id === 'nuisance')).toBe(true);
            expect(tags.some(t => t.id === 'malicious')).toBe(true);
            expect(tags.some(t => t.id === 'community')).toBe(true);
        });
    });

    describe('addTag', () => {
        it('adds a new tag', () => {
            watchlistService.addTag(makeTag({ id: 'custom-tag' }));
            const tags = watchlistService.getTags();
            expect(tags.some(t => t.id === 'custom-tag')).toBe(true);
        });

        it('does not add duplicate tags', () => {
            watchlistService.addTag(makeTag({ id: 'dup-tag' }));
            watchlistService.addTag(makeTag({ id: 'dup-tag' }));
            const count = watchlistService.getTags().filter(t => t.id === 'dup-tag').length;
            expect(count).toBe(1);
        });
    });

    describe('deleteTag', () => {
        it('removes an existing tag by id', () => {
            watchlistService.deleteTag('nuisance');
            expect(watchlistService.getTags().some(t => t.id === 'nuisance')).toBe(false);
        });

        it('is a no-op for a non-existent tag id', () => {
            const before = watchlistService.getTags().length;
            watchlistService.deleteTag('ghost-tag');
            expect(watchlistService.getTags().length).toBe(before);
        });
    });

    describe('saveTag', () => {
        it('updates an existing tag', () => {
            watchlistService.saveTag({ id: 'nuisance', label: 'Updated', description: 'Changed', color: '#000000' });
            const tag = watchlistService.getTags().find(t => t.id === 'nuisance');
            expect(tag?.label).toBe('Updated');
        });

        it('creates a new tag if the id does not exist', () => {
            watchlistService.saveTag(makeTag({ id: 'brand-new' }));
            expect(watchlistService.getTags().some(t => t.id === 'brand-new')).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------
describe('WatchlistService — import and export', () => {
    it('exports store contents as valid JSON', () => {
        watchlistService.saveEntity(makeEntity({ id: 'usr_export' }));
        const json = watchlistService.exportData();
        const parsed = JSON.parse(json);
        expect(parsed.entities).toBeDefined();
        expect(parsed.tags).toBeDefined();
    });

    it('imports entities and tags from a JSON string', () => {
        const payload = {
            entities: {
                'usr_imported': {
                    id: 'usr_imported',
                    type: 'user',
                    displayName: 'Imported',
                    tags: [],
                    notes: '',
                    priority: 0,
                    critical: false,
                    silent: false,
                    createdAt: 1000,
                    updatedAt: 1000,
                },
            },
            tags: [{ id: 'imported-tag', label: 'Imported', description: '', color: '#FFF' }],
        };

        const result = watchlistService.importData(JSON.stringify(payload));
        expect(result).toBe(true);
        expect(watchlistService.getEntity('usr_imported')).toBeDefined();
        expect(watchlistService.getTags().some(t => t.id === 'imported-tag')).toBe(true);
    });

    it('returns false and does not crash on invalid JSON', () => {
        const result = watchlistService.importData('{ not valid json ~~~');
        expect(result).toBe(false);
    });
});
