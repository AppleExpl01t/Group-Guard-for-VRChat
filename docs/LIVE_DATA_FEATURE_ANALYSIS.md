# Live Client Data Integration - Feature Enhancement Analysis

## Overview

This document analyzes how VRChat log file watching (live client data) can enhance the existing features in Group Guard. We have two data sources:

1. **VRChat Pipeline (WebSocket)** - Real-time events FROM VRChat's servers (friend status, notifications, group events)
2. **VRChat Log Watcher (NEW)** - Live data FROM the VRChat client running locally (who's in your current instance)

These are **complementary** - the Pipeline tells us what's happening to _our account_, while the Log Watcher tells us what's happening _in-world around us_.

---

## Current Features Inventory

| Feature              | Location                  | Current Data Source |
| -------------------- | ------------------------- | ------------------- |
| **Dashboard**        | `DashboardView.tsx`       | API + Pipeline      |
| **Group Selection**  | `GroupSelectionView.tsx`  | API                 |
| **Member List**      | `MembersListDialog.tsx`   | API                 |
| **Join Requests**    | `RequestsListDialog.tsx`  | API                 |
| **Ban List**         | `BansListDialog.tsx`      | API                 |
| **Active Instances** | `InstancesListDialog.tsx` | API                 |
| **Audit Logs**       | `DashboardView.tsx`       | API                 |
| **User Profiles**    | `UserProfileDialog.tsx`   | API + Cache         |
| **Pipeline Events**  | `pipelineStore.ts`        | WebSocket           |

---

## Feature Enhancements with Live Client Data

### 1. 🎮 **Instance Monitoring (NEW FEATURE)**

**Current State**: Shows group instances from API (who's where, from VRChat's perspective)

**Enhancement**: Add "Your Current Instance" view showing everyone in _your_ instance in real-time

| Aspect            | API Instance Data          | Log Watcher Data           |
| ----------------- | -------------------------- | -------------------------- |
| **Players shown** | Members of your groups     | **EVERYONE** in your world |
| **Update speed**  | ~10 second poll            | **< 1 second**             |
| **Data included** | User ID only               | User ID + Display Name     |
| **Availability**  | When group instance exists | **Always** (any world)     |

**New Capabilities**:

- See ALL players in your current instance (not just group members)
- Real-time join/leave feed with timestamps
- Know exactly when someone enters/leaves

---

### 2. 👥 **Enhanced Member Tracking**

**Current State**: `groupStore.ts` tracks group members from API

**Enhancement**: Cross-reference in-world players with group membership

| Feature                    | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| **In-World Group Members** | Highlight players who are in your group               |
| **Encounter Logging**      | Track when/where you encountered group members        |
| **"Last Seen"**            | Record when group members were last in-world with you |
| **Activity Patterns**      | Identify frequently co-located group members          |

**Use Case**: "Which group members do I actually play with?"

---

### 3. 🛡️ **Real-time Moderation Alerts**

**Current State**: Audit logs show past moderation actions via API

**Enhancement**: Alert when a _known problematic user_ joins your instance

| Alert Type                | Trigger                                           |
| ------------------------- | ------------------------------------------------- |
| **Banned User Alert**     | Someone on your group's ban list joins your world |
| **Watchlist Alert**       | Someone on a custom watchlist joins               |
| **Repeat Offender Alert** | User with multiple warns/kicks in audit log joins |

**Implementation**:

```typescript
// When player joins via log watcher
const isOnBanList = bans.some((ban) => ban.userId === joinedPlayer.userId);
if (isOnBanList) {
  showNotification("⚠️ Banned user joined your instance!");
}
```

---

### 4. 📊 **Dashboard Enhancements**

**Current Dashboard Tiles**:

- Member Count (API)
- Active Instances (API)
- Pending Requests (API)
- Active Bans (API)

**NEW Tiles with Log Watcher**:

| New Tile                 | Description                           |
| ------------------------ | ------------------------------------- |
| **Your Current World**   | Name of world you're in               |
| **Players in Instance**  | Live count of people around you       |
| **Group Members Nearby** | How many group members are with you   |
| **Session Duration**     | How long you've been in this instance |

---

### 5. 📜 **Enhanced Audit Experience**

**Current State**: Shows audit logs from VRChat API

**Enhancement**: Correlate audit events with in-world context

| Enhancement           | Description                                   |
| --------------------- | --------------------------------------------- |
| **"Were You There?"** | Mark audit events where you were in-world     |
| **Witness Logging**   | "I saw [user] doing [thing] before this kick" |
| **Context Notes**     | Add notes about what you observed in-world    |

---

### 6. 👤 **User Profile Enrichment**

**Current State**: `UserProfileDialog.tsx` shows API data

**Enhancement**: Add encounter history

| New Section             | Data                                            |
| ----------------------- | ----------------------------------------------- |
| **Recent Encounters**   | "Last seen in-world: 2 hours ago in Cool World" |
| **Total Time Together** | Aggregate time spent in same instances          |
| **Common Worlds**       | Worlds where you frequently encounter this user |
| **Avatar History**      | Avatars they've worn when you've seen them      |

---

### 7. 🔔 **Notification System (NEW FEATURE)**

Log watcher enables new notification types:

| Notification            | Trigger                                   | Use Case                  |
| ----------------------- | ----------------------------------------- | ------------------------- |
| **Friend Joined**       | Friend (from VRChat) enters your instance | Know when friends arrive  |
| **Group Member Joined** | Group member enters your instance         | Identify who's around you |
| **Watchlist Alert**     | Custom-watched user joins                 | Safety/moderation         |
| **Avatar Alert**        | Detect specific problematic avatars       | Crasher detection         |

---

### 8. 📱 **Instance Details Enhancement**

**Current State**: `InstancesListDialog.tsx` shows group instances

**Enhancement**: Add "Your Instance" context

```
┌─────────────────────────────────────────────┐
│  📍 YOUR CURRENT INSTANCE                   │
│  Cool World: 12345 (US West)                │
│  👥 12 Players | 🟢 3 Group Members         │
│  ⏱️ Session: 45 minutes                     │
│  [View Players] [Copy Instance ID]          │
└─────────────────────────────────────────────┘
```

---

### 9. 🎭 **Avatar Tracking**

Log watcher captures avatar switch events:

| Feature                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| **Avatar History per User**     | "CoolUser has worn: Avatar1, Avatar2, Avatar3" |
| **Avatar Analytics**            | Most popular avatars in instances you join     |
| **Suspicious Avatar Detection** | Flag known crasher/malicious avatar names      |

---

### 10. 📈 **Activity Analytics (NEW FEATURE)**

Long-term data collection enables:

| Metric              | Description                                   |
| ------------------- | --------------------------------------------- |
| **Worlds Visited**  | History of all worlds you've been to          |
| **Peak Play Times** | When you're most active                       |
| **Social Graph**    | Most frequently co-located players            |
| **Session Stats**   | Average session length, instances per session |

### 11. 🤖 **High-Level Automation (NEW FEATURE)**

**"The Regulars" Auto-Invite**:

- **Logic**: If `EncounteredUser.instancesSeen > X` AND `userId` is not in group → Show "Invite Candidate" alert.
- **Config**: User customizable thresholds (e.g., "Seen in 5 different instances").
- **Action**: One-click invite or fully automatic invite sent via API.

**"Ghost" / Block Detection**:

- **Logic**: If Log Watcher sees `User A` but API `getInstanceUsers` does NOT → User A might be blocked/blocking.
- **Action**: Auto-kick (if mod) to resolve data asymmetry and remove "invisible" users.
- **Safety**: 30s grace period to allow API cache to catch up to real-time events.

---

### 12. 🎨 **Creative Concepts (Reference)**

ideas for future exploration:

**Crasher "Vaccine"**:

- Community-sourced list of known crash-inducing avatar IDs.
- Watch `avatar:switch` event → if ID matches bad list → Alert user to hide avatar immediately.

**"On Air" Mode**:

- Detect when specific "Host" users join the instance.
- Automatically update Group Status or Banner to announce the event is live.

**Music/OSC Integration**:

- Trigger local smart lights (Hue/WLED) based on in-game events (e.g., Red flash on ban detect).

---

### Data Flow

```
┌─────────────────┐
│  VRChat Client  │
│  (Game Running) │
└────────┬────────┘
         │ Log File
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Log Watcher   │      │  VRChat API     │
│   (Local File)  │      │  (Internet)     │
└────────┬────────┘      └────────┬────────┘
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────────┐
│             Electron Main Process           │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │LogWatcherService│  │ PipelineService  │  │
│  └────────┬────────┘  └────────┬─────────┘  │
└───────────┼─────────────────────┼───────────┘
            │ IPC Events          │
            ▼                     ▼
┌─────────────────────────────────────────────┐
│             React Frontend                  │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │InstanceMonitor  │  │  PipelineStore   │  │
│  │     Store       │  │                  │  │
│  └────────┬────────┘  └────────┬─────────┘  │
│           │                    │            │
│           ▼                    ▼            │
│  ┌─────────────────────────────────────┐    │
│  │      Combined UI Components         │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Store Integration

```typescript
// instanceMonitorStore.ts - NEW
interface InstanceMonitorState {
  // Current instance info
  currentInstance: InstanceInfo | null;

  // Players currently in your instance
  activePlayers: Map<string, PlayerInfo>;

  // Session history
  sessionLogs: LogEntry[];

  // Cross-reference with group data
  groupMembersNearby: string[]; // user IDs

  // Alerts
  banListAlerts: PlayerInfo[];
  watchlistAlerts: PlayerInfo[];
}

// Used by: Dashboard, InstanceMonitor, UserProfile
```

---

## Priority Matrix

| Feature                   | Impact | Effort | Priority |
| ------------------------- | ------ | ------ | -------- |
| Instance Monitor (core)   | 🔥🔥🔥 | Medium | **P0**   |
| Group Member Cross-ref    | 🔥🔥🔥 | Low    | **P0**   |
| Block/Ghost Detection     | 🔥🔥🔥 | Medium | **P0**   |
| Ban List Alerts           | 🔥🔥🔥 | Low    | **P1**   |
| 'Regulars' Auto-Invite    | 🔥🔥   | High   | **P1**   |
| Dashboard "Your Instance" | 🔥🔥   | Low    | **P1**   |
| User Profile Encounters   | 🔥🔥   | Medium | **P2**   |
| Notification System       | 🔥🔥   | Medium | **P2**   |
| Avatar History            | 🔥     | Medium | **P2**   |
| Activity Analytics        | 🔥     | High   | **P3**   |

---

## Summary

### Immediate Value (P0-P1)

1. **Know who's around you** - See everyone in your current instance
2. **Identify group members** - Instantly know if fellow group members are nearby
3. **Safety alerts** - Get warned when banned users join
4. **Enhanced dashboard** - Add "your current world" context

### Future Value (P2-P3)

1. **Encounter history** - Build relationship context over time
2. **Avatar tracking** - Know what avatars people use
3. **Analytics** - Understand your VRChat usage patterns

---

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Implement core LogWatcherService (Phase 1)
3. [ ] Add cross-reference with groupStore.members
4. [ ] Create Instance Monitor UI component
5. [ ] Add ban list alert system
6. [ ] Integrate with Dashboard tiles
