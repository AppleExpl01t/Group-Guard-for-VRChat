import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { app } from 'electron';
import { databaseService } from './DatabaseService';
import { parseLogTimestamp, extractNameAndId } from './LogParserService';

const logger = log.scope('LogScannerService');

export class LogScannerService {
    private isScanning = false;

    /**
     * Scans historical VRChat log files and imports session durations into FriendStats.
     * Skips files already consumed by the live LogWatcherService.
     */
    public async scanAndImportHistory(): Promise<{ processedFiles: number; totalMinutesAdded: number }> {
        if (this.isScanning) throw new Error('Scan already in progress');
        this.isScanning = true;

        let totalMinutes = 0;
        let processedFiles = 0;

        try {
            await this.recalibrateFromPlayerLog();

            const logDir = this.getLogDirectory();
            if (!fs.existsSync(logDir)) {
                logger.warn('VRChat log directory not found.');
                return { processedFiles: 0, totalMinutesAdded: 0 };
            }

            const files = fs.readdirSync(logDir)
                .filter(f => f.startsWith('output_log_') && f.endsWith('.txt'))
                .sort();

            logger.info(`Found ${files.length} log files to scan.`);

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { logWatcherService } = require('./LogWatcherService');
            const processedSet = logWatcherService.getProcessedFiles();

            for (const file of files) {
                if (processedSet.has(file)) {
                    logger.debug(`Skipping ${file} (already processed by live tracking)`);
                    continue;
                }

                const filePath = path.join(logDir, file);
                const minutesAdded = await this.processLogFile(filePath);
                if (minutesAdded > 0) {
                    totalMinutes += minutesAdded;
                }

                logWatcherService.markFileAsProcessed(file);

                processedFiles++;
            }

            logger.info(`Scan complete. Added ${totalMinutes} minutes from ${processedFiles} files.`);
            return { processedFiles, totalMinutesAdded: totalMinutes };

        } catch (e) {
            logger.error('Scan failed:', e);
            throw e;
        } finally {
            this.isScanning = false;
        }
    }

    private getLogDirectory(): string {
        const appData = app.getPath('appData');
        const localLow = path.join(appData, '..', 'LocalLow');
        return path.join(localLow, 'VRChat', 'VRChat');
    }

    private async processLogFile(filePath: string): Promise<number> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            const sessions = new Map<string, number>(); // displayName -> joinTime ms
            const durations = new Map<string, number>(); // displayName -> total ms
            const idMap = new Map<string, string>();     // displayName -> userId

            let fileTimestamp = Date.now();
            let fileTimestampSet = false;

            for (const line of lines) {
                const ts = parseLogTimestamp(line.substring(0, 19));
                if (!ts) continue;

                if (!fileTimestampSet) {
                    fileTimestamp = ts;
                    fileTimestampSet = true;
                }

                if (line.includes('[Behaviour] OnPlayerJoined')) {
                    const suffix = line.match(/OnPlayerJoined\s+(.+)/)?.[1] ?? '';
                    const { displayName, userId } = extractNameAndId(suffix);
                    if (displayName) {
                        sessions.set(displayName, ts);
                        if (userId) idMap.set(displayName, userId);
                    }
                } else if (line.includes('[Behaviour] OnPlayerLeft')) {
                    const suffix = line.match(/OnPlayerLeft\s+(.+)/)?.[1] ?? '';
                    const { displayName, userId } = extractNameAndId(suffix);
                    if (displayName && sessions.has(displayName)) {
                        const durationMs = ts - sessions.get(displayName)!;
                        // Reject implausible session lengths (negative or over 24 h)
                        if (durationMs > 0 && durationMs < 24 * 60 * 60 * 1000) {
                            durations.set(displayName, (durations.get(displayName) ?? 0) + durationMs);
                        }
                        sessions.delete(displayName);
                        if (userId) idMap.set(displayName, userId);
                    }
                }
            }

            return await this.commitDurations(durations, idMap, fileTimestamp);

        } catch (e) {
            logger.error(`Failed to parse log file ${filePath}:`, e);
            return 0;
        }
    }

    private async commitDurations(durations: Map<string, number>, idMap: Map<string, string>, logTimestamp: number): Promise<number> {
        let addedMinutes = 0;
        const client = databaseService.getClient();

        // Sequential upserts rather than a transaction: a transaction would hold the DB lock
        // for the entire map iteration, which can be very long for large log files.
        for (const [name, ms] of durations.entries()) {
            const minutes = Math.floor(ms / (1000 * 60));
            if (minutes < 1) continue;

            // Old logs may not include userId in the line text; skip those entries.
            const userId = idMap.get(name);
            if (!userId) continue;

            try {
                // @ts-ignore — Prisma client type is not inferred in this context
                await client.friendStats.upsert({
                    where: { userId },
                    create: {
                        userId,
                        displayName: name,
                        timeSpentMinutes: minutes,
                        encounterCount: 1,
                        lastSeen: new Date(logTimestamp),
                        lastHeartbeat: new Date(0),
                        createdAt: new Date(logTimestamp),
                    },
                    update: {
                        timeSpentMinutes: { increment: minutes },
                        encounterCount: { increment: 1 },
                    },
                });
                addedMinutes += minutes;
            } catch {
                // Ignore individual upsert failures (e.g. constraint races)
            }
        }
        return addedMinutes;
    }
    private async recalibrateFromPlayerLog(): Promise<number> {
        logger.info('[Recalibration] Starting strict correction from Instance History...');

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { playerLogService } = require('./PlayerLogService');
        const entries: { type: string; userId?: string }[] = await playerLogService.getAllEntries();

        const stats = new Map<string, number>(); // userId -> join count
        for (const entry of entries) {
            if (entry.type === 'join' && entry.userId) {
                stats.set(entry.userId, (stats.get(entry.userId) ?? 0) + 1);
            }
        }

        const client = databaseService.getClient();
        let updated = 0;

        for (const [userId, count] of stats.entries()) {
            try {
                // @ts-ignore — Prisma client type is not inferred in this context
                await client.friendStats.update({
                    where: { userId },
                    data: { encounterCount: count },
                });
                updated++;
            } catch {
                // User may not exist in FriendStats yet (e.g. a player seen before becoming a friend)
            }
        }

        logger.info(`[Recalibration] Corrected encounter counts for ${updated} users.`);
        return updated;
    }
}

export const logScannerService = new LogScannerService();
