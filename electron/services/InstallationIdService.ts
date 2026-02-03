import { app, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

const logger = log.scope('InstallationIdService');

const INSTALLATION_ID_FILENAME = 'installation-id.txt';

let cachedInstallationId: string | null = null;

/**
 * Get the path to the installation ID file in appdata
 */
function getInstallationIdPath(): string {
  return path.join(app.getPath('userData'), INSTALLATION_ID_FILENAME);
}

/**
 * Get or create a unique installation ID for this app instance.
 * The ID is stored in appdata and persists across app updates.
 * This replaces HWID fingerprinting with a privacy-respecting alternative.
 */
export function getInstallationId(): string {
  // Return cached value if available
  if (cachedInstallationId) {
    return cachedInstallationId;
  }

  const idPath = getInstallationIdPath();

  try {
    // Try to read existing ID
    if (fs.existsSync(idPath)) {
      const existingId = fs.readFileSync(idPath, 'utf-8').trim();
      if (existingId && existingId.length > 0) {
        cachedInstallationId = existingId;
        logger.info(`Loaded existing installation ID: ${existingId.substring(0, 8)}...`);
        return existingId;
      }
    }

    // Generate new ID if none exists
    const newId = randomUUID();
    fs.writeFileSync(idPath, newId, 'utf-8');
    cachedInstallationId = newId;
    logger.info(`Generated new installation ID: ${newId.substring(0, 8)}...`);
    return newId;

  } catch (error) {
    // Fallback: generate but don't persist (will be different each launch)
    logger.error('Failed to read/write installation ID, using transient ID:', error);
    const transientId = randomUUID();
    cachedInstallationId = transientId;
    return transientId;
  }
}

/**
 * Reset the installation ID (for testing or account unbinding)
 */
export function resetInstallationId(): string {
  const idPath = getInstallationIdPath();
  const newId = randomUUID();

  try {
    fs.writeFileSync(idPath, newId, 'utf-8');
    cachedInstallationId = newId;
    logger.info(`Reset installation ID to: ${newId.substring(0, 8)}...`);
  } catch (error) {
    logger.error('Failed to reset installation ID:', error);
    cachedInstallationId = newId;
  }

  return newId;
}

/**
 * Setup IPC handlers for installation ID
 */
export function setupInstallationIdHandlers() {
  ipcMain.handle('app:get-installation-id', async () => {
    return getInstallationId();
  });

  ipcMain.handle('app:reset-installation-id', async () => {
    return resetInstallationId();
  });
}
