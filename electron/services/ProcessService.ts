import { execFile } from 'child_process';
import EventEmitter from 'events';
import log from 'electron-log';

const logger = log.scope('ProcessService');

class ProcessService extends EventEmitter {
    private checkInterval: NodeJS.Timeout | null = null;
    private _isRunning = false;
    private processName = 'vrchat.exe';

    constructor() {
        super();
    }

    public get isRunning() {
        return this._isRunning;
    }

    /**
     * Start monitoring the process status
     * @param intervalMs How often to check (default 5000ms)
     */
    public startMonitoring(intervalMs = 5000) {
        if (this.checkInterval) return;

        logger.info(`[ProcessService] Starting monitoring for ${this.processName}...`);
        
        // Initial check immediately
        this.checkProcess();

        this.checkInterval = setInterval(() => {
            this.checkProcess();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    public stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('[ProcessService] Monitoring stopped');
        }
    }

    /**
     * Force a check now
     */
    public async checkProcess(): Promise<boolean> {
        return new Promise((resolve) => {
            // Using fast, raw tasklist check
            execFile('tasklist', ['/FI', `IMAGENAME eq ${this.processName}`, '/FO', 'CSV', '/NH'], (error, stdout) => {
                let found = false;
                
                if (error) {
                    // Tasklist failed? Assume not run running or error
                    // Don't log spam errors, just debug
                    logger.debug(`[ProcessService] Check failed: ${error.message}`);
                } else {
                    // Output format: "vrchat.exe","1234","Console","1","123,456 K"
                    // If not found: "INFO: No tasks are running which match..." OR just empty depending on version
                    if (stdout && stdout.toLowerCase().includes(this.processName)) {
                        found = true;
                    }
                }

                if (this._isRunning !== found) {
                    this._isRunning = found;
                    logger.info(`[ProcessService] Status Changed: ${found ? 'RUNNING' : 'STOPPED'}`);
                    this.emit('status-changed', found);
                }

                resolve(found);
            });
        });
    }
}

export const processService = new ProcessService();
