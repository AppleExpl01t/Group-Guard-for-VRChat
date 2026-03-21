import jwt from 'jsonwebtoken';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { UserContext } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

// ---------------------------------------------------------------------------
// JWT key loading — fail fast so the server never starts in a broken state
// ---------------------------------------------------------------------------

function loadKey(path: string, label: string): string {
  try {
    const key = fs.readFileSync(path, 'utf8').trim();
    if (!key) throw new Error('File is empty');
    return key;
  } catch (e) {
    throw new Error(
      `[auth/service] Cannot load ${label} from "${path}": ${e}. ` +
      'Run the key generation script before starting the server.',
    );
  }
}

const privateKey = loadKey(config.jwtPrivateKeyPath, 'JWT private key');
const publicKey  = loadKey(config.jwtPublicKeyPath,  'JWT public key');

// ---------------------------------------------------------------------------
// VRChat user ID validation
// VRChat user IDs always take the form:  usr_<UUID>
// Validating before embedding into any URL prevents path-injection attacks.
// ---------------------------------------------------------------------------

const VRCHAT_USER_ID_RE = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertVrchatUserId(userId: string): void {
  if (!VRCHAT_USER_ID_RE.test(userId)) {
    throw createError('Invalid VRChat user ID format', 400, 'INVALID_USER_ID');
  }
}

// ---------------------------------------------------------------------------
// In-memory verification code store
// Per-user active code count is capped at maxVerificationCodesPerUser to
// prevent a single user from flooding the store.
// ---------------------------------------------------------------------------

interface VerificationCode {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
}

const verificationCodes = new Map<string, VerificationCode>();
const MAX_CODES_PER_USER = 3;

// ---------------------------------------------------------------------------
// VRChat API response cache
// A short-lived cache (TTL = verificationCodeExpiryMs) prevents a single
// malicious actor from using repeated /auth/verify calls to DDoS-amplify
// against the VRChat API.
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: boolean;
  code: string;
  cachedAt: number;
}

const vrchatStatusCache = new Map<string, CacheEntry>();
const VRCHAT_CACHE_TTL_MS = config.verificationCodeExpiryMs; // same as code expiry

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccessTokenPayload {
  userId: string;
  displayName: string;
  tier: 'free' | 'personal' | 'pro' | 'team';
  teamIds?: string[];
}

// ---------------------------------------------------------------------------
// Auth service functions
// ---------------------------------------------------------------------------

/**
 * Validate an access token issued by the developer.
 */
export async function validateAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as AccessTokenPayload & { sub: string };

    return {
      userId: decoded.sub || decoded.userId,
      displayName: decoded.displayName,
      tier: decoded.tier || 'personal',
      teamIds: decoded.teamIds || [],
    };
  } catch {
    throw createError('Invalid or expired access token', 401, 'INVALID_ACCESS_TOKEN');
  }
}

/**
 * Create a verification code for VRChat status check.
 * Enforces a per-user limit to prevent store flooding.
 */
export async function createVerificationCode(userId: string): Promise<VerificationCode> {
  assertVrchatUserId(userId);

  // Count and evict expired codes for this user
  let activeCount = 0;
  for (const [id, code] of verificationCodes) {
    if (code.userId !== userId) continue;
    if (new Date() > code.expiresAt) {
      verificationCodes.delete(id);
    } else {
      activeCount++;
    }
  }

  if (activeCount >= MAX_CODES_PER_USER) {
    throw createError(
      'Too many active verification codes. Wait for existing codes to expire.',
      429,
      'TOO_MANY_CODES',
    );
  }

  const code = `GG-${uuidv4().substring(0, 6).toUpperCase()}`;
  const id = uuidv4();
  const verification: VerificationCode = {
    id,
    userId,
    code,
    expiresAt: new Date(Date.now() + config.verificationCodeExpiryMs),
  };

  verificationCodes.set(id, verification);

  // Auto-cleanup after expiry
  setTimeout(() => verificationCodes.delete(id), config.verificationCodeExpiryMs);

  return verification;
}

/**
 * Get a verification code by ID; returns null if missing or expired.
 */
export async function getVerificationCode(id: string): Promise<VerificationCode | null> {
  const code = verificationCodes.get(id);
  if (!code) return null;
  if (new Date() > code.expiresAt) {
    verificationCodes.delete(id);
    return null;
  }
  return code;
}

/**
 * Delete a verification code.
 */
export async function deleteVerificationCode(id: string): Promise<void> {
  verificationCodes.delete(id);
}

/**
 * Check if a VRChat user's public profile contains the verification code.
 *
 * Results are cached for the lifetime of the verification code so that
 * repeated calls to /auth/verify do not amplify into VRChat API traffic.
 */
export async function checkVRChatStatus(userId: string, code: string): Promise<boolean> {
  assertVrchatUserId(userId);

  // Cache key scoped to userId + code so stale results don't bleed across verifications
  const cacheKey = `${userId}:${code}`;
  const cached = vrchatStatusCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) < VRCHAT_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    // encodeURIComponent is redundant after the regex check above but kept for defence-in-depth
    const url = `${config.vrchatApiBase}/users/${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GroupGuard/1.0 (+https://groupguard.app)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.error(`VRChat API error: ${response.status} for userId ${userId}`);
      return false;
    }

    const userData = await response.json() as {
      status?: string;
      statusDescription?: string;
      bio?: string;
    };

    const searchText = [
      userData.status ?? '',
      userData.statusDescription ?? '',
      userData.bio ?? '',
    ].join(' ').toUpperCase();

    const result = searchText.includes(code.toUpperCase());

    // Cache both positive and negative results
    vrchatStatusCache.set(cacheKey, { result, code, cachedAt: Date.now() });
    setTimeout(() => vrchatStatusCache.delete(cacheKey), VRCHAT_CACHE_TTL_MS);

    return result;
  } catch (error) {
    console.error('Error checking VRChat status:', error);
    return false;
  }
}

/**
 * Create a session token after successful verification.
 */
export async function createSession(tokenData: AccessTokenPayload): Promise<{ token: string; expiresAt: Date }> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + config.sessionExpiryDays * 24 * 60 * 60 * 1000);

  const payload: UserContext = {
    userId: tokenData.userId,
    displayName: tokenData.displayName,
    tier: tokenData.tier,
    teamIds: tokenData.teamIds ?? [],
    sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  return { token, expiresAt };
}

/**
 * Issue a fresh session token for an already-authenticated user.
 * Always generates a new sessionId so the old token cannot be reused
 * after a successful refresh.
 */
export async function refreshSession(user: UserContext): Promise<{ token: string; expiresAt: Date }> {
  return createSession({
    userId: user.userId,
    displayName: user.displayName,
    tier: user.tier,
    teamIds: user.teamIds,
  });
}

/**
 * Verify a session token and return the user context.
 */
export async function verifySessionToken(token: string): Promise<UserContext> {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as UserContext;
    return decoded;
  } catch {
    throw createError('Invalid session token', 401, 'INVALID_SESSION');
  }
}
