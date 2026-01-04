# FCH Log Watcher Technical Reference

> Quick reference for implementing VRChat log file watching based on FCH Toolkit analysis.

---

## VRChat Log File Location

```typescript
// Windows
const getLogDir = () => {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  // LOCALAPPDATA is C:\Users\<user>\AppData\Local
  // LocalLow is C:\Users\<user>\AppData\LocalLow
  const localLow = path.join(path.dirname(localAppData), "LocalLow");
  return path.join(localLow, "VRChat", "VRChat");
};
// Result: C:\Users\<user>\AppData\LocalLow\VRChat\VRChat
```

## Log File Pattern

Files are named: `output_log_<timestamp>.txt`

- Example: `output_log_2026-01-03_15-30-45.txt`
- Select the **most recently modified** file

## Regex Patterns (Verified from FCH)

### Timestamp Extraction

```typescript
const RE_TIMESTAMP = /^(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})/;
// Matches: "2026.01.03 15:30:45"
```

### Player Join

```typescript
const RE_PLAYER_JOIN =
  /OnPlayerJoined\s+(?:\[[^\]]+\]\s*)?([^\r\n(]+?)\s*\((usr_[a-f0-9\-]{36})\)/;
// Captures: [1] = username, [2] = userId
// Example: "OnPlayerJoined [Group] CoolUser (usr_12345678-1234-1234-1234-123456789abc)"
```

### Player Left

```typescript
const RE_PLAYER_LEFT = /OnPlayerLeft\s+([^\r\n(]+?)\s*\((usr_[a-f0-9\-]{36})\)/;
// Captures: [1] = username, [2] = userId
// Example: "OnPlayerLeft CoolUser (usr_12345678-1234-1234-1234-123456789abc)"
```

### Player Destroyed (Fallback for leaves)

```typescript
const RE_DESTROYING = /Destroying\s+([^\r\n]+)/;
// Captures: [1] = username (no userId)
// Used when normal leave isn't logged
```

### Joining World/Instance

```typescript
const RE_JOINING =
  /Joining\s+(wrld_[a-f0-9\-]{36}):([^~\s]+)(?:~region\(([^)]+)\))?/;
// Captures: [1] = worldId, [2] = instanceId, [3] = region (optional)
// Example: "Joining wrld_12345678-1234-1234-1234-123456789abc:12345~region(us)"
```

### Avatar Switch

```typescript
const RE_AVATAR_SWITCH =
  /\[Behaviour\]\s+Switching\s+(.+?)\s+to\s+avatar\s+(.+)/;
// Captures: [1] = username, [2] = avatarName
// Example: "[Behaviour] Switching CoolUser to avatar MyAvatar"
```

### Session End Markers (Purge Triggers)

```typescript
const RE_LEFT_ROOM = /Successfully left room/;
const RE_STOPPING_SERVER = /VRCNP: Stopping server/;
const RE_JOINED_ROOM = /Successfully joined room/; // Also marks new session start
const RE_APP_QUIT = /VRCApplication:\s*HandleApplicationQuit/;
```

### User Authentication (Detect logged-in VRChat user)

```typescript
const RE_USER_AUTH = /User Authenticated:\s*(.+)/;
// Captures: [1] = " - Username - (usr_...)"
// Example: "User Authenticated: - CoolUser - (usr_12345678-1234-1234-1234-123456789abc)"
```

---

## Events to Emit

| Backend Event                | Frontend Handler   | Payload                                      |
| ---------------------------- | ------------------ | -------------------------------------------- | --------- | ---------- |
| `logwatcher:ready`           | `onReady`          | `{ hasActiveSession: boolean }`              |
| `logwatcher:player-join`     | `onPlayerJoin`     | `{ userId, username, timestamp }`            |
| `logwatcher:player-leave`    | `onPlayerLeave`    | `{ userId, username, timestamp }`            |
| `logwatcher:instance-change` | `onInstanceChange` | `{ worldId, instanceId, region, timestamp }` |
| `logwatcher:avatar-switch`   | `onAvatarSwitch`   | `{ username, avatarName, timestamp }`        |
| `logwatcher:session-purge`   | `onSessionPurge`   | `{ timestamp, reason }`                      |
| `logwatcher:status`          | `onStatusChange`   | `{ status: 'running'                         | 'stopped' | 'error' }` |

---

## Tailing Algorithm

```typescript
class LogTailer {
  private lastOffset = 0;
  private pendingLine = "";
  private pollInterval = 750; // ms

  async poll() {
    const stats = await fs.stat(this.logPath);
    const size = stats.size;

    // Handle truncation (new session)
    if (size < this.lastOffset) {
      this.lastOffset = 0;
      this.pendingLine = "";
      this.emit("session-reset");
    }

    // No new data
    if (size <= this.lastOffset) return;

    // Read new bytes
    const stream = fs.createReadStream(this.logPath, {
      start: this.lastOffset,
      end: size - 1,
      encoding: "utf8",
    });

    let buffer = "";
    for await (const chunk of stream) {
      buffer += chunk;
    }

    // Combine with pending partial line
    buffer = this.pendingLine + buffer;

    // Find complete lines
    const lastNewline = buffer.lastIndexOf("\n");
    if (lastNewline === -1) {
      this.pendingLine = buffer;
      return;
    }

    // Process complete lines
    const completeLines = buffer.substring(0, lastNewline);
    this.pendingLine = buffer.substring(lastNewline + 1);

    for (const line of completeLines.split("\n")) {
      this.parseLine(line.trimEnd());
    }

    this.lastOffset = size;
  }
}
```

