import { BrowserWindow } from 'electron';

export const windowService = {
    /**
     * Broadcasts an event to all active renderer windows.
     * Handles checks for destroyed windows.
     */
    broadcast: (channel: string, ...args: unknown[]) => {
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(w => {
            if (!w.isDestroyed() && w.webContents) {
                w.webContents.send(channel, ...args);
            }
        });
    }
};
