import jwt from 'jsonwebtoken';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { UserContext } from '../../middleware/auth';
import { createError } from '../../middleware/errorHandler';

// In-memory store for verification codes (use Redis/DB in production)
const verificationCodes = new Map<string, VerificationCode>();

// Load keys
let privateKey: string = '';
let publicKey: string = '';

try {
  privateKey = fs.readFileSync(config.jwtPrivateKeyPath, 'utf8');
  publicKey = fs.readFileSync(config.jwtPublicKeyPath, 'utf8');
} catch (e) {
  console.warn('⚠️  JWT keys not found. Run the key generation script first.');
}

interface AccessTokenPayload {
  userId: string;
  displayName: string;
  tier: 'free' | 'personal' | 'pro' | 'team';
  teamIds?: string[];
}

interface VerificationCode {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
}

/**
 * Validate an access token (issued by dev to user)
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
  } catch (error) {
    throw createError('Invalid or expired access token', 401, 'INVALID_ACCESS_TOKEN');
  }
}

/**
 * Create a verification code for VRChat status check
 */
export async function createVerificationCode(userId: string): Promise<VerificationCode> {
  // Generate random code like "GG-X7K9M2"
  const code = `GG-${uuidv4().substring(0, 6).toUpperCase()}`;
  const id = uuidv4();
  
  const verification: VerificationCode = {
    id,
    userId,
    code,
    expiresAt: new Date(Date.now() + config.verificationCodeExpiryMs),
  };
  
  verificationCodes.set(id, verification);
  
  // Auto-cleanup expired codes
  setTimeout(() => {
    verificationCodes.delete(id);
  }, config.verificationCodeExpiryMs);
  
  return verification;
}

/**
 * Get a verification code by ID
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
 * Delete a verification code
 */
export async function deleteVerificationCode(id: string): Promise<void> {
  verificationCodes.delete(id);
}

/**
 * Check if VRChat user's status/bio contains the verification code
 */
export async function checkVRChatStatus(userId: string, code: string): Promise<boolean> {
  try {
    // Call VRChat public API to get user profile
    const response = await fetch(`${config.vrchatApiBase}/users/${userId}`, {
      headers: {
        'User-Agent': 'GroupGuard/1.0',
      },
    });
    
    if (!response.ok) {
      console.error(`VRChat API error: ${response.status}`);
      return false;
    }
    
    const userData = await response.json() as {
      status?: string;
      statusDescription?: string;
      bio?: string;
    };
    
    // Check if code appears in status, statusDescription, or bio
    const searchText = [
      userData.status || '',
      userData.statusDescription || '',
      userData.bio || '',
    ].join(' ').toUpperCase();
    
    return searchText.includes(code.toUpperCase());
  } catch (error) {
    console.error('Error checking VRChat status:', error);
    return false;
  }
}

/**
 * Create a session token after successful verification
 */
export async function createSession(tokenData: AccessTokenPayload): Promise<{ token: string; expiresAt: Date }> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + config.sessionExpiryDays * 24 * 60 * 60 * 1000);
  
  const payload: UserContext = {
    userId: tokenData.userId,
    displayName: tokenData.displayName,
    tier: tokenData.tier,
    teamIds: tokenData.teamIds || [],
    sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  
  return { token, expiresAt };
}

/**
 * Refresh a session with a new expiry
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
 * Verify a session token and return user context
 */
export async function verifySessionToken(token: string): Promise<UserContext> {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as UserContext;
    return decoded;
  } catch (error) {
    throw createError('Invalid session token', 401, 'INVALID_SESSION');
  }
}
