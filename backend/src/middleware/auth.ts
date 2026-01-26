import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { config } from '../config';
import { createError } from './errorHandler';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

export interface UserContext {
  userId: string;      // VRChat User ID (e.g., usr_abc123)
  displayName: string;
  tier: 'free' | 'personal' | 'pro' | 'team';
  teamIds: string[];
  sessionId: string;
  exp: number;
}

// Load public key for verification (private key only needed for signing)
let publicKey: string;
try {
  publicKey = fs.readFileSync(config.jwtPublicKeyPath, 'utf8');
} catch (e) {
  console.warn('⚠️  JWT public key not found. Auth will fail until key is configured.');
  publicKey = '';
}

/**
 * Middleware to require a valid session key
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError('Authorization header required', 401, 'UNAUTHORIZED'));
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as UserContext;
    
    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      displayName: decoded.displayName,
      tier: decoded.tier || 'personal',
      teamIds: decoded.teamIds || [],
      sessionId: decoded.sessionId,
      exp: decoded.exp,
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(createError('Session expired', 401, 'SESSION_EXPIRED'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createError('Invalid session token', 401, 'INVALID_TOKEN'));
    }
    return next(createError('Authentication failed', 401, 'AUTH_FAILED'));
  }
}

/**
 * Middleware to require a specific tier level
 */
export function requireTier(...allowedTiers: UserContext['tier'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    if (!allowedTiers.includes(req.user.tier)) {
      return next(createError(
        `This feature requires ${allowedTiers.join(' or ')} tier`,
        403,
        'INSUFFICIENT_TIER'
      ));
    }
    
    next();
  };
}

/**
 * Middleware to require team membership
 */
export function requireTeamMember(teamIdParam: string = 'teamId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    const teamId = req.params[teamIdParam];
    if (!teamId) {
      return next(createError('Team ID required', 400, 'MISSING_TEAM_ID'));
    }
    
    if (!req.user.teamIds.includes(teamId)) {
      return next(createError('Not a member of this team', 403, 'NOT_TEAM_MEMBER'));
    }
    
    next();
  };
}
