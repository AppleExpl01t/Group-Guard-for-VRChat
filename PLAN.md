# VRChat Group Guard - Implementation Plan

## 1. Project Overview

"VRChat Group Guard" is a comprehensive desktop application designed for VRChat group owners and moderators. It aims to be the ultimate tool for group control, moderation, auditing, and activity logging, featuring a stunning, customizable UI and a robust database.

## 2. Technology Stack (Modern 2026 Standard)

To ensure code cleanliness, expandability, and performance:

- **Core Runtime**: **Electron** (Latest) - For cross-platform desktop capabilities.
- **Language**: **TypeScript** - Enforced strict mode for type safety and maintainability.
- **Frontend Framework**: **React 19** (or latest) with **Vite** - For high-performance UI rendering.
- **Styling**: **Vanilla CSS (CSS Modules)** with **CSS Variables**.
  - _Why_: Maximum control over the "jaw-dropping" aesthetic and performance.
  - _Theming_: A global CSS variable system controlled by React state for real-time user customization (colors, blur strength, border radius).
  - _Animations_: **Framer Motion** for complex, fluid layout animations.
- **Database**: **SQLite** with **Prisma ORM**.
  - _Why_: Prisma provides a type-safe, "beautifully organized" way to interact with the database. SQLite is local, fast, and sufficient for a desktop app.
  - _Migrations_: Built-in schema management to handle app evolution.
- **State Management**: **Zustand**.
  - _Why_: Minimalistic, clean, and avoids the boilerplate of Redux.
- **API Client**: **TanStack Query** (React Query) + Custom VRChat API Wrapper.
  - _Why_: Handles caching, polling, and synchronization with VRChat servers seamlessly.
- **Logging**: **Electron-Log** + Custom Error Boundary.
  - _Why_: Filesystem logging for debugging and a UI overlay for immediate error feedback.

## 3. Architecture & Data Flow

### The "Beautifully Organized Database"

The database will be the source of truth for local logs.

- **Entities**: `User`, `Group`, `ModerationAction`, `AuditLog`, `Note`, `ThemePreset`.
- **Syncing**: The app will fetch data from VRChat API and mirror relevant parts (like member lists) to the local DB for faster searching/sorting.

### Modular Design

- **`src/main`**: Electron main process (OS interactions, window management).
- **`src/renderer`**: UI code.
  - `components/`: Reusable distinct UI elements (Buttons, Cards, Inputs).
  - `features/`: Feature-specific logic (GroupModeration, UserAudit).
  - `layouts/`: Page structures.
  - `styles/`: Global theme definitions.
- **`src/shared`**: Shared types and constants.
- **`src/services`**: Database logic, VRChat API wrapper, Logging service.

## 4. UI/UX Design Philosophy

- **Aesthetic**: "Premium Glassmorphism" / "Cyberpunk Luxury".
  - Deep, rich backgrounds with blurred overlays.
  - Subtle glowing borders and shadows.
  - Smooth transitions between states.
- **Customization**:
  - Users can pick primary/secondary colors, background images/videos, and UI density.
  - Theme presets (e.g., "Dark Neon", "Clean Glass", "OLED Pitch Black").
- **Organization**:
  - **Sidebar Navigation**: Iconic, collapsible.
  - **Datagrid Views**: High-density but legible lists for logs and users, with advanced filtering/search.
  - **Context Menus**: Right-click actions for quick moderation.

## 5. Core Features Roadmap

### Phase 1: Foundation

1.  Setup project with TypeScript, Electron, Vite, Prisma.
2.  Implement the "Theme Engine" (CSS Variables + React Context).
3.  Establish the Logging/Error Handling system.
4.  Build the VRChat Authentication flow (2FA support).

### Phase 2: The Dashboard & Database

1.  Design the "Home" dashboard (Overview stats).
2.  Implement the "Data Explorer" (The generic database viewer requested).
3.  Connect VRChat "Groups" API to fetch and store group details.

### Phase 3: Core Features (Moderation & Audit)

- [ ] **Data Integration**
  - [x] **Groups Service**: Fetch joined groups (`GET /groups?member=true`).
  - [x] **Audit Service**: Fetch logs (`GET /groups/{groupId}/auditLogs`).
  - [ ] **Instance Service**: Fetch active group instances (`GET /groups/{groupId}/instances`).
- [ ] **Moderation Actions**
  - [ ] **Ban User**: `POST /groups/{groupId}/bans`.
  - [ ] **Kick User**: `DELETE /groups/{groupId}/members/{userId}`.
  - [ ] **Warn User**: _Note: No native API. Implement local "Infraction" tracking._
  - [ ] **Join Requests**: List (`GET /groups/{groupId}/requests`) and Respond (`PUT`).
- [ ] **Database & Logging**
  - [ ] **Local DB**: Store "Soft Warnings" and moderator notes not supported by API.
  - [ ] **Logs**: Persist audit logs locally for searchability beyond API limits (API limit ~100).

### Phase 4: Polish & Expansion

1.  Advanced animations & transitions.
2.  User-defined macros/scripts (if requested later).
3.  Public release packaging.

## 6. Development Guidelines

- **Strict Typing**: No `any`. Define interfaces for everything (especially API responses).
- **Error Boundaries**: Every major view must have a fallback UI if it crashes.
- **Clean Components**: Keep components small (< 200 lines). Extract logic to hooks.
- **Documentation**: Comments on complex logic.

## 7. Next Steps

1.  Initialize the repository.
2.  Install dependencies.
3.  Configure the build system.
