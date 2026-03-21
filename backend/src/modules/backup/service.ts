import { v4 as uuidv4 } from 'uuid';
import * as objectStorage from '../../storage/objectStorage';
import { config } from '../../config';
import { createError } from '../../middleware/errorHandler';

export interface BackupMetadata {
  id: string;
  userId: string;
  createdAt: string;
  size: number;
  version: string;
  description?: string;
}

export interface Backup extends BackupMetadata {
  data: string; // Client-side encrypted backup data
}

// ---------------------------------------------------------------------------
// ID validation — prevents path traversal via crafted backup IDs
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertBackupId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw createError('Invalid backup ID format', 400, 'INVALID_BACKUP_ID');
  }
}

// ---------------------------------------------------------------------------
// Path helpers — keeps path construction DRY across all operations
// ---------------------------------------------------------------------------

function backupPaths(userId: string, backupId: string) {
  const base = `users/${userId}/backups/${backupId}`;
  return {
    meta: `${base}/metadata.json`,
    data: `${base}/data.json`,
  };
}

// ---------------------------------------------------------------------------
// Backup service
// ---------------------------------------------------------------------------

/**
 * Count how many backups a user currently has.
 * Used to enforce per-user storage limits before accepting new uploads.
 */
export async function getBackupCount(userId: string): Promise<number> {
  const prefix = `users/${userId}/backups/`;
  const files = await objectStorage.list(prefix);
  return files.filter(f => f.endsWith('/metadata.json')).length;
}

/**
 * Create a new backup for a user.
 * Rejects if the user has already reached their backup limit.
 */
export async function createBackup(
  userId: string,
  data: string,
  metadata?: { description?: string; version?: string },
): Promise<BackupMetadata> {
  // Enforce per-user backup limit before writing anything to storage
  const currentCount = await getBackupCount(userId);
  if (currentCount >= config.maxBackupsPerUser) {
    throw createError(
      `Backup limit reached (max ${config.maxBackupsPerUser}). Delete an existing backup first.`,
      429,
      'BACKUP_LIMIT_REACHED',
    );
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const backupMetadata: BackupMetadata = {
    id,
    userId,
    createdAt,
    size: Buffer.byteLength(data, 'utf8'),
    version: metadata?.version ?? '1.0.0',
    description: metadata?.description,
  };

  const paths = backupPaths(userId, id);

  await Promise.all([
    objectStorage.put(paths.data, data),
    objectStorage.put(paths.meta, JSON.stringify(backupMetadata)),
  ]);

  return backupMetadata;
}

/**
 * List all backups for a user, newest first.
 */
export async function listBackups(userId: string): Promise<BackupMetadata[]> {
  const prefix = `users/${userId}/backups/`;
  const files = await objectStorage.list(prefix);
  const metadataFiles = files.filter(f => f.endsWith('/metadata.json'));

  const results = await Promise.all(
    metadataFiles.map(async file => {
      try {
        const content = await objectStorage.get(file);
        return content ? (JSON.parse(content) as BackupMetadata) : null;
      } catch (e) {
        console.error(`Error reading backup metadata: ${file}`, e);
        return null;
      }
    }),
  );

  return results
    .filter((b): b is BackupMetadata => b !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retrieve a specific backup with its data.
 * Returns null if not found.
 */
export async function getBackup(userId: string, backupId: string): Promise<Backup | null> {
  assertBackupId(backupId);

  const paths = backupPaths(userId, backupId);

  try {
    const [metadataContent, dataContent] = await Promise.all([
      objectStorage.get(paths.meta),
      objectStorage.get(paths.data),
    ]);

    if (!metadataContent || !dataContent) return null;

    const metadata = JSON.parse(metadataContent) as BackupMetadata;

    // Ownership check: ensure the stored userId matches the requesting user
    if (metadata.userId !== userId) {
      console.error(`Ownership mismatch for backup ${backupId}: stored=${metadata.userId}, requested=${userId}`);
      return null;
    }

    return { ...metadata, data: dataContent };
  } catch (e) {
    console.error(`Error reading backup: ${backupId}`, e);
    return null;
  }
}

/**
 * Delete a backup and its associated data.
 */
export async function deleteBackup(userId: string, backupId: string): Promise<boolean> {
  assertBackupId(backupId);

  const paths = backupPaths(userId, backupId);

  // Verify ownership before deleting — only metadata is needed
  const metaContent = await objectStorage.get(paths.meta);
  if (!metaContent) return false;

  try {
    const meta = JSON.parse(metaContent) as BackupMetadata;
    if (meta.userId !== userId) {
      console.error(`Ownership mismatch for backup ${backupId}: stored=${meta.userId}, requested=${userId}`);
      return false;
    }
  } catch (e) {
    console.error(`Error parsing metadata for backup ${backupId}`, e);
    return false;
  }

  try {
    await Promise.all([
      objectStorage.del(paths.meta),
      objectStorage.del(paths.data),
    ]);
    return true;
  } catch (e) {
    console.error(`Error deleting backup: ${backupId}`, e);
    return false;
  }
}
