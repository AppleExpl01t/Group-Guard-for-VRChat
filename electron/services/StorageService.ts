import { app, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

class StorageService {
  private configPath: string;
  private dataDir: string | null = null;
  private defaultDataDirName = 'VRC_Group_Guard';

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'storage-config.json');
  }

  public initialize() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        if (config.dataDir && fs.existsSync(config.dataDir)) {
          this.dataDir = config.dataDir;
          log.info(`[StorageService] Loaded data directory: ${this.dataDir}`);
        } else {
            log.warn(`[StorageService] Configured data dir not found: ${config.dataDir}`);
            this.dataDir = null; // Force re-setup
        }
      } else {
          log.info('[StorageService] No storage config found. Waiting for user setup.');
      }
    } catch (error) {
      log.error('[StorageService] Failed to initialize:', error);
    }
  }

  public isConfigured(): boolean {
    return this.dataDir !== null;
  }

  public getDataDir(): string {
      // Fallback to userData if not configured (should be avoided in UI, but safe for code)
      return this.dataDir || app.getPath('userData');
  }

  public getUnconfiguredDefaultPath(): string {
      return path.join(app.getPath('documents'), this.defaultDataDirName);
  }

  public async selectDirectory(window: BrowserWindow): Promise<string | null> {
      const result = await dialog.showOpenDialog(window, {
          properties: ['openDirectory', 'createDirectory', 'showHiddenFiles'],
          title: 'Select Data Storage Folder',
          buttonLabel: 'Select Folder',
          defaultPath: app.getPath('documents')
      });
      
      if (result.canceled || result.filePaths.length === 0) {
          return null;
      }
      return result.filePaths[0];
  }

  public setLocation(dirPath: string) {
      if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
      }

      const config = { dataDir: dirPath };
      fs.writeFileSync(this.configPath, JSON.stringify(config));
      this.dataDir = dirPath;
      log.info(`[StorageService] Storage location set to: ${dirPath}`);
      return true;
  }
}

export const storageService = new StorageService();
