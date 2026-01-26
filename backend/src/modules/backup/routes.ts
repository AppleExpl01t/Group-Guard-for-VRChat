import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import * as controller from './controller';

const router = Router();

/**
 * POST /backup
 * Create a new backup
 * Body: { data: encrypted backup data }
 */
router.post('/backup', requireAuth, controller.createBackup);

/**
 * GET /backups
 * List all backups for the authenticated user
 */
router.get('/backups', requireAuth, controller.listBackups);

/**
 * GET /backup/:id
 * Download a specific backup
 */
router.get('/backup/:id', requireAuth, controller.getBackup);

/**
 * DELETE /backup/:id
 * Delete a specific backup
 */
router.delete('/backup/:id', requireAuth, controller.deleteBackup);

export default router;
