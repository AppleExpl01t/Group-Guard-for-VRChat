import { PrismaClient } from '@prisma/client';
import path from 'path';
import log from 'electron-log';
import { storageService } from './StorageService';
import fs from 'fs';
import crypto from 'crypto';

const logger = log.scope('DatabaseService');

class DatabaseService {
  private prisma: PrismaClient | null = null;
  private isInitialized = false;

  constructor() {}

  public async initialize() {
    if (this.isInitialized) return;

    try {
      const dataDir = storageService.getDataDir();
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = path.join(dataDir, 'database.sqlite');
      // Ensure file exists to avoid some driver oddities, though usually not needed
      if (!fs.existsSync(dbPath)) {
          fs.writeFileSync(dbPath, '');
      }

      const dbUrl = `file:${dbPath}`;
      
      logger.info(`Initializing database at: ${dbPath}`);

      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: dbUrl,
          },
        },
      });

      await this.ensureTables();
      this.isInitialized = true;
      logger.info('Database initialized successfully.');

    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async ensureTables() {
    if (!this.prisma) return;
    
    try {
      // Check if Session table exists
      // const result = await this.prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='Session';`;
      // if (Array.isArray(result) && result.length > 0) {
      //   return; // Tables exist
      // }

      logger.info('Tables not found. Creating initial schema...');

      const statements = [
        `CREATE TABLE IF NOT EXISTS "Session" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "sessionId" TEXT NOT NULL,
            "worldId" TEXT NOT NULL,
            "instanceId" TEXT NOT NULL,
            "worldName" TEXT,
            "groupId" TEXT,
            "location" TEXT NOT NULL,
            "startTime" DATETIME NOT NULL,
            "endTime" DATETIME,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "LogEntry" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "sessionId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "timestamp" DATETIME NOT NULL,
            "actorDisplayName" TEXT,
            "actorUserId" TEXT,
            "details" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "LogEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS "AutoModLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "timestamp" DATETIME NOT NULL,
            "user" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "groupId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "reason" TEXT NOT NULL,
            "module" TEXT NOT NULL,
            "details" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS "ScannedUser" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "displayName" TEXT NOT NULL,
            "rank" TEXT,
            "thumbnailUrl" TEXT,
            "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "groupId" TEXT,
            "timesEncountered" INTEGER NOT NULL DEFAULT 1
        );`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionId_key" ON "Session"("sessionId");`,
        `CREATE INDEX IF NOT EXISTS "ScannedUser_displayName_idx" ON "ScannedUser"("displayName");`,
        `CREATE INDEX IF NOT EXISTS "ScannedUser_groupId_idx" ON "ScannedUser"("groupId");`,
        `CREATE INDEX IF NOT EXISTS "ScannedUser_lastSeenAt_idx" ON "ScannedUser"("lastSeenAt");`
      ];

      for (const stmt of statements) {
        await this.prisma.$executeRawUnsafe(stmt);
      }
      
      logger.info('Schema created.');

    } catch (error) {
      logger.error('Error checking/creating tables:', error);
      throw error;
    }
  }

  public getClient() {
    // If called before init, try to init (though async issue)
    if (!this.prisma) {
        // This is dangerous if called synchronously logic depends on it.
        // But for now verify init in main.
      throw new Error('Database not initialized');
    }
    return this.prisma;
  }
  
  public async createSession(data: {
      sessionId: string, worldId: string, instanceId: string, location: string, 
      groupId: string | null, startTime: Date, worldName?: string
  }) {
      return this.getClient().session.create({ data });
  }

  public async updateSession(sessionId: string, data: Partial<{ endTime: Date, worldName: string }>) {
      return this.getClient().session.update({
          where: { sessionId },
          data
      });
  }

  public async createLogEntry(data: {
      sessionId: string, type: string, timestamp: Date, 
      actorDisplayName?: string, actorUserId?: string, details: unknown
  }) {
      return this.getClient().logEntry.create({
          data: {
              ...data,
              details: JSON.stringify(data.details)
          }
      });
  }

  public async createAutoModLog(data: {
      timestamp: Date, user: string, userId: string, groupId: string,
      action: string, reason: string, module: string, details?: string 
  }) {
        // Cast to any to avoid TS error until client is regenerated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.getClient() as any).autoModLog.create({
          data: {
              ...data,
              id: crypto.randomUUID() // Ensure we generate ID if prisma middleware doesn't
          }
      });
  }

  public async getAutoModLogs() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.getClient() as any).autoModLog.findMany({
          orderBy: { timestamp: 'desc' }
      });
  }

  public async clearAutoModLogs() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.getClient() as any).autoModLog.deleteMany({});
  }

  public async getSessions(groupIdFilter?: string) {
      return this.getClient().session.findMany({
          where: groupIdFilter ? { groupId: groupIdFilter } : undefined,
          orderBy: { startTime: 'desc' }
      });
  }

  public async getSessionEvents(sessionId: string) {
      const logs = await this.getClient().logEntry.findMany({
          where: { sessionId },
          orderBy: { timestamp: 'asc' }
      });
      // Parse details back to JSON
      return logs.map(l => ({
          ...l,
          details: JSON.parse(l.details)
      }));
  }

  public async deleteAllSessions() {
      await this.getClient().logEntry.deleteMany({});
      return this.getClient().session.deleteMany({});
  }

  // ============================================
  // ANALYTICS
  // ============================================

  public async getDailyActivityStats(groupId: string, days: number = 30) {
      // Aggregate Log Entries by Date
      // We look for 'group.user.join', 'group.user.kick', 'group.user.ban', 'automod' events related to this group.
      
      // Since logs are unified in LogEntry (remote) and AutoModLog (local), 
      // AND remote Audit Logs are *fetched* live but not stored in DB permanently in this tailored DB schema (LogEntry is for Session Logs)...
      // WAIT: The current "Audit Logs" tab fetches remote API data live. It doesn't sync to DB history.
      // THE DB "LogEntry" Table tracks *Session* events (local instance logs).
      // "AutoModLog" tracks AutoMod actions.
      
      // CHALLENGE: User wants "Growth Chart".
      // Remote Audit Logs (API) are the only source of truth for "Joins" when the app wasn't running?
      // OR does the user only care about "Activity while handling"?
      // "New Joins" usually come from the "Group Audit Log".
      // We can't query the API for *historical stats* easily without fetching thousands of pages.
      // PROPOSAL: We will build charts based on LOCALLY OBSERVED/AUTOMODDED events and whatever we cached?
      // Actually, standard usage of "Group Guard" implies it's running.
      // Let's rely on "AutoModLog" for "Kicks/Bans" (Automod actions) and "LogEntry" for instance Activity.
      
      // REVISION: The DashboardView fetches `groups:get-audit-logs` which merges remote + local.
      // For the CHART, we should probably do the same on the frontend OR fetch remote logs here and process?
      // Doing it on frontend with the existing `auditStore` might be slow if we want 30 days history.
      // 
      // BETTER APPROACH FOR MVP: Query the `AutoModLog` table for "Automod Activity" (Blocks per day).
      // For "Join Growth", that's harder without a synced database.
      // Let's implement `getAutoModStats` first which we HAVE data for.
      
      // To get "Joins", we can query `LogEntry` for `PLAYER_JOIN` events in sessions associated with this group.
      // This shows "Instance Traffic", which is a form of Growth/Activity.
      
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      
      // 1. Instance Traffic (from local session logs)
      // Group sessions only might be hard if `groupId` isn't always set, but we try.
      // SQLite truncating needed. Let's use raw query for date grouping.
      
      const trafficRaw = await this.getClient().$queryRaw`
        SELECT 
            strftime('%Y-%m-%d', timestamp) as date,
            COUNT(*) as count
        FROM LogEntry
        WHERE type IN ('PLAYER_JOIN', 'JOIN')
        AND sessionId IN (SELECT sessionId FROM Session WHERE groupId = ${groupId} OR groupId IS NULL) 
        AND timestamp >= ${cutoff}
        GROUP BY date
      ` as { date: string; count: bigint }[];

      // 2. AutoMod Activity (Kicks/Bans/Blocks)
      const automodRaw = await this.getClient().$queryRaw`
        SELECT 
            strftime('%Y-%m-%d', timestamp) as date,
            COUNT(*) as count,
            action
        FROM AutoModLog
        WHERE groupId = ${groupId}
        AND timestamp >= ${cutoff}
        GROUP BY date, action
      ` as { date: string; count: bigint; action: string }[];

      // Serialize BigInts
      const traffic = trafficRaw.map(t => ({
          date: t.date,
          count: Number(t.count)
      }));

      const automod = automodRaw.map(a => ({
          date: a.date,
          count: Number(a.count),
          action: a.action
      }));

      return { traffic, automod };
  }

  public async getActivityHeatmap(groupId: string) {
      // Heatmap: DayOfWeek (0-6) vs Hour (0-23)
      // Based on Session User Activity (LogEntry)
      
      const activityRaw = await this.getClient().$queryRaw`
        SELECT 
            strftime('%w', timestamp) as dayOfWeek,
            strftime('%H', timestamp) as hour,
            COUNT(*) as count
        FROM LogEntry
        WHERE type IN ('PLAYER_JOIN', 'JOIN')
        AND sessionId IN (SELECT sessionId FROM Session WHERE groupId = ${groupId} OR groupId IS NULL)
        GROUP BY dayOfWeek, hour
      ` as { dayOfWeek: string; hour: string; count: bigint }[];
      
      return activityRaw.map(a => ({
          dayOfWeek: a.dayOfWeek,
          hour: a.hour,
          count: Number(a.count)
      }));
  }

  // ============================================
  // SCANNED USERS
  // ============================================

  public async upsertScannedUser(user: {
      id: string;
      displayName: string;
      rank?: string;
      thumbnailUrl?: string;
      groupId?: string;
  }) {
      try {
          // Check if user exists
          const existing = await this.getClient().$queryRaw`
              SELECT id, timesEncountered FROM ScannedUser WHERE id = ${user.id}
          ` as { id: string; timesEncountered: number }[];

          if (existing.length > 0) {
              // Update existing user
              await this.getClient().$executeRaw`
                  UPDATE ScannedUser 
                  SET displayName = ${user.displayName},
                      rank = ${user.rank || null},
                      thumbnailUrl = ${user.thumbnailUrl || null},
                      groupId = ${user.groupId || null},
                      lastSeenAt = ${new Date().toISOString()},
                      timesEncountered = ${existing[0].timesEncountered + 1}
                  WHERE id = ${user.id}
              `;
          } else {
              // Insert new user
              await this.getClient().$executeRaw`
                  INSERT INTO ScannedUser (id, displayName, rank, thumbnailUrl, groupId, firstSeenAt, lastSeenAt, timesEncountered)
                  VALUES (${user.id}, ${user.displayName}, ${user.rank || null}, ${user.thumbnailUrl || null}, ${user.groupId || null}, ${new Date().toISOString()}, ${new Date().toISOString()}, 1)
              `;
          }
          return true;
      } catch (error) {
          logger.error('Failed to upsert scanned user:', error);
          return false;
      }
  }

  public async searchScannedUsers(query: string, limit: number = 20) {
      try {
          const searchPattern = `%${query}%`;
          const results = await this.getClient().$queryRaw`
              SELECT id, displayName, rank, thumbnailUrl, groupId, lastSeenAt, timesEncountered
              FROM ScannedUser
              WHERE displayName LIKE ${searchPattern} OR id LIKE ${searchPattern}
              ORDER BY timesEncountered DESC, lastSeenAt DESC
              LIMIT ${limit}
          ` as {
              id: string;
              displayName: string;
              rank: string | null;
              thumbnailUrl: string | null;
              groupId: string | null;
              lastSeenAt: string;
              timesEncountered: number;
          }[];
          return results;
      } catch (error) {
          logger.error('Failed to search scanned users:', error);
          return [];
      }
  }

  public async getScannedUser(userId: string) {
      try {
          const results = await this.getClient().$queryRaw`
              SELECT id, displayName, rank, thumbnailUrl, groupId, firstSeenAt, lastSeenAt, timesEncountered
              FROM ScannedUser
              WHERE id = ${userId}
          ` as {
              id: string;
              displayName: string;
              rank: string | null;
              thumbnailUrl: string | null;
              groupId: string | null;
              firstSeenAt: string;
              lastSeenAt: string;
              timesEncountered: number;
          }[];
          return results[0] || null;
      } catch (error) {
          logger.error('Failed to get scanned user:', error);
          return null;
      }
  }

  public async getRecentScannedUsers(limit: number = 50) {
      try {
          const results = await this.getClient().$queryRaw`
              SELECT id, displayName, rank, thumbnailUrl, groupId, lastSeenAt, timesEncountered
              FROM ScannedUser
              ORDER BY lastSeenAt DESC
              LIMIT ${limit}
          ` as {
              id: string;
              displayName: string;
              rank: string | null;
              thumbnailUrl: string | null;
              groupId: string | null;
              lastSeenAt: string;
              timesEncountered: number;
          }[];
          return results;
      } catch (error) {
          logger.error('Failed to get recent scanned users:', error);
          return [];
      }
  }
}

export const databaseService = new DatabaseService();

