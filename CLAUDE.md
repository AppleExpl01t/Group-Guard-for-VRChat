# CLAUDE.md — Group Guard for VRChat

This file provides guidance for AI assistants (Claude and others) working in this repository. Read this before making any changes.

---

## Project Overview

**Group Guard** is a Windows desktop application that helps VRChat group owners and moderators manage their communities. It combines:

- Real-time monitoring of VRChat instances via the VRChat API and local log file parsing
- Automated moderation (AutoMod) with a rule engine for kicks/bans
- Social intelligence tracking (FriendshipService, location/time analytics)
- OSC chatbox integration and Discord webhook/RPC support
- A local SQLite database (via Prisma) for persistent audit and session logs

**Stack:** Electron v40 · React v19 · TypeScript (strict) · Vite · Zustand · Prisma/SQLite · Vitest

---

## Repository Structure

```
/
├── electron/               # Electron main process
│   ├── main.ts             # App entry point, window/service init
│   ├── preload.ts          # IPC contextBridge (exposes ~70 methods to renderer)
│   ├── controllers/        # IPC handler registration
│   └── services/           # 56+ singleton services (all business logic lives here)
│       └── __tests__/      # Service unit tests
├── src/                    # React renderer process
│   ├── App.tsx             # Root component, view routing
│   ├── main.tsx            # ReactDOM entry point
│   ├── config.ts           # App-wide constants
│   ├── components/         # Shared/reusable UI components
│   ├── features/           # 17 feature modules (see below)
│   ├── stores/             # Zustand stores (15 stores)
│   ├── hooks/              # Custom React hooks (14 hooks)
│   ├── types/              # Shared TypeScript type definitions
│   ├── utils/              # errorUtils, retry, caching, animation helpers
│   └── views/              # Standalone top-level page views
├── prisma/
│   ├── schema.prisma       # SQLite database schema
│   └── migrations/         # Prisma migration history
├── backend/                # Standalone Express.js cloud backend (separate process)
├── assets/                 # Static assets (sounds, icons)
├── public/                 # Vite public directory
├── scripts/                # One-off utility scripts
├── patches/                # patch-package patches for npm deps
├── .github/workflows/      # CI/CD: main.yml (alpha), release.yml (prod)
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json           # Project references root
├── tsconfig.app.json       # Frontend TypeScript config (strict)
├── tsconfig.node.json      # Node/Electron TypeScript config
└── eslint.config.js
```

### Feature Modules (`src/features/`)

| Folder | Purpose |
|---|---|
| `auth/` | VRChat login, 2FA, credential management |
| `automod/` | AutoMod rule configuration UI |
| `dashboard/` | Group overview and statistics |
| `live/` | Real-time instance monitoring and operations |
| `audit/` | Audit log viewer and filtering |
| `database/` | Local SQLite database browser |
| `instances/` | Instance guard (age-gating) and auto-close |
| `groups/` | Group selection and member management |
| `watchlist/` | User watchlist tracking |
| `integrations/` | OSC and Discord integrations |
| `notifications/` | Notification center |
| `reports/` | Reporting system |
| `admin/` | Admin analytics (feature-flagged) |
| `setup/` | Initial app configuration wizard |
| `settings/` | User preferences |
| `friendship/` | Social intelligence tracker |

---

## Development Workflows

### Prerequisites

- Node.js v20+ (CI uses v20)
- npm v8+
- Windows (Electron targets Windows; dev can run cross-platform)

### Common Commands

```bash
npm install          # Install all dependencies (runs patch-package postinstall)
npm run dev          # Start Vite dev server + Electron with hot reload
npm run dev:vite     # Vite only (port 5173)
npm run dev:electron # Electron only
npm run build        # Full production build (tsc + vite + esbuild)
npm run lint         # ESLint across entire codebase
npm test             # Run Vitest (all *.{test,spec}.{ts,tsx})
npm run preview      # Preview production build
```

### Build Pipeline

1. `tsc -b` — TypeScript type-check all projects
2. Vite builds React renderer → `dist/`
3. esbuild bundles `electron/main.ts` → `dist-electron/main.cjs`
4. esbuild bundles `electron/preload.ts` → `dist-electron/preload.cjs`
5. electron-builder creates Windows NSIS installer → `release/`

### Environment Variables

No `.env` file is required for local development. The app uses `electron-store` for runtime configuration. Sensitive keys (cloud backend, analytics) are loaded from the OS keychain or electron-store.

---

## Architecture & Key Conventions

### Process Separation (Critical)

Electron splits into two isolated processes:

| Process | Location | Responsibilities |
|---|---|---|
| **Main process** | `electron/` | All business logic, VRChat API calls, file I/O, database, services |
| **Renderer process** | `src/` | React UI only — no direct Node.js or VRChat SDK access |

