/**
 * LogParserService
 *
 * Pure, stateless parser for VRChat log lines.
 * No side effects — takes a line, returns a structured event or null.
 */

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

export const PATTERNS = {
    joining: /(?:Joining|Entering)\s+(wrld_[a-zA-Z0-9-]+):([^\s]+)/,
    entering: /Entering Room:\s+(.+)/,
    avatar: /\[Avatar\] Loading Avatar:\s+(avtr_[a-f0-9-]{36})/,
    voteKick: /A vote kick has been initiated against\s+(.+)\s+by\s+(.+?),\s+do you agree\?/,
    video: /Started video load for URL:\s+(.+?)(?:,\s+requested by\s+(.+))?$/,
    playerJoinPrefix: /OnPlayerJoined\s+(?:\[[^\]]+\]\s*)?/,
    playerLeftPrefix: /OnPlayerLeft\s+/,
    notification: /Received Notification: <Notification from username:(.+?), sender user id:(usr_[a-f0-9-]{36}).+?type:\s*([a-zA-Z]+), id:\s*(not_[a-f0-9-]{36}),.+?message:\s*"(.+?)"/,
    notificationReceiver: /to\s+(usr_[a-f0-9-]{36})/,
    avatarSwitch: /\[Behaviour\] Switching\s+(.+?)\s+to avatar\s+(.+)/,
    stickerSpawn: /\[StickersManager\] User\s+(usr_[a-f0-9-]{36})\s+\((.+?)\)\s+spawned sticker\s+(inv_[a-f0-9-]{36})/,
};

/** Returns the first 19 characters of a log line (the VRChat timestamp). */
export function extractTimestamp(line: string): string {
    return line.substring(0, 19);
}

/** Parses a VRChat log timestamp string ("2024.01.15 12:34:56") to milliseconds. Returns 0 on failure. */
export function parseLogTimestamp(timestamp: string): number {
    try {
        const parts = timestamp.split(' ');
        if (parts.length === 2 && parts[0].includes('.')) {
            const logDate = new Date(`${parts[0].replace(/\./g, '-')}T${parts[1]}`);
            if (!isNaN(logDate.getTime())) {
                return logDate.getTime();
            }
        }
    } catch { /* ignore */ }
    return 0;
}

/** Parses a "DisplayName (usr_xxx)" string into its components. */
export function extractNameAndId(raw: string): { displayName: string; userId?: string } {
    let displayName = raw;
    let userId: string | undefined;

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

/** Strips the instance modifiers (e.g. `~canRequestInvite(...)`) to get the base `worldId:instanceId`. */
function getBaseId(id: string): string {
    return id.split('~')[0];
}

/**
 * Parses a single VRChat log line into a structured event.
 * Returns null if the line doesn't match any known pattern.
 * Pure and stateless — no side effects.
 */
export function parseLogLine(line: string): ParseResult {
    if (!line || !line.trim()) return null;

    const timestamp = extractTimestamp(line);

    const joinMatch = line.match(PATTERNS.joining);
    if (joinMatch) {
        const worldId = joinMatch[1];
        const instanceId = joinMatch[2];
        return { type: 'location', worldId, instanceId, location: `${worldId}:${instanceId}`, timestamp };
    }

    const avatarMatch = line.match(PATTERNS.avatar);
    if (avatarMatch) {
        return { type: 'avatar', avatarId: avatarMatch[1], timestamp };
    }

    const enterMatch = line.match(PATTERNS.entering);
    if (enterMatch) {
        return { type: 'world-name', name: enterMatch[1].trim(), timestamp };
    }

    if (line.includes('OnPlayerJoined')) {
        const match = line.match(PATTERNS.playerJoinPrefix);
        if (match) {
            const { displayName, userId } = extractNameAndId(line.substring(match.index! + match[0].length));
            if (displayName) {
                return { type: 'player-joined', displayName, userId, timestamp };
            }
        }
    }

    if (line.includes('OnPlayerLeft')) {
        const match = line.match(PATTERNS.playerLeftPrefix);
        if (match) {
            const { displayName, userId } = extractNameAndId(line.substring(match.index! + match[0].length));
            if (displayName) {
                return { type: 'player-left', displayName, userId, timestamp };
            }
        }
    }

    const voteMatch = line.match(PATTERNS.voteKick);
    if (voteMatch) {
        return { type: 'vote-kick', target: voteMatch[1].trim(), initiator: voteMatch[2].trim(), timestamp };
    }

    const videoMatch = line.match(PATTERNS.video);
    if (videoMatch) {
        return {
            type: 'video-play',
            url: videoMatch[1].trim(),
            requestedBy: videoMatch[2] ? videoMatch[2].trim() : 'Unknown',
            timestamp
        };
    }

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

    if (line.includes('[Behaviour] Switching')) {
        const match = line.match(PATTERNS.avatarSwitch);
        if (match) {
            return { type: 'avatar-switch', displayName: match[1], avatarName: match[2], timestamp };
        }
    }

    if (line.includes('[StickersManager] User')) {
        const match = line.match(PATTERNS.stickerSpawn);
        if (match) {
            return { type: 'sticker-spawn', userId: match[1], displayName: match[2], stickerId: match[3], timestamp };
        }
    }

    return null;
}

/**
 * Checks whether a log line references a specific instance ID.
 * Used to locate the session start point when fast-forwarding through a log.
 */
export function checkForInstanceMatch(line: string, targetInstanceId: string): { match: boolean; location?: string } {
    const targetBase = getBaseId(targetInstanceId);

    const joinMatch = line.match(PATTERNS.joining);
    if (joinMatch) {
        const logId = `${joinMatch[1]}:${joinMatch[2]}`;
        if (getBaseId(logId) === targetBase) {
            return { match: true, location: logId };
        }
    } else if (line.includes(targetBase)) {
        return { match: true, location: targetInstanceId };
    }

    return { match: false };
}

export const logParserService = {
    parseLogLine,
    extractTimestamp,
    parseLogTimestamp,
    extractNameAndId,
    checkForInstanceMatch,
    PATTERNS,
};
