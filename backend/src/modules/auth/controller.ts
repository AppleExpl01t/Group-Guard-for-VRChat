import { Request, Response, NextFunction } from 'express';
import * as authService from './service';
import { createError } from '../../middleware/errorHandler';

/**
 * Start the activation process
 * Validates the access token and returns a verification code
 */
export async function startActivation(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, claimedUserId } = req.body;
    
    if (!token || !claimedUserId) {
      throw createError('Token and claimedUserId are required', 400, 'MISSING_PARAMS');
    }
    
    // Validate the access token (issued by dev)
    const tokenData = await authService.validateAccessToken(token);
    
    // Check if claimed user ID matches token
    if (tokenData.userId !== claimedUserId) {
      throw createError('Token is not valid for this user', 403, 'USER_MISMATCH');
    }
    
    // Generate verification code
    const verification = await authService.createVerificationCode(claimedUserId);
    
    res.json({
      success: true,
      verificationId: verification.id,
      code: verification.code,
      expiresAt: verification.expiresAt,
      instructions: `Add "${verification.code}" to your VRChat status or bio, then call /auth/verify`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete the verification by checking VRChat status
 */
export async function completeVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, claimedUserId, verificationId } = req.body;
    
    if (!token || !claimedUserId || !verificationId) {
      throw createError('Token, claimedUserId, and verificationId are required', 400, 'MISSING_PARAMS');
    }
    
    // Validate access token again
    const tokenData = await authService.validateAccessToken(token);
    if (tokenData.userId !== claimedUserId) {
      throw createError('Token is not valid for this user', 403, 'USER_MISMATCH');
    }
    
    // Verify the code exists and is not expired
    const verification = await authService.getVerificationCode(verificationId);
    if (!verification) {
      throw createError('Verification not found or expired', 400, 'INVALID_VERIFICATION');
    }
    if (verification.userId !== claimedUserId) {
      throw createError('Verification does not match user', 403, 'USER_MISMATCH');
    }
    
    // Check VRChat profile for the code
    const isVerified = await authService.checkVRChatStatus(claimedUserId, verification.code);
    if (!isVerified) {
      throw createError(
        'Verification code not found in VRChat status/bio. Make sure it\'s visible and try again.',
        400,
        'CODE_NOT_FOUND'
      );
    }
    
    // Success! Create session key
    const session = await authService.createSession(tokenData);
    
    // Clean up verification code
    await authService.deleteVerificationCode(verificationId);
    
    res.json({
      success: true,
      sessionKey: session.token,
      expiresAt: session.expiresAt,
      user: {
        userId: tokenData.userId,
        displayName: tokenData.displayName,
        tier: tokenData.tier,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh a session before it expires
 */
export async function refreshSession(req: Request, res: Response, next: NextFunction) {
  try {
    // User context is set by requireAuth middleware
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    const newSession = await authService.refreshSession(req.user);
    
    res.json({
      success: true,
      sessionKey: newSession.token,
      expiresAt: newSession.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Check if current session is valid
 */
export async function checkStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.json({ authenticated: false });
    }
    
    const token = authHeader.substring(7);
    const user = await authService.verifySessionToken(token);
    
    res.json({
      authenticated: true,
      user: {
        userId: user.userId,
        displayName: user.displayName,
        tier: user.tier,
      },
      expiresAt: new Date(user.exp * 1000).toISOString(),
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
}