---

## Backfill on Startup

```typescript
async backfill() {
  const SCAN_SIZE = 4 * 1024 * 1024; // 4MB tail

  const stats = await fs.stat(this.logPath);
  const start = Math.max(0, stats.size - SCAN_SIZE);

  const content = await this.readRange(start, stats.size);
  let lines = content.split('\n');

  // Skip partial first line if we started mid-file
  if (start > 0) {
    lines = lines.slice(1);
  }

  // Find anchor: last "Joining" or "Successfully joined room"
  let anchorIdx = -1;
  let anchorIsJoining = false;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (RE_JOINING.test(line)) {
      anchorIdx = i;
      anchorIsJoining = true;
      break;
    }
    if (RE_JOINED_ROOM.test(line)) {
      anchorIdx = i;
      anchorIsJoining = false;
      break;
    }
  }

  if (anchorIdx === -1) {
    this.emit('ready', { hasActiveSession: false });
    return;
  }

  // Check for purge markers after anchor
  for (let i = anchorIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (RE_LEFT_ROOM.test(line) ||
        RE_STOPPING_SERVER.test(line) ||
        RE_APP_QUIT.test(line) ||
        (RE_JOINED_ROOM.test(line) && i !== anchorIdx)) {
      // Session ended after anchor, no active session
      this.emit('ready', { hasActiveSession: false });
      return;
    }
  }

  // Extract instance info from anchor if it was a join
  if (anchorIsJoining) {
    const match = lines[anchorIdx].match(RE_JOINING);
    if (match) {
      this.currentInstance = {
        worldId: match[1],
        instanceId: match[2],
        region: match[3] || null
      };
    }
  }

  // Replay joins/leaves after anchor to reconstruct active players
  const players = new Map();
  for (let i = anchorIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const timestamp = this.extractTimestamp(line);

    const joinMatch = line.match(RE_PLAYER_JOIN);
    if (joinMatch) {
      players.set(joinMatch[2], {
        userId: joinMatch[2],
        username: joinMatch[1].trim(),
        joinedAt: timestamp
      });
      continue;
    }

    const leftMatch = line.match(RE_PLAYER_LEFT);
    if (leftMatch) {
      players.delete(leftMatch[2]);
    }
  }

  this.activePlayers = players;
  this.emit('ready', {
    hasActiveSession: true,
    playerCount: players.size,
    instance: this.currentInstance
  });
}
```

---

## Log Rotation Detection

```typescript
// Check every 60 seconds
async checkRotation() {
  const latestLog = await this.findLatestLogFile();

  if (latestLog !== this.currentLogPath) {
    // New log file detected
    const oldPath = this.currentLogPath;
    this.currentLogPath = latestLog;
    this.lastOffset = 0;
    this.pendingLine = '';

    // Purge active players (session ended)
    this.emit('session-purge', {
      reason: 'log-rotation',
      oldFile: path.basename(oldPath),
      newFile: path.basename(latestLog)
    });

    // Seek to end, only process new lines
    const stats = await fs.stat(latestLog);
    this.lastOffset = stats.size;
  }
}

async findLatestLogFile(): Promise<string | null> {
  const files = await fs.readdir(this.logDir);

  const logFiles = files
    .filter(f => f.startsWith('output_log_') && f.endsWith('.txt'))
    .map(f => ({
      name: f,
      path: path.join(this.logDir, f),
      mtime: fs.statSync(path.join(this.logDir, f)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return logFiles[0]?.path || null;
}
```

---

## Error Handling

| Scenario                | Handling                               |
| ----------------------- | -------------------------------------- |
| Log directory not found | Emit error, retry every 30s            |
| No log files present    | Emit status "waiting", check every 10s |
| File permission denied  | Emit error with message                |
| File read error         | Log error, continue polling            |
| Malformed timestamp     | Skip line, continue                    |
| Regex match failure     | Skip line, continue                    |

---

## Performance Considerations

1. **Poll Interval**: 750ms balance between responsiveness and CPU
2. **Buffer Size**: 64KB chunks for file reading
3. **Line Processing**: Process synchronously in batches
4. **Memory**: Keep max 1000 log entries in memory
5. **Backfill Limit**: Max 4MB scan on startup

---

## VRChat Requirements (User Setup)

Users must enable in VRChat Settings:

1. **Debug Logging** → Set to **"Full"**
2. (Optional) Steam launch option: `--enable-sdk-log-levels` for avatar analysis logs
