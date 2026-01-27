# Group Guard

**Status**: 🚧 Alpha / Development

> **The ultimate command center for VRChat Group Instances.**
> Manage instances, automate security, and rally your community with powerful tools.

![Group Guard Banner](https://via.placeholder.com/800x200.png?text=Group+Guard+UI+Placeholder)

## 📖 Introduction

**Group Guard** is a desktop application designed for VRChat Group Owners and Moderators. It seamlessly integrates with the VRChat API and local log files to provide a real-time "God View" of your group instances.

Unlike simple mods or discord bots, Group Guard is a **standalone external tool** that runs on your PC, ensuring compliance with VRChat's Terms of Service by only reading logs and using the official API (no game memory injection).

## ✨ Key Features

### 🛡️ AutoMod & Security

Automate your instance security to keep trolls and bad actors out.

- **Rule Engine**: Create custom rules based on Trust Rank, Account Age, Keywords (in Bio/Status), and more.
- **Actions**: Automatically Notify when a rule is triggered.

### 🔞 Instance Guard

Enforce 18+ age-gating on your group instances automatically.

- **Auto-Close**: Automatically closes group instances that are not marked as 18+ age-gated.
- **Activity Log**: Track all instance open/close events with detailed information.
- **Owner Tracking**: See who started each instance and view their profile.
- **Event Details**: Click any log entry to view world info, user count, and instance starter details.
- **Smart Caching**: Prevents duplicate close attempts with intelligent deduplication.

### 📡 Live Ops Command Center

Monitor and control your active instance in real-time.

- **Instance Monitor**: See exactly who is in your instance, their extensive details, and when they joined.
- **Scan Sector**: One-click scan to refresh player lists from logs.
- **Mass Invite**: Invite all your online friends to the current instance with smart filtering (AutoMod checks, already present checks).
- **Rally Forces**: Invite users from a previous session file—perfect for re-hosting crashed instances.

### 👥 Group Management

Direct integration with your VRChat Groups.

- **Member Management**: View, search, and manage group members.
- **Bans & Kicks**: Quickly ban or kick users from the group directly from the UI.
- **Instance Browser**: View all active instances for your groups and join them instantly.

### 💬 OSC Chatbox Integration

Enhance in-game communication without typing.

- **Announcer**: Automatically send welcome messages to new joins or periodic announcements (e.g., "Join our Discord!").

### 🎨 Advanced Theming System

Personalize your experience with comprehensive visual customization.

- **Theme Presets**: Choose from Dark, Light, Midnight, or Sunset themes with distinct aesthetics.
- **Color Control**: Full HSL spectrum control for primary/accent colors and backgrounds.
- **Glass Effects**: Adjustable blur, opacity, and border radius for modern glass-morphism.
- **Particle Effects**: Floating background particles with mouse interaction and color shifting.
- **Real-time Updates**: Instant preview with persistent settings.

## 🚀 Getting Started

### Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) (v16+)
- VRChat Account (with VRC+ for some features, though not strictly required)

### Running from Source

> **Note**: Running from source is recommended to get the absolute latest features and bug fixes that may not yet be in the public release.

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/AppleExpl01t/VRChat-Group-Guard.git
    cd VRChat-Group-Guard
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run locally**:
    ```bash
    npm run dev
    ```
    This will start both the Electron backend and the React frontend in hot-reload mode.

### Usage Guide

1.  **Login**: Launch the app and log in with your VRChat credentials. (Supports 2FA).
2.  **Select Group**: Choose the group you want to manage from the sidebar.
3.  **Join World**: Enter a VRChat instance. Group Guard uses your VRChat log files to detect where you are.
4.  **Configure**:
    - Go to **Settings** to point the app to your VRChat install folder (usually automatic).
    - Go to **AutoMod** to set up your protection rules.
    - Visit **Settings → Appearance** to customize themes and visual effects.
5.  **Monitor**: Switch to the **Dashboard** to see the live feed of events and players.

## 🎨 Themes & Customization

Group Guard features a comprehensive theming system with real-time customization. All settings are automatically saved and persist between sessions.

### Quick Access

1. **Open Settings** → Click the gear icon in the sidebar
2. **Appearance Tab** → First tab in the settings panel
3. **Customize** → Changes apply instantly and auto-save

### Theme Presets

Choose from four carefully crafted presets, each with distinct characteristics:

- **🌙 Dark** - Original neon cyberpunk aesthetic with purple/cyan accents
- **☀️ Light** - Clean, professional theme with soft blue/gray tones  
- **🌌 Midnight** - Ultra-dark space theme with electric blue and deep purple
- **🌅 Sunset** - Warm, cozy vibes with orange and pink magenta accents

### Color Customization

Full HSL (Hue, Saturation, Lightness) control for precise color matching:

- **Primary Neon** - Main accent color for buttons, highlights, and interactive elements
- **Accent Neon** - Secondary accent for gradients and complementary highlights
- **Background Hue** - Base color for the entire application background
- **Background Saturation** - Color intensity (0% = grayscale, 100% = full color)
- **Background Lightness** - Brightness control (0% = black, 100% = white)

*All colors use spectrum pickers with real-time preview*

### Glass & UI Effects

Control the visual aesthetics and depth:

- **Glass Blur** - Background blur intensity for glass panels (0-50px)
- **Glass Opacity** - Transparency level for glass surfaces (0-100%)
- **Border Radius** - Corner roundness for UI elements (0-30px)

### Particles & Effects

Ambient visual effects for enhanced immersion:

- **Enable Particles** - Toggle floating background particles on/off
- **Particle Count** - Number of particles (5-50)
- **Ambient Orbs** - Glowing orb elements within particle field
- **Color Shift** - Dynamic color transitions for particles
- **Mouse Reactive** - Particles respond to mouse movement

### Advanced Options

Fine-tune the user experience:

- **UI Scale** - Global interface scaling for accessibility
- **Header Gradient** - Toggle gradient effects in header areas
- **Reset All** - Restore default theme settings

### Technical Notes

- **CSS Custom Properties** - Theme uses CSS variables for instant updates
- **HSL Color System** - Intuitive color control with predictable results
- **localStorage Persistence** - Settings automatically save and restore
- **Light/Dark Adaptation** - Interface automatically adjusts text colors based on background brightness
- **Real-time Updates** - All changes apply instantly without restart

## ⚠️ Safety & Compliance

Group Guard is an **external tool**. It does **not** modify the game client, inject code, or read memory. It interacts with VRChat solely through:

1.  **VRChat API**: Standard web requests (like the website).
2.  **Log Files**: Reading text logs generated by VRChat (`output_log.txt`).
3.  **OSC**: One-way communication for chatbox messages.

_Use responsibly. Automated actions (like mass inviting) are rate-limited to avoid API spam, but you are responsible for your account's actions._

## 🛠️ Tech Stack

- **Electron**: Desktop Runtime
- **React**: UI Framework
- **TypeScript**: Logic & Type Safety
- **Vite**: Build Tool
- **Framer Motion**: Animations
- **Electron Store**: Local Data Persistence

## 📄 License

MIT License. See `LICENSE` for more information.
