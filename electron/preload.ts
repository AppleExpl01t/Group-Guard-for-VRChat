import { contextBridge, ipcRenderer } from 'electron';
 
 // Expose protected methods that allow the renderer process to use
 // the ipcRenderer without exposing the entire object
 contextBridge.exposeInMainWorld('electron', {
     log: (level: string, message: string) => ipcRenderer.send('log', level, message),
     getVersion: () => process.versions.electron,
     
     // Auth API
     login: (credentials: { username: string; password: string; rememberMe?: boolean }) => 
       ipcRenderer.invoke('auth:login', credentials),
     verify2fa: (data: { code: string }) => ipcRenderer.invoke('auth:verify2fa', data),
     checkSession: () => ipcRenderer.invoke('auth:check-session'),
     autoLogin: () => ipcRenderer.invoke('auth:auto-login'),
     hasSavedCredentials: () => ipcRenderer.invoke('credentials:has-saved'),
     loadSavedCredentials: () => ipcRenderer.invoke('credentials:load'),
     logout: (options?: { clearSaved?: boolean }) => ipcRenderer.invoke('auth:logout', options || {}),
     clearCredentials: () => ipcRenderer.invoke('credentials:clear'),
     
     // Groups API
     getMyGroups: () => ipcRenderer.invoke('groups:get-my-groups'),
     getGroupDetails: (groupId: string) => ipcRenderer.invoke('groups:get-details', { groupId }),
     getGroupMembers: (groupId: string, offset = 0, n = 100) => ipcRenderer.invoke('groups:get-members', { groupId, offset, n }),
     getGroupRequests: (groupId: string) => ipcRenderer.invoke('groups:get-requests', { groupId }),
     getGroupBans: (groupId: string) => ipcRenderer.invoke('groups:get-bans', { groupId }),
     getGroupInstances: (groupId: string) => ipcRenderer.invoke('groups:get-instances', { groupId }),
     
     // Audit API
     getGroupAuditLogs: (groupId: string) => ipcRenderer.invoke('groups:get-audit-logs', { groupId }),

     // Worlds API
     getWorld: (worldId: string) => ipcRenderer.invoke('worlds:get-details', { worldId }),

     // Users API
     getUser: (userId: string) => ipcRenderer.invoke('users:get', { userId }),
     clearUserCache: (userId?: string) => ipcRenderer.invoke('users:clear-cache', { userId }),
     
     // Pipeline (WebSocket) API
     pipeline: {
       connect: () => ipcRenderer.invoke('pipeline:connect'),
       disconnect: () => ipcRenderer.invoke('pipeline:disconnect'),
       status: () => ipcRenderer.invoke('pipeline:status'),
       reconnect: () => ipcRenderer.invoke('pipeline:reconnect'),
       
       // Event listeners for real-time updates
       onEvent: (callback: (event: unknown) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
         ipcRenderer.on('pipeline:event', handler);
         return () => ipcRenderer.removeListener('pipeline:event', handler);
       },
       onConnected: (callback: (data: { connected: boolean }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { connected: boolean }) => callback(data);
         ipcRenderer.on('pipeline:connected', handler);
         return () => ipcRenderer.removeListener('pipeline:connected', handler);
       },
       onDisconnected: (callback: (data: { code: number; reason: string; willReconnect: boolean }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { code: number; reason: string; willReconnect: boolean }) => callback(data);
         ipcRenderer.on('pipeline:disconnected', handler);
         return () => ipcRenderer.removeListener('pipeline:disconnected', handler);
       },
       onError: (callback: (data: { message: string }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { message: string }) => callback(data);
         ipcRenderer.on('pipeline:error', handler);
         return () => ipcRenderer.removeListener('pipeline:error', handler);
       },
     },

     // Log Watcher API
     logWatcher: {
       start: () => ipcRenderer.invoke('log-watcher:start'),
       stop: () => ipcRenderer.invoke('log-watcher:stop'),
       onPlayerJoined: (callback: (event: { displayName: string; userId?: string; timestamp: string }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { displayName: string; userId?: string; timestamp: string }) => callback(data);
         ipcRenderer.on('log:player-joined', handler);
         return () => ipcRenderer.removeListener('log:player-joined', handler);
       },
       onPlayerLeft: (callback: (event: { displayName: string; userId?: string; timestamp: string }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { displayName: string; userId?: string; timestamp: string }) => callback(data);
         ipcRenderer.on('log:player-left', handler);
         return () => ipcRenderer.removeListener('log:player-left', handler);
       },
       onLocation: (callback: (event: { worldId: string; timestamp: string }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { worldId: string; timestamp: string }) => callback(data);
         ipcRenderer.on('log:location', handler);
         return () => ipcRenderer.removeListener('log:location', handler);
       },
       onWorldName: (callback: (event: { name: string; timestamp: string }) => void) => {
         const handler = (_event: Electron.IpcRendererEvent, data: { name: string; timestamp: string }) => callback(data);
         ipcRenderer.on('log:world-name', handler);
         return () => ipcRenderer.removeListener('log:world-name', handler);
       },
     },
     
     database: {
         getSessions: (groupId?: string) => ipcRenderer.invoke('database:get-sessions', groupId),
         getSessionEvents: (filename: string) => ipcRenderer.invoke('database:get-session-events', filename),
         clearSessions: () => ipcRenderer.invoke('database:clear-sessions'),
     },
     
     // Window Controls
     minimize: () => ipcRenderer.invoke('window:minimize'),
     maximize: () => ipcRenderer.invoke('window:maximize'),
     close: () => ipcRenderer.invoke('window:close'),

     // Storage API
     storage: {
         getStatus: () => ipcRenderer.invoke('storage:get-status'),
         selectFolder: () => ipcRenderer.invoke('storage:select-folder'),
         setPath: (path: string) => ipcRenderer.invoke('storage:set-path', path),
     },

     // Instance Presence API
     instance: {
         getCurrentGroup: () => ipcRenderer.invoke('instance:get-current-group'),
         onGroupChanged: (callback: (groupId: string | null) => void) => {
             const handler = (_event: Electron.IpcRendererEvent, groupId: string | null) => callback(groupId);
             ipcRenderer.on('instance:group-changed', handler);
             return () => ipcRenderer.removeListener('instance:group-changed', handler);
         }
     },

     // Updater API
     updater: {
         onUpdateAvailable: (callback: () => void) => {
             const handler = () => callback();
             ipcRenderer.on('updater:update-available', handler);
             return () => ipcRenderer.removeListener('updater:update-available', handler);
         },
         onUpdateDownloaded: (callback: () => void) => {
             const handler = () => callback();
             ipcRenderer.on('updater:update-downloaded', handler);
             return () => ipcRenderer.removeListener('updater:update-downloaded', handler);
         },
         quitAndInstall: () => ipcRenderer.invoke('updater:quit-and-install')
     }
 });