Communication is **exclusively via IPC** through `electron/preload.ts`. The renderer calls `window.electron.methodName(args)` which maps to `ipcMain.handle('method-name', ...)` registered in controllers.

When adding a new capability:
1. Implement logic in a service under `electron/services/`
2. Register an IPC handler in `electron/controllers/`
3. Expose the method in `electron/preload.ts`
4. Call it from the renderer via `window.electron.*`

### Services Pattern

All business logic lives in singleton service classes under `electron/services/`. Key rules:
- Services are instantiated once at startup in `electron/main.ts`
- Services communicate with each other via direct imports or `ServiceEventBus`
- No business logic should exist in controllers — controllers only wire IPC to services
- No `any` types allowed in service code (enforced by ESLint + strict TypeScript)

Key services to understand before making changes:

| Service | Role |
|---|---|
| `AuthService` | VRChat OAuth, session management, 2FA |
| `VRChatApiService` | Typed SDK wrapper (all API calls go through here) |
| `AutoModService` | Core rule evaluation engine (kick/ban automation) |
| `PipelineService` | VRChat WebSocket real-time events |
| `LogWatcherService` | Monitors VRChat `output_log.txt` for live events |
| `DatabaseService` | Prisma client wrapper |
| `StorageService` | electron-store wrapper |
| `ServiceEventBus` | Pub/sub bus for inter-service events |

### State Management

- **Zustand stores** (`src/stores/`) manage all React UI state
- **electron-store** (via `StorageService`) persists settings across restarts
- **Prisma/SQLite** stores audit logs, sessions, AutoMod history, scanned users
- Stores subscribe to IPC events from the main process for real-time updates

### TypeScript Conventions

- **Strict mode is on** — no implicit `any`, no unused variables
- No `any` types in services (linting enforced)
- Use explicit type imports: `import type { Foo } from './types'`
- Type definitions shared between processes go in `src/types/`

### React Conventions

- Functional components only (no class components)
- Heavy views are lazy-loaded with `React.lazy()`
- Use `useMemo` for expensive computations, `useCallback` for stable handlers
- Custom hooks are prefixed `use` and live in `src/hooks/`
- Global modals use the `ConfirmationContext`

### File Naming

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase | `LoginView.tsx` |
| Electron services | PascalCase + `Service` | `AuthService.ts` |
| Zustand stores | camelCase + `Store` | `authStore.ts` |
| React hooks | camelCase + `use` prefix | `usePipelineInit.ts` |
| Utilities | camelCase | `errorUtils.ts` |
| Tests | Same name + `.test.ts` | `AuthService.test.ts` |

### Styling

- Tailwind CSS utility classes
- Neon theme system with presets (Dark, Light, Midnight, Sunset)
- Framer Motion for animations
- Glass effects via `backdrop-blur` and opacity utilities
- Recharts for data visualization

### Error Handling

- Use `src/utils/errorUtils.ts` for consistent error formatting
- Use `src/utils/retry.ts` for retry logic with exponential backoff
- Log via `electron-log` (not `console.log`) in the main process
- Logs persist to `%APPDATA%\vrchat-group-guard\logs`

### Performance Patterns

- VRChat API calls use LRU caching + file-based keyv storage
- Bulk user fetches are batched in groups of 10 with 250ms delays to avoid rate limits
- Components that process large lists use virtualization where needed
- `useUserBatchFetcher` hook handles rate-limited batch profile fetches

---

## Database (Prisma/SQLite)

Schema: `prisma/schema.prisma`

| Model | Purpose |
|---|---|
| `Session` | Game session tracking (worldId, instanceId, groupId, timestamps) |
| `LogEntry` | Individual log events linked to a Session |
| `AutoModLog` | Moderation action history (action, reason, module) |
| `ScannedUser` | Player database (displayName, rank, thumbnail, encounterCount) |
| `FriendStats` | Friend analytics (timeSpent, encounterCount, lastSeen) |

After changing `schema.prisma`, run:
```bash
npx prisma migrate dev --name <description>
npx prisma generate
```

---

## Testing

**Framework:** Vitest v4 with jsdom
**Test files:** `**/*.{test,spec}.{ts,tsx}`

### Running tests

```bash
npm test                 # Run all tests once
npm test -- --run        # Explicit single-run (used in CI)
npm run test:watch       # Watch mode during development
npm test -- --coverage   # With coverage report (output → coverage/)
```

### Test file locations

