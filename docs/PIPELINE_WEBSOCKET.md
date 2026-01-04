# VRChat Pipeline WebSocket Integration

## Overview

This document describes the WebSocket (Pipeline) integration for real-time events from VRChat.

**Verified strategy against VRCX Reference Repo** (`reference repos/VRCX/src/service/websocket.js`).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  Stores (Zustand)                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ authStore   │ │ groupStore  │ │ pipelineStore│               │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│         │               ▲               ▲                        │
│         │               │    Events     │                        │
│         ▼               └───────────────┘                        │
│  ┌──────────────────────────────────────────────┐                │
│  │         usePipelineInit() Hook               │                │
│  │   - Manages connection lifecycle             │                 │
│  │   - Routes events to appropriate stores      │                │
│  └──────────────────────────────────────────────┘                │
│                              ▲                                   │
│                   IPC Events │                                   │
└──────────────────────────────┴──────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS (Electron)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  PipelineService.ts                          ││
│  │  - WebSocket connection to wss://pipeline.vrchat.cloud       ││
│  │  - Auto-reconnect with exponential backoff                   ││
│  │  - Message parsing & event emission                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              ▲                                   │
│                   Auth Token │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              AuthService.ts                                  ││
│  │  - onUserLoggedIn() → connects Pipeline                     ││
│  │  - onUserLoggedOut() → disconnects Pipeline                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Supported Events (from VRChat API)

### Events Handled via Pipeline (Real-time):

| Event Type             | Description                     | Store Handler                    |
| ---------------------- | ------------------------------- | -------------------------------- |
| `group-member-updated` | User's group membership changed | `groupStore.handlePipelineEvent` |
| `group-role-updated`   | Group role permissions changed  | `groupStore.handlePipelineEvent` |
| `group-joined`         | User joined a group             | `groupStore.handlePipelineEvent` |
| `group-left`           | User left a group               | `groupStore.handlePipelineEvent` |
| `notification`         | Invites, friend requests        | (Future: notificationStore)      |
| `notification-v2`      | Enhanced notifications          | (Future: notificationStore)      |
| `friend-online`        | Friend came online              | (Future: friendStore)            |
| `friend-offline`       | Friend went offline             | (Future: friendStore)            |
| `friend-location`      | Friend changed location         | (Future: friendStore)            |
| `user-update`          | Current user profile changed    | (Future: authStore)              |

### Features That MUST Remain API-Based:

| Feature                    | Reason                           |
| -------------------------- | -------------------------------- |
| **Audit Logs**             | No WebSocket event exists        |
| **Initial Data Fetch**     | WebSocket only sends deltas      |
| **Join Request List**      | No WebSocket event               |
| **Ban List**               | No WebSocket event               |
| **Member Full List**       | No WebSocket event               |
| **Instance List**          | No WebSocket event               |
| **All Moderation Actions** | POST/PUT/DELETE require REST API |

---

## File Structure

```
electron/
├── services/
│   ├── PipelineService.ts      # Main WebSocket service
│   └── AuthService.ts          # Login/logout triggers pipeline
│
├── preload.ts                  # IPC bridge with pipeline methods

src/
├── stores/
│   ├── pipelineStore.ts        # Connection state & event routing
│   └── groupStore.ts           # Handles group-related events
│
├── hooks/
│   └── usePipelineInit.ts      # React hook for initialization
│
├── components/ui/
│   └── PipelineStatus.tsx      # Visual connection indicator
│
└── types/
    └── electron.d.ts           # TypeScript definitions
```

---

## Usage

### Automatic Connection

The Pipeline connects automatically when the user logs in:

```typescript
// In AuthService.ts - called after successful login
import { onUserLoggedIn } from "./PipelineService";
onUserLoggedIn();
```

### React Integration

Add `usePipelineInit()` to your root App component:

```tsx
import { usePipelineInit } from "./hooks/usePipelineInit";

function App() {
  usePipelineInit(); // Handles connection & event subscriptions
  // ...
}
```

### Subscribing to Events

In any store or component:

```typescript
import { usePipelineStore } from "./stores/pipelineStore";

// Subscribe to specific event type
const unsubscribe = usePipelineStore
  .getState()
  .subscribe("group-member-updated", (event) => {
    console.log("Member updated:", event.content);
  });

// Subscribe to all events
const unsubAll = usePipelineStore.getState().subscribe("*", (event) => {
  console.log("Any event:", event.type);
});

// Clean up when done
unsubscribe();
```

### Checking Connection Status

```tsx
import { usePipelineStatus } from "./hooks/usePipelineInit";

function StatusWidget() {
  const { connected, connecting, error } = usePipelineStatus();

  return (
    <div>
      {connected ? "🟢 Live" : connecting ? "🟡 Connecting..." : "⚪ Offline"}
    </div>
  );
}
```

### Visual Status Indicator

```tsx
import { PipelineStatus } from "./components/ui/PipelineStatus";

<PipelineStatus showText={true} size="sm" />;
```

---

## API Reference

### PipelineService (Main Process)

| Function                  | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `setupPipelineHandlers()` | Registers IPC handlers (call once at startup)  |
| `onUserLoggedIn()`        | Connects to Pipeline (call after auth success) |
| `onUserLoggedOut()`       | Disconnects from Pipeline (call on logout)     |

### Preload API

```typescript
window.electron.pipeline.connect(); // → { success, connected }
window.electron.pipeline.disconnect(); // → { success }
window.electron.pipeline.status(); // → { connected, connecting, reconnectAttempts }
window.electron.pipeline.reconnect(); // → { success }

// Event listeners (return unsubscribe function)
window.electron.pipeline.onEvent(callback);
window.electron.pipeline.onConnected(callback);
window.electron.pipeline.onDisconnected(callback);
window.electron.pipeline.onError(callback);
```

### pipelineStore

| Property/Method             | Description                            |
| --------------------------- | -------------------------------------- |
| `connected`                 | Boolean - is WebSocket connected       |
| `connecting`                | Boolean - connection in progress       |
| `error`                     | String or null - last error message    |
| `recentEvents`              | Array - last N events received         |
| `subscribe(type, callback)` | Subscribe to events by type            |
| `handleEvent(event)`        | Process incoming event                 |
| `initializeListeners()`     | Set up IPC listeners (returns cleanup) |

---

## Connection Flow

1. **User logs in** → `AuthService` calls `onUserLoggedIn()`
2. **PipelineService** fetches auth token from VRChat SDK
3. **WebSocket connects** to `wss://pipeline.vrchat.cloud`
4. **Events flow** to renderer via IPC
5. **pipelineStore** routes to subscribed handlers
6. **Stores update** and UI re-renders

### Reconnection

- On disconnect, auto-reconnects with exponential backoff
- Max 10 attempts (5s, 10s, 15s, 20s, 25s...)
- On logout, stops reconnection attempts

---

## Notes

- WebSocket is **receive-only** (per VRChat API docs)
- All moderation actions still use REST API
- Audit logs have **no WebSocket events** - polling required
- Connection requires valid auth cookie from VRChat
