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

  public async getAutoModLogs(groupId?: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.getClient() as any).autoModLog.findMany({
          where: groupId ? { groupId } : undefined,
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

