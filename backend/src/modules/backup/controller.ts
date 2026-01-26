import { Request, Response, NextFunction } from 'express';
import * as backupService from './service';
import { createError } from '../../middleware/errorHandler';

/**
 * Create a new backup
 */
export async function createBackup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    const { data, metadata } = req.body;
    
    if (!data) {
      throw createError('Backup data is required', 400, 'MISSING_DATA');
    }
    
    const backup = await backupService.createBackup(req.user.userId, data, metadata);
    
    res.status(201).json({
      success: true,
      backup: {
        id: backup.id,
        createdAt: backup.createdAt,
        size: backup.size,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all backups for the authenticated user
 */
export async function listBackups(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    const backups = await backupService.listBackups(req.user.userId);
    
    res.json({
      success: true,
      backups,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific backup
 */
export async function getBackup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    const { id } = req.params;
    const backup = await backupService.getBackup(req.user.userId, id);
    
    if (!backup) {
      throw createError('Backup not found', 404, 'NOT_FOUND');
    }
    
    res.json({
      success: true,
      backup,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a specific backup
 */
export async function deleteBackup(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw createError('Authentication required', 401, 'UNAUTHORIZED');
    }
    
    const { id } = req.params;
    const deleted = await backupService.deleteBackup(req.user.userId, id);
    
    if (!deleted) {
      throw createError('Backup not found', 404, 'NOT_FOUND');
    }
    
    res.json({
      success: true,
      message: 'Backup deleted',
    });
  } catch (error) {
    next(error);
  }
}
