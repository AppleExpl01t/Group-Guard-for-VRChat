import { Router } from 'express';
import * as controller from './controller';

const router = Router();

/**
 * POST /auth/activate
 * Start the activation process - returns a verification code
 * Body: { token: string, claimedUserId: string }
 */
router.post('/auth/activate', controller.startActivation);

/**
 * POST /auth/verify
 * Complete activation by verifying VRChat status contains the code
 * Body: { token: string, claimedUserId: string, verificationId: string }
 */
router.post('/auth/verify', controller.completeVerification);

/**
 * POST /auth/refresh
 * Refresh a session key before expiry
 * Requires: Valid session key in Authorization header
 */
router.post('/auth/refresh', controller.refreshSession);

/**
 * GET /auth/status
 * Check if current session is valid
 * Requires: Valid session key in Authorization header
 */
router.get('/auth/status', controller.checkStatus);

export default router;
