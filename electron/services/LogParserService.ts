/**
 * LogParserService
 * 
 * Pure, stateless service for parsing VRChat log lines.
 * All parsing logic is isolated here for easy testing and reuse.
 * 
 * This service has NO side effects - it takes a line and returns a parsed event or null.
 */

// ============================================
// TYPES - Exported for use by consumers
// ============================================

export interface ParsedLogEvent {
    type: LogEventType;
    timestamp: string;
    data: Record<string, unknown>;
}

export type LogEventType = 
    | 'location'
    | 'world-name'
    | 'player-joined'
    | 'player-left'
    | 'avatar'
    | 'avatar-switch'
    | 'vote-kick'
    | 'video-play'
    | 'notification'
    | 'sticker-spawn';

export interface LocationParseResult {
    type: 'location';
    worldId: string;
    instanceId: string;
    location: string;
    timestamp: string;
}

export interface WorldNameParseResult {
    type: 'world-name';
    name: string;
    timestamp: string;
}

export interface PlayerJoinParseResult {
    type: 'player-joined';
    displayName: string;
    userId?: string;
    timestamp: string;
}

export interface PlayerLeftParseResult {
    type: 'player-left';
    displayName: string;
    userId?: string;
    timestamp: string;
}

export interface AvatarParseResult {
    type: 'avatar';
    avatarId: string;
    timestamp: string;
}

export interface AvatarSwitchParseResult {
    type: 'avatar-switch';
    displayName: string;
    avatarName: string;
    timestamp: string;
}

export interface VoteKickParseResult {
    type: 'vote-kick';
    target: string;
    initiator: string;
    timestamp: string;
}

export interface VideoPlayParseResult {
    type: 'video-play';
    url: string;
    requestedBy: string;
    timestamp: string;
}

export interface NotificationParseResult {
    type: 'notification';
    senderUsername: string;
    senderUserId: string;
    notificationType: string;
    notificationId: string;
    message: string;
    receiverUserId?: string;
    timestamp: string;
}

export interface StickerSpawnParseResult {
    type: 'sticker-spawn';
    userId: string;
    displayName: string;
    stickerId: string;
    timestamp: string;
}

export type ParseResult = 
    | LocationParseResult
    | WorldNameParseResult
    | PlayerJoinParseResult
    | PlayerLeftParseResult
    | AvatarParseResult
    | AvatarSwitchParseResult
    | VoteKickParseResult
    | VideoPlayParseResult
    | NotificationParseResult
    | StickerSpawnParseResult
    | null;

// ============================================
// REGEX PATTERNS
// ============================================

const PATTERNS = {
    // World Location: Joining wrld_xxx:instanceId
    joining: /(?:Joining|Entering)\s+(wrld_[a-zA-Z0-9-]+):([^\s]+)/,
    
    // World Name: Entering Room: <name>
    entering: /Entering Room:\s+(.+)/,
    
    // Avatar Loading
    avatar: /\[Avatar\] Loading Avatar:\s+(avtr_[a-f0-9-]{36})/,
    
    // Vote Kick
    voteKick: /A vote kick has been initiated against\s+(.+)\s+by\s+(.+?),\s+do you agree\?/,
    
    // Video Play
    video: /Started video load for URL:\s+(.+?)(?:,\s+requested by\s+(.+))?$/,
    
    // Player Join Prefix
    playerJoinPrefix: /OnPlayerJoined\s+(?:\[[^\]]+\]\s*)?/,
    
    // Player Left Prefix
    playerLeftPrefix: /OnPlayerLeft\s+/,
    
    // Notifications
    notification: /Received Notification: <Notification from username:(.+?), sender user id:(usr_[a-f0-9-]{36}).+?type:\s*([a-zA-Z]+), id:\s*(not_[a-f0-9-]{36}),.+?message:\s*"(.+?)"/,
    notificationReceiver: /to\s+(usr_[a-f0-9-]{36})/,
    
    // Avatar Switching
    avatarSwitch: /\[Behaviour\] Switching\s+(.+?)\s+to avatar\s+(.+)/,
    
    // Sticker Spawn
    stickerSpawn: /\[StickersManager\] User\s+(usr_[a-f0-9-]{36})\s+\((.+?)\)\s+spawned sticker\s+(inv_[a-f0-9-]{36})/
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract timestamp from VRChat log line (first 19 characters)
 */
export function extractTimestamp(line: string): string {
    return line.substring(0, 19);
}

/**
 * Parse VRChat log timestamp to milliseconds
 */
export function parseLogTimestamp(timestamp: string): number {
    try {
        const parts = timestamp.split(' ');
        if (parts.length === 2 && parts[0].includes('.')) {
            const dateStr = parts[0].replace(/\./g, '-');
            const timeStr = parts[1];
            const logDate = new Date(`${dateStr}T${timeStr}`);
            if (!isNaN(logDate.getTime())) {
                return logDate.getTime();
            }
        }
    } catch { /* ignore */ }
    return 0;
}

/**
 * Extract display name and userId from a "Name (usr_xxx)" format string
 */
export function extractNameAndId(raw: string): { displayName: string; userId?: string } {
    let displayName = raw;
    let userId: string | undefined;

    // Check for ID at the end in format "Name (usr_xxx)"
    const lastParenIndex = raw.lastIndexOf('(');
    if (lastParenIndex !== -1 && raw.endsWith(')')) {
        const possibleId = raw.substring(lastParenIndex + 1, raw.length - 1);
        if (possibleId.startsWith('usr_')) {
            userId = possibleId;
            displayName = raw.substring(0, lastParenIndex).trim();
        }
    }
    
    return { displayName: displayName.trim(), userId };
}

