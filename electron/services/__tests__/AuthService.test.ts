import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performLogin, isAuthenticated } from '../AuthService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn() },
    safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (str: string) => Buffer.from(`encrypted_${str}`),
        decryptString: (buf: Buffer) => buf.toString().replace('encrypted_', ''),
    },
    app: { getPath: () => '/tmp' },
}));

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

const MOCK_USER = { id: 'usr_mock_123', displayName: 'Test User' };

vi.mock('vrchat', () => ({
    VRChat: class {
        setCredentials = vi.fn();
        login = vi.fn().mockImplementation((options: { username: string }) => {
            if (options.username === 'baduser') {
                return Promise.reject(new Error('Invalid credentials'));
            }
            return Promise.resolve({ data: MOCK_USER });
        });
        getCurrentUser = vi.fn().mockResolvedValue({ data: MOCK_USER });
        verify2Fa = vi.fn();
        verify2FaEmailCode = vi.fn();
        verifyRecoveryCode = vi.fn();
    },
}));

vi.mock('../CredentialsService', () => ({
    saveCredentials: vi.fn(),
    clearCredentials: vi.fn(),
    loadCredentials: vi.fn(),
    hasSavedCredentials: vi.fn().mockReturnValue(false),
}));

vi.mock('../SessionService', () => ({
    getSessionStore: vi.fn(),
    clearSessionStore: vi.fn(),
    extractAuthCookie: vi.fn().mockReturnValue('auth=mock_cookie'),
}));

vi.mock('../StorageService', () => ({
    storageService: { getDataDir: () => '/tmp' },
}));

vi.mock('../PipelineService', () => ({
    onUserLoggedIn: vi.fn(),
    onUserLoggedOut: vi.fn(),
}));

vi.mock('../GroupAuthorizationService', () => ({
    groupAuthorizationService: { clearAllowedGroups: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should login successfully with valid credentials', async () => {
        const result = await performLogin('testuser', 'password123');

        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.user?.displayName).toBe('Test User');
        expect(isAuthenticated()).toBe(true);
    });

    it('should handle login failure', async () => {
        const result = await performLogin('baduser', 'badpass');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid username or password');
    });
});
