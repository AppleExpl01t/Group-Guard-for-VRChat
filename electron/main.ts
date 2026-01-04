import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

// ========================================
// LOGGING & ERROR HANDLING
// ========================================

// Configure logging for production
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';

log.info('========================================');
log.info(`VRChat Group Guard v${app.getVersion()} starting...`);
log.info(`Electron: ${process.versions.electron}`);
log.info(`Chrome: ${process.versions.chrome}`);
log.info(`Node: ${process.versions.node}`);
log.info(`Platform: ${process.platform} ${process.arch}`);
log.info('========================================');

// Catch unhandled exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  dialog.showErrorBox('Critical Error', `An unexpected error occurred:\n\n${error.message}\n\nThe application will now close.`);
  app.quit();
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ========================================
// WINDOW MANAGEMENT
// ========================================

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  const windowConfig = {
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 800,
    frame: false, // Custom UI requires frameless
    backgroundColor: '#030014', // Match app background to avoid white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for some native modules
      webSecurity: true, // Enable web security in production
      allowRunningInsecureContent: false,
    },
    title: 'VRChat Group Guard',
    titleBarStyle: 'hidden' as const,
    show: false, // Don't show until ready
  };

  mainWindow = new BrowserWindow(windowConfig);

  // Show window when ready to avoid flicker
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle external links securely - only allow https
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
    } else {
      log.warn(`Blocked non-https external URL: ${url}`);
    }
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs within the app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.protocol !== 'file:') {
      event.preventDefault();
      log.warn(`Blocked navigation to external URL: ${navigationUrl}`);
    }
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    log.info('Loading development server at http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    log.info('Loading production build');
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// ========================================
// IPC HANDLERS
// ========================================

// IPC Logging Bridge
ipcMain.on('log', (_event, level, message) => {
  const validLevels = ['info', 'warn', 'error', 'debug'];
  if (validLevels.includes(level) && typeof log[level as keyof typeof log] === 'function') {
    (log[level as keyof typeof log] as (message: string) => void)(message);
  }
});

// Initialize Services
import { setupAuthHandlers } from './services/AuthService';
import { setupGroupHandlers } from './services/GroupService';
import { setupUserHandlers } from './services/UserService';
import { setupCredentialsHandlers } from './services/CredentialsService';
import { setupPipelineHandlers } from './services/PipelineService';
import { setupLogWatcherHandlers } from './services/LogWatcherService';

import { storageService } from './services/StorageService';

// Storage API
ipcMain.handle('storage:get-status', () => {
  return {
    configured: storageService.isConfigured(),
    path: storageService.getDataDir(),
    defaultPath: storageService.getUnconfiguredDefaultPath()
  };
});

ipcMain.handle('storage:select-folder', () => {
  return storageService.selectDirectory(mainWindow!);
});

ipcMain.handle('storage:set-path', (_event, path) => {
  return storageService.setLocation(path);
});

// Initialize storage service
storageService.initialize();

// Setup handlers
setupAuthHandlers();
setupGroupHandlers();
setupUserHandlers();
setupCredentialsHandlers();
setupPipelineHandlers();
setupLogWatcherHandlers();

// Import to initialize (singleton)
import './services/InstanceLoggerService';

// Window Controls Handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// ========================================
// APP LIFECYCLE
// ========================================

app.whenReady().then(async () => {
  log.info('App ready, creating window...');
  createWindow();

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow?.webContents.openDevTools();
  }

  // Check for updates (Production only)
  if (process.env.NODE_ENV !== 'development') {
      try {
          // Check but don't force notify yet, we'll handle the UI
          autoUpdater.checkForUpdatesAndNotify();
          
          // When update is ready, tell the UI to show the modal
          autoUpdater.on('update-downloaded', () => {
              log.info('Update downloaded, prompting user...');
              mainWindow?.webContents.send('updater:update-downloaded');
          });
      } catch (err) {
          log.error('Failed to check for updates:', err);
      }
  }

  // Handle explicit install request from UI
  ipcMain.handle('updater:quit-and-install', () => {
      autoUpdater.quitAndInstall();
  });

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quit
app.on('before-quit', () => {
  log.info('Application quitting...');
});

