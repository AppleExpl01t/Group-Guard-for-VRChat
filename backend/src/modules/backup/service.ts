import { v4 as uuidv4 } from 'uuid';
import * as objectStorage from '../../storage/objectStorage';

export interface BackupMetadata {
  id: string;
  userId: string;
  createdAt: string;
  size: number;
  version: string;
  description?: string;
}

export interface Backup extends BackupMetadata {
  data: string; // Encrypted backup data
}

/**
 * Create a new backup for a user
 */
export async function createBackup(
  userId: string, 
  data: string, 
  metadata?: { description?: string; version?: string }
): Promise<BackupMetadata> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  const backupMetadata: BackupMetadata = {
    id,
    userId,
    createdAt,
    size: Buffer.byteLength(data, 'utf8'),
    version: metadata?.version || '1.0.0',
    description: metadata?.description,
  };
  
  // Store the backup data
  const dataPath = `users/${userId}/backups/${id}/data.json`;
  await objectStorage.put(dataPath, data);
  
  // Store the metadata separately for listing
  const metaPath = `users/${userId}/backups/${id}/metadata.json`;
  await objectStorage.put(metaPath, JSON.stringify(backupMetadata));
  
  return backupMetadata;
}

/**
 * List all backups for a user
 */
export async function listBackups(userId: string): Promise<BackupMetadata[]> {
  const prefix = `users/${userId}/backups/`;
  const files = await objectStorage.list(prefix);
  
  // Filter for metadata files and parse them
  const metadataFiles = files.filter(f => f.endsWith('/metadata.json'));
  
  const backups: BackupMetadata[] = [];
  for (const file of metadataFiles) {
    try {
      const content = await objectStorage.get(file);
      if (content) {
        backups.push(JSON.parse(content) as BackupMetadata);
      }
    } catch (e) {
      console.error(`Error reading backup metadata: ${file}`, e);
    }
  }
  
  // Sort by creation date, newest first
  return backups.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a specific backup with data
 */
export async function getBackup(userId: string, backupId: string): Promise<Backup | null> {
  const metaPath = `users/${userId}/backups/${backupId}/metadata.json`;
  const dataPath = `users/${userId}/backups/${backupId}/data.json`;
  
  try {
    const metadataContent = await objectStorage.get(metaPath);
    const dataContent = await objectStorage.get(dataPath);
    
    if (!metadataContent || !dataContent) {
      return null;
    }
    
    const metadata = JSON.parse(metadataContent) as BackupMetadata;
    
    return {
      ...metadata,
      data: dataContent,
    };
  } catch (e) {
    console.error(`Error reading backup: ${backupId}`, e);
    return null;
  }
}

/**
 * Delete a backup
 */
export async function deleteBackup(userId: string, backupId: string): Promise<boolean> {
  const metaPath = `users/${userId}/backups/${backupId}/metadata.json`;
  const dataPath = `users/${userId}/backups/${backupId}/data.json`;
  
  try {
    await objectStorage.del(metaPath);
    await objectStorage.del(dataPath);
    return true;
  } catch (e) {
    console.error(`Error deleting backup: ${backupId}`, e);
    return false;
  }
}
