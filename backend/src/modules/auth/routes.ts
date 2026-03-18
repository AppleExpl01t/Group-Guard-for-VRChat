import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth';
import * as controller from './controller';

const router = Router();

// ---------------------------------------------------------------------------
// Per-endpoint rate limiters (much tighter than the global limiter)
// ---------------------------------------------------------------------------

/** Tight limiter for unauthenticated endpoints that hit external APIs. */
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  message: { error: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Slightly more lenient limiter for the refresh/status endpoints. */
const authSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /auth/activate
 * Start the activation process — returns a verification code.
 * Body: { token: string, claimedUserId: string }
 */
router.post('/auth/activate', authAttemptLimiter, controller.startActivation);

/**
 * POST /auth/verify
 * Complete activation by verifying VRChat status contains the code.
 * Body: { token: string, claimedUserId: string, verificationId: string }
 */
router.post('/auth/verify', authAttemptLimiter, controller.completeVerification);

/**
 * POST /auth/refresh
 * Refresh a session key before expiry.
 * Requires: Valid session key in Authorization header.
 */
router.post('/auth/refresh', authSessionLimiter, requireAuth, controller.refreshSession);

/**
 * GET /auth/status
 * Check if current session is valid.
 */
router.get('/auth/status', authSessionLimiter, controller.checkStatus);

export default router;
