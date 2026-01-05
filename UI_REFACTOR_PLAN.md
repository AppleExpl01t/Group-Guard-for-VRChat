# UI Refactor & AAA Polish Plan

This plan outlines the steps to refactor the application's UI to meet high-quality production standards. The goals are **design consistency**, **performance optimization**, **maintainability**, and **accessibility**, while strictly preserving all existing functionality.

## Phase 1: Foundation (Design System Update)

**Objective**: Establish a single source of truth for colors, depths (z-index), and spacing to eliminate hardcoded values ("magic numbers").

### 1.1 Update `src/styles/theme.css`

- **Semantic Colors**: Add variables for functional states to replace hex codes (e.g., `#ef4444`, `#22c55e`).
  - `--color-success`: `#22c55e`
  - `--color-warning`: `#f59e0b`
  - `--color-danger`: `#ef4444`
  - `--color-info`: `#4cc9f0`
- **Z-Index Registry**: Define a strict z-index scale.
  - `--z-background`: -1
  - `--z-content`: 1
  - `--z-header`: 50
  - `--z-dropdown`: 60
  - `--z-modal-backdrop`: 100
  - `--z-modal`: 110
  - `--z-tooltip`: 500
  - `--z-window-controls`: 5000
- **Typography**: Define font size and weight tokens if not present.

## Phase 2: Core Shell Refactoring (`App.tsx`)

**Objective**: Deconstruct the "God Component" `App.tsx` into focused, semantic components.

### 2.1 Extract `TitleBar` Component

- **Task**: Move the window control buttons (Minimize, Maximize, Close) and the draggable header area into a new component `src/components/layout/TitleBar.tsx`.
- **Benefits**: Isolates Electron IPC logic for window management; cleans up App.tsx.
- **Styling**: Use `TitleBar.module.css`.

### 2.2 Global Modals Wrapper

- **Task**: Create `src/components/layout/GlobalModals.tsx` to handle the `Disconnect/Logout` modal, `UpdateReady` modal, and `UserProfileDialog`.
- **Action**: Move state and rendering logic for these modals out of `App.tsx` (using Context or just component composition) to reduce `App.tsx` complexity.

### 2.3 Layout Standardization

- **Task**: Ensure `AppLayout` handles the main sizing and overflow logic using CSS classes instead of inline styles.

## Phase 3: Dashboard Refactoring (`DashboardView.tsx`)

**Objective**: Convert the Dashboard from a layout of inline-styled divs to a structured grid of accessible widgets.

### 3.1 CSS Module Implementation

- **Task**: Create `src/features/dashboard/DashboardView.module.css`.
- **Action**: Move all structural styles (grids, flex containers) and decorative styles (gradients, borders) into classes.

### 3.2 Component Extraction: `StatTile`

- **Task**: Create `src/features/dashboard/components/StatTile.tsx`.
- **Action**: Replace the repeated `div` blocks for "Members", "Instances", "Requests", "Bans".
- **Accessibility Upgrade**:
  - Change root element from `div` to `button` (or `div` with `role="button"` + `tabIndex={0}`).
  - Implement `onKeyDown` (Enter/Space) to mimic click behavior.
  - Add hover/focus states via CSS classes instead of inline `onMouseEnter`/`style={{...}}`.

### 3.3 Audit Feed Optimization

- **Task**: Refactor the Audit Log list to use a CSS module.
- **Responsiveness**: Ensure the grid layout adapts (stacks columns) when window width < 1000px.

## Phase 4: Feature View Standardization

**Objective**: Apply the same rigor to other main views.

### 4.1 Group Selection (`GroupSelectionView.tsx`)

- **Task**: Create `src/features/groups/GroupSelectionView.module.css`.
- **Action**: Move grid layouts and card styles to CSS. Use `--color-success` for the "Live" badges instead of hardcoded green.
- **A11y**: Ensure group cards are keyboard navigable.

### 4.2 Login View (`LoginView.tsx`)

- **Task**: Create `src/features/auth/LoginView.module.css`.
- **Action**: Move static styles (input fields, containers, labels) to CSS. Keep dynamic animations (particles) in Framer Motion but use CSS variables for their colors.

## Phase 5: Navigation & Dock (`NeonDock.tsx`)

**Objective**: Clean up the dock implementation.

### 5.1 CSS Module

- **Task**: Create `src/components/layout/NeonDock.module.css`.
- **Action**: Move the complex backdrop filters and positioning logic to CSS.

### 5.2 Accessibility

- **Task**: Add `aria-label` to all dock icons since they rely on visual tooltips/icons.

## Phase 6: Final Polish & Verification

### 6.1 Responsive Check

- **Task**: Resize window to minimum supported width (e.g., 800px) and ensure no content overlaps or breaks. Add `@media` queries in modules where necessary.

### 6.2 Code Cleanup

- **Task**: Run ESLint/Prettier to ensure no unused imports remain after extraction.

---

## Order of Operations

1.  **Step 1**: Theme Update (`theme.css`)
2.  **Step 2**: Create `TitleBar` & cleanup `App.tsx`
3.  **Step 3**: Refactor `DashboardView` (largest impact)
4.  **Step 4**: Refactor `GroupSelectionView` & `NeonDock`
5.  **Step 5**: Refactor `LoginView`
