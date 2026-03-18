/**
 * LogParserService Tests
 *
 * LogParserService is a pure, stateless parser — no mocks needed.
 * Every test is a direct input → output assertion.
 */

import { describe, it, expect } from 'vitest';
import {
    parseLogLine,
    extractTimestamp,
    parseLogTimestamp,
    extractNameAndId,
    checkForInstanceMatch,
} from '../LogParserService';

// ---------------------------------------------------------------------------
// Shared timestamp prefix used across log line fixtures
// ---------------------------------------------------------------------------
const TS = '2024.01.15 12:34:56';
const prefix = `${TS} Log        -  `;

// ---------------------------------------------------------------------------
// extractTimestamp
// ---------------------------------------------------------------------------
describe('extractTimestamp', () => {
    it('returns the first 19 characters of the line', () => {
        expect(extractTimestamp(`${TS} anything`)).toBe(TS);
    });

    it('returns empty string for an empty line', () => {
        expect(extractTimestamp('')).toBe('');
    });

    it('returns as many chars as available when line is shorter than 19', () => {
        expect(extractTimestamp('2024.01.15')).toBe('2024.01.15');
    });
});

// ---------------------------------------------------------------------------
// parseLogTimestamp
// ---------------------------------------------------------------------------
describe('parseLogTimestamp', () => {
    it('converts a valid VRChat timestamp to milliseconds', () => {
        const ms = parseLogTimestamp('2024.01.15 12:34:56');
        expect(ms).toBeGreaterThan(0);
        const d = new Date(ms);
        expect(d.getUTCFullYear()).toBe(2024);
        expect(d.getUTCMonth()).toBe(0); // January = 0
        expect(d.getUTCDate()).toBe(15);
    });

    it('returns 0 for a malformed timestamp', () => {
        expect(parseLogTimestamp('not-a-date')).toBe(0);
        expect(parseLogTimestamp('')).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// extractNameAndId
// ---------------------------------------------------------------------------
describe('extractNameAndId', () => {
    it('extracts displayName and userId from "Name (usr_xxx)" format', () => {
        const result = extractNameAndId('CoolPlayer (usr_abc123def456)');
        expect(result.displayName).toBe('CoolPlayer');
        expect(result.userId).toBe('usr_abc123def456');
    });

    it('returns displayName only when no userId suffix', () => {
        const result = extractNameAndId('JustAName');
        expect(result.displayName).toBe('JustAName');
        expect(result.userId).toBeUndefined();
    });

    it('ignores parenthesised content that is not a usr_ id', () => {
        const result = extractNameAndId('Player (clan tag)');
        expect(result.displayName).toBe('Player (clan tag)');
        expect(result.userId).toBeUndefined();
    });

    it('trims surrounding whitespace from the display name', () => {
        const result = extractNameAndId('  SpaceyName  (usr_xyz)');
        expect(result.displayName).toBe('SpaceyName');
        expect(result.userId).toBe('usr_xyz');
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — returns null for unrecognised / empty lines
// ---------------------------------------------------------------------------
describe('parseLogLine — null cases', () => {
    it('returns null for an empty string', () => {
        expect(parseLogLine('')).toBeNull();
    });

    it('returns null for a whitespace-only string', () => {
        expect(parseLogLine('   ')).toBeNull();
    });

    it('returns null for an unrecognised log line', () => {
        expect(parseLogLine(`${prefix}Some random debug message`)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — location (Joining / Entering)
// ---------------------------------------------------------------------------
describe('parseLogLine — location', () => {
    it('parses a "Joining" location line', () => {
        const line = `${prefix}Joining wrld_1234abcd-5678-efgh:99999~private(usr_owner)~nonce(abc)`;
        const result = parseLogLine(line);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('location');
        if (result?.type === 'location') {
            expect(result.worldId).toBe('wrld_1234abcd-5678-efgh');
            expect(result.instanceId).toBe('99999~private(usr_owner)~nonce(abc)');
            expect(result.location).toContain('wrld_1234abcd-5678-efgh');
            expect(result.timestamp).toBe(TS);
        }
    });

    it('parses an "Entering" location line', () => {
        const line = `${prefix}Entering wrld_aabbccdd:12345`;
        const result = parseLogLine(line);
        expect(result?.type).toBe('location');
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — world-name
// ---------------------------------------------------------------------------
describe('parseLogLine — world-name', () => {
    it('parses "Entering Room:" lines', () => {
        const line = `${prefix}Entering Room: The Great Hall`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('world-name');
        if (result?.type === 'world-name') {
            expect(result.name).toBe('The Great Hall');
            expect(result.timestamp).toBe(TS);
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — player-joined
// ---------------------------------------------------------------------------
describe('parseLogLine — player-joined', () => {
    it('parses an OnPlayerJoined line without a userId', () => {
        const line = `${prefix}OnPlayerJoined AmazingUser`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('player-joined');
        if (result?.type === 'player-joined') {
            expect(result.displayName).toBe('AmazingUser');
            expect(result.userId).toBeUndefined();
        }
    });

    it('parses an OnPlayerJoined line that includes a usr_ id', () => {
        const line = `${prefix}OnPlayerJoined AmazingUser (usr_abc-1234)`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('player-joined');
        if (result?.type === 'player-joined') {
            expect(result.displayName).toBe('AmazingUser');
            expect(result.userId).toBe('usr_abc-1234');
        }
    });

    it('parses OnPlayerJoined with a bracketed prefix in the line', () => {
        const line = `${prefix}OnPlayerJoined [VRC+ User] NicePlayer`;
        const result = parseLogLine(line);
        expect(result?.type).toBe('player-joined');
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — player-left
// ---------------------------------------------------------------------------
describe('parseLogLine — player-left', () => {
    it('parses an OnPlayerLeft line', () => {
        const line = `${prefix}OnPlayerLeft LeavingUser`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('player-left');
        if (result?.type === 'player-left') {
            expect(result.displayName).toBe('LeavingUser');
        }
    });

    it('parses OnPlayerLeft with a usr_ id suffix', () => {
        const line = `${prefix}OnPlayerLeft LeavingUser (usr_leave-999)`;
        const result = parseLogLine(line);

        if (result?.type === 'player-left') {
            expect(result.userId).toBe('usr_leave-999');
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — avatar
// ---------------------------------------------------------------------------
describe('parseLogLine — avatar', () => {
    it('parses an avatar loading line', () => {
        const avtrId = 'avtr_12345678-1234-1234-1234-123456789abc';
        const line = `${prefix}[Avatar] Loading Avatar: ${avtrId}`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('avatar');
        if (result?.type === 'avatar') {
            expect(result.avatarId).toBe(avtrId);
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — avatar-switch
// ---------------------------------------------------------------------------
describe('parseLogLine — avatar-switch', () => {
    it('parses a [Behaviour] Switching line', () => {
        const line = `${prefix}[Behaviour] Switching PlayerName to avatar NewAvatarName`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('avatar-switch');
        if (result?.type === 'avatar-switch') {
            expect(result.displayName).toBe('PlayerName');
            expect(result.avatarName).toBe('NewAvatarName');
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — vote-kick
// ---------------------------------------------------------------------------
describe('parseLogLine — vote-kick', () => {
    it('parses a vote kick initiation line', () => {
        const line = `${prefix}A vote kick has been initiated against TargetPlayer by InitiatorPlayer, do you agree?`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('vote-kick');
        if (result?.type === 'vote-kick') {
            expect(result.target).toBe('TargetPlayer');
            expect(result.initiator).toBe('InitiatorPlayer');
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — video-play
// ---------------------------------------------------------------------------
describe('parseLogLine — video-play', () => {
    it('parses a video play line with a requester', () => {
        const line = `${prefix}Started video load for URL: https://example.com/video.mp4, requested by DJUser`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('video-play');
        if (result?.type === 'video-play') {
            expect(result.url).toBe('https://example.com/video.mp4');
            expect(result.requestedBy).toBe('DJUser');
        }
    });

    it('uses "Unknown" when no requester is present', () => {
        const line = `${prefix}Started video load for URL: https://example.com/video.mp4`;
        const result = parseLogLine(line);

        if (result?.type === 'video-play') {
            expect(result.requestedBy).toBe('Unknown');
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — notification
// ---------------------------------------------------------------------------
describe('parseLogLine — notification', () => {
    it('parses a received notification line', () => {
        const notId = 'not_aaaabbbb-cccc-dddd-eeee-ffffaaaabbbb';
        const senderId = 'usr_11112222-3333-4444-5555-666677778888';
        const line = [
            prefix,
            `Received Notification: <Notification from username:SenderUser,`,
            ` sender user id:${senderId}, to receiver:SomeUser,`,
            ` type: friendRequest, id: ${notId},`,
            ` created at: 01/01/2024 00:00:00 UTC, details: {}, message: "Hello!"`,
            ` to usr_receiverrrr-xxxx-yyyy-zzzz-aaaaaaaaaaaa>`,
        ].join('');
        const result = parseLogLine(line);

        expect(result?.type).toBe('notification');
        if (result?.type === 'notification') {
            expect(result.senderUsername).toBe('SenderUser');
            expect(result.senderUserId).toBe(senderId);
            expect(result.notificationType).toBe('friendRequest');
            expect(result.notificationId).toBe(notId);
            expect(result.message).toBe('Hello!');
        }
    });
});

// ---------------------------------------------------------------------------
// parseLogLine — sticker-spawn
// ---------------------------------------------------------------------------
describe('parseLogLine — sticker-spawn', () => {
    it('parses a sticker spawn line', () => {
        const userId = 'usr_aaaabbbb-cccc-dddd-eeee-ffffffffffff';
        const stickerId = 'inv_00001111-2222-3333-4444-555566667777';
        const line = `${prefix}[StickersManager] User ${userId} (FunUser) spawned sticker ${stickerId}`;
        const result = parseLogLine(line);

        expect(result?.type).toBe('sticker-spawn');
        if (result?.type === 'sticker-spawn') {
            expect(result.userId).toBe(userId);
            expect(result.displayName).toBe('FunUser');
            expect(result.stickerId).toBe(stickerId);
        }
    });
});

// ---------------------------------------------------------------------------
// checkForInstanceMatch
// ---------------------------------------------------------------------------
describe('checkForInstanceMatch', () => {
    const worldId = 'wrld_abcdef12-3456-7890-abcd-ef1234567890';
    const instanceId = `${worldId}:99999~private(usr_owner)~nonce(xyz)`;

    it('matches when the log line contains the target instance base ID', () => {
        const line = `${prefix}Joining ${instanceId}`;
        const result = checkForInstanceMatch(line, instanceId);
        expect(result.match).toBe(true);
    });

    it('does not match a different world', () => {
        const line = `${prefix}Joining wrld_differentworld-0000:12345`;
        const result = checkForInstanceMatch(line, instanceId);
        expect(result.match).toBe(false);
    });

    it('falls back to a simple string match when no Joining pattern', () => {
        const line = `${prefix}Some other line mentioning ${worldId}:99999`;
        const result = checkForInstanceMatch(line, instanceId);
        expect(result.match).toBe(true);
    });
});