| Service | Test file |
|---|---|
| `AuthService` | `electron/services/__tests__/AuthService.test.ts` |
| `GroupAuthorizationService` | `electron/services/GroupAuthorizationService.test.ts` |
| `LogParserService` | `electron/services/__tests__/LogParserService.test.ts` |
| `AutoModRuleService` | `electron/services/__tests__/AutoModRuleService.test.ts` |
| `WatchlistService` | `electron/services/__tests__/WatchlistService.test.ts` |
| `InstanceGuardService` | `electron/services/__tests__/InstanceGuardService.test.ts` |

### Mocking conventions

All tests that target Electron services must mock these modules before importing the service:

```typescript
// Always mock these in service tests
vi.mock('electron-log', ...)        // Prevents log output noise
vi.mock('electron', ...)            // Mocks ipcMain.handle
vi.mock('electron-store', ...)      // In-memory store (use a Map or object)
vi.mock('../WindowService', ...)    // Prevents broadcast calls
vi.mock('../DatabaseService', ...)  // Prevents Prisma calls
```

**Mock order matters.** Declare all `vi.mock()` calls before any `import` of the service under test. Vitest hoists mocks, but explicit ordering avoids subtle issues.

### What to test in each service category

**Pure/stateless services** (e.g., `LogParserService`): Test every event type, edge cases (empty input, malformed lines), and every exported helper function. No mocks needed.

**Rule engine services** (e.g., `AutoModRuleService`): Test each rule type (KEYWORD_BLOCK, TRUST_CHECK, BLACKLISTED_GROUPS) with at least: a match case, a non-match case, a whitelist exemption case, and all supported action types.

**Storage services** (e.g., `WatchlistService`): Test create, read, update, delete for each entity type. Test merge behaviour (update preserves `createdAt`). Test import/export round-trip.

**Orchestration services** (e.g., `InstanceGuardService`, `AutoModService`): Test guard conditions (empty groups, API failure), happy-path enforcement, whitelist/blacklist logic, and duplicate-prevention cache.

### Standards enforced by CI

The CI workflow (`.github/workflows/ci.yml`) runs on every push and pull request:

1. **Type-check** (`npx tsc -b --noEmit`) — no TypeScript errors allowed
2. **Lint** (`npm run lint`) — no ESLint errors allowed
3. **Tests** (`npm test -- --run`) — all tests must pass

**A pull request cannot be merged if any of these checks fail.**

When adding new service logic, add corresponding unit tests. The CI check is the enforcement mechanism — there is no manual review bypass.

---

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `.github/workflows/main.yml` | Manual dispatch | Alpha release (Windows, no auto-update) |
| `.github/workflows/release.yml` | Tag push `v*` or manual | Production release with auto-updater |
| `.github/workflows/dependabot.yml` | Scheduled | Automated dependency PRs |

Both release workflows:
1. Checkout → Node.js 20 setup → `npm ci` → build → electron-builder package → GitHub Release

**Alpha releases** remove `latest.yml` to prevent auto-update. **Production releases** publish `latest.yml` for electron-updater.

---

## Contributing Checklist

Before submitting a pull request, verify locally:

- [ ] `npx tsc -b --noEmit` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint errors
- [ ] `npm test -- --run` — all tests pass
- [ ] No `any` types added in `electron/services/`
- [ ] New IPC methods are added to both `electron/preload.ts` and the relevant controller
- [ ] Database schema changes have a corresponding Prisma migration
- [ ] New service logic has unit tests in `electron/services/__tests__/`
- [ ] Feature branch created (`git checkout -b feature/your-feature`)

The CI workflow (`.github/workflows/ci.yml`) enforces type-check, lint, and tests automatically on every PR. All three must be green before merging.

---

## Backend (`/backend`)

A separate Express.js Node.js server for cloud features (analytics heartbeat, opt-in cloud sync). It runs as an independent process and is **not bundled with the Electron app**. It uses OCI SDK for cloud storage. Changes here require separate deployment.

---

## Security Notes

- The app interacts with VRChat only via the official VRChat SDK (API calls + log file reading). No memory injection or process manipulation.
- User credentials are stored encrypted via electron-store
- The renderer process has no direct Node.js access — all sensitive operations go through the IPC bridge
- No `.env` files are committed; secrets live in OS keychain / electron-store
- The `SENSITIVE/` folder is gitignored

---

## Useful File Locations

| What | Where |
|---|---|
| React root component | `src/App.tsx` |
| Electron entry point | `electron/main.ts` |
| IPC bridge | `electron/preload.ts` |
| All services | `electron/services/` |
| Zustand stores | `src/stores/` |
| Database schema | `prisma/schema.prisma` |
| Vite config | `vite.config.ts` |
| Vitest config | `vitest.config.ts` |
| ESLint config | `eslint.config.js` |
| TypeScript (frontend) | `tsconfig.app.json` |
| App constants | `src/config.ts` |
| Error utilities | `src/utils/errorUtils.ts` |
| Retry utilities | `src/utils/retry.ts` |