// ============================================
// MAIN PARSING FUNCTION
// ============================================

/**
 * Parse a single VRChat log line and return a structured event.
 * Returns null if the line doesn't match any known pattern.
 * 
 * This function is PURE and STATELESS - it has no side effects.
 * 
 * @param line - The raw log line to parse
 * @returns Parsed event object or null
 */
export function parseLogLine(line: string): ParseResult {
    if (!line || !line.trim()) return null;
    
    const timestamp = extractTimestamp(line);

    // 1. World Location
    const joinMatch = line.match(PATTERNS.joining);
    if (joinMatch) {
        const worldId = joinMatch[1];
        const instanceId = joinMatch[2];
        const location = `${worldId}:${instanceId}`;
        
        return {
            type: 'location',
            worldId,
            instanceId,
            location,
            timestamp
        };
    }

    // 2. Avatar Loading
    const avatarMatch = line.match(PATTERNS.avatar);
    if (avatarMatch) {
        return {
            type: 'avatar',
            avatarId: avatarMatch[1],
            timestamp
        };
    }

    // 3. Entering Room (World Name)
    const enterMatch = line.match(PATTERNS.entering);
    if (enterMatch) {
        return {
            type: 'world-name',
            name: enterMatch[1].trim(),
            timestamp
        };
    }

    // 4. Player Joined
    if (line.includes('OnPlayerJoined')) {
        const match = line.match(PATTERNS.playerJoinPrefix);
        if (match) {
            const restOfLine = line.substring(match.index! + match[0].length);
            const { displayName, userId } = extractNameAndId(restOfLine);
            
            if (displayName) {
                return {
                    type: 'player-joined',
                    displayName,
                    userId,
                    timestamp
                };
            }
        }
    }

    // 5. Player Left
    if (line.includes('OnPlayerLeft')) {
        const match = line.match(PATTERNS.playerLeftPrefix);
        if (match) {
            const restOfLine = line.substring(match.index! + match[0].length);
            const { displayName, userId } = extractNameAndId(restOfLine);
            
            if (displayName) {
                return {
                    type: 'player-left',
                    displayName,
                    userId,
                    timestamp
                };
            }
        }
    }

    // 6. Vote Kick
    const voteMatch = line.match(PATTERNS.voteKick);
    if (voteMatch) {
        return {
            type: 'vote-kick',
            target: voteMatch[1].trim(),
            initiator: voteMatch[2].trim(),
            timestamp
        };
    }

    // 7. Video Play
    const videoMatch = line.match(PATTERNS.video);
    if (videoMatch) {
        return {
            type: 'video-play',
            url: videoMatch[1].trim(),
            requestedBy: videoMatch[2] ? videoMatch[2].trim() : 'Unknown',
            timestamp
        };
    }

    // 8. Notifications
    if (line.includes('Received Notification:')) {
        const match = line.match(PATTERNS.notification);
        if (match) {
            const receiverMatch = line.match(PATTERNS.notificationReceiver);
            return {
                type: 'notification',
                senderUsername: match[1],
                senderUserId: match[2],
                notificationType: match[3],
                notificationId: match[4],
                message: match[5],
                receiverUserId: receiverMatch ? receiverMatch[1] : undefined,
                timestamp
            };
        }
    }

    // 9. Avatar Switching
    if (line.includes('[Behaviour] Switching')) {
        const match = line.match(PATTERNS.avatarSwitch);
        if (match) {
            return {
                type: 'avatar-switch',
                displayName: match[1],
                avatarName: match[2],
                timestamp
            };
        }
    }

    // 10. Sticker Spawn
    if (line.includes('[StickersManager] User')) {
        const match = line.match(PATTERNS.stickerSpawn);
        if (match) {
            return {
                type: 'sticker-spawn',
                userId: match[1],
                displayName: match[2],
                stickerId: match[3],
                timestamp
            };
        }
    }

    return null;
}

// ============================================
// SMART SYNC HELPER
// ============================================

/**
 * Check if a log line contains a reference to a specific instance ID.
 * Used for smart sync to find the session start point.
 * 
 * @param line - The raw log line
 * @param targetInstanceId - The full instance ID to look for
 * @returns Match result with location if found
 */
export function checkForInstanceMatch(line: string, targetInstanceId: string): { match: boolean; location?: string } {
    const getBaseId = (id: string) => id.split('~')[0];
    const targetBase = getBaseId(targetInstanceId);
    
    const joinMatch = line.match(PATTERNS.joining);
    
    if (joinMatch) {
        const logId = `${joinMatch[1]}:${joinMatch[2]}`;
        const logBase = getBaseId(logId);
        
        if (logBase === targetBase) {
            return { match: true, location: logId };
        }
    } else if (line.includes(targetBase)) {
        // Fallback: simple string match
        return { match: true, location: targetInstanceId };
    }
    
    return { match: false };
}

// ============================================
// SERVICE EXPORT
// ============================================

export const logParserService = {
    parseLogLine,
    extractTimestamp,
    parseLogTimestamp,
    extractNameAndId,
    checkForInstanceMatch,
    PATTERNS
};
