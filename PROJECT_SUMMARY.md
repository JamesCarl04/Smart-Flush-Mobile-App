# Klir Mobile — Project Architecture & Codebase Summary

> **Application Name:** Klir Mobile (Smart Flush Field)  
> **Package ID:** `com.james.klir`  
> **Stack:** Expo SDK 54, React Native 0.81.5, TypeScript 5.9, Firebase (Auth, Firestore, Storage, Messaging), React Native Paper (MD3), React Navigation v6  
> **Target Platform:** Android (Physical device / Dev Client)

---

## 1. Project Overview & Utility

**Klir Mobile** is an enterprise-grade mobile application designed for smart sanitation facilities management. It connects IoT smart-toilet sensors, automated dispatch alerts, and backend maintenance systems with on-ground maintenance workers and field supervisors.

### Key Capabilities
- **Real-Time Dispatch & Push Alerts:** Receives IoT triggered hardware failure alerts, sanitation threshold alerts, and scheduled maintenance work orders via Firebase Cloud Messaging (FCM).
- **Interactive Multi-Step Task Execution:** Guides maintenance personnel through work order acknowledgement, a 10-point standardized cleaning checklist, dual proof-photo capture (Before & After) with timestamp watermarking, and biometric confirmation.
- **Offline Resilient Operation:** Allows personnel in basements or poor-connectivity areas to perform inspections and store task completion bundles in `AsyncStorage`, automatically syncing proof photos and timestamps when connectivity is restored.
- **Supervisor Operations Hub:** Enables field supervisors to view live team availability, monitor unassigned/flagged tasks, review completed task proofs, and reassign work orders in real time.

---

## 2. Directory Structure & File Map

```
Smart-Flush-Mobile-App/
├── .env.example                 # Environment variable template
├── app.config.ts                # Dynamic Expo configuration & Android native permissions
├── app.json                     # Static Expo metadata
├── App.tsx                      # Root component, providers, theme, notification listeners
├── eas.json                     # Expo Application Services build configuration
├── index.ts                     # Application entry point (registerRootComponent)
├── package.json                 # Dependency definitions and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
├── PROJECT_SUMMARY.md           # Project architecture documentation & reference
│
├── assets/                      # Application icons, splash screen, and adaptive assets
│
├── components/                  # Shared UI components and primitives
│   ├── MaintenanceUI.tsx        # Design tokens (UI_COLORS), badges, pills, and empty states
│   └── SkeletonScreens.tsx      # Skeleton loaders for app startup and task detail views
│
├── contexts/                    # Global React Contexts
│   ├── AuthContext.tsx          # Firebase authentication and role verification (/api/auth/me)
│   ├── OfflineSyncContext.tsx   # Network monitoring and background offline task sync
│   └── TasksContext.tsx         # Maintenance task polling (10s interval) and list caching
│
├── hooks/                       # Custom Hook bindings
│   ├── useAuth.ts               # Hook wrapper for AuthContext
│   ├── useOfflineSync.ts        # Hook wrapper for OfflineSyncContext
│   └── useTasks.ts              # Hook wrapper for TasksContext
│
├── lib/                         # Core utility libraries and API layers
│   ├── api.ts                   # Authenticated fetch client attaching Firebase ID tokens
│   ├── config.ts                # Environment variable reader and validation
│   ├── firebase.ts              # Firebase App, Auth, Firestore, and Storage initialization
│   ├── native-image-picker.ts   # Direct native module bridge for camera capture
│   ├── notifications.ts         # FCM token registration, Android permissions, notification handlers
│   ├── restrooms.ts             # Restroom name mapping and ID formatting
│   ├── supervisor-api.ts        # Supervisor REST endpoints (team list, reassign, flag)
│   ├── task-api.ts              # Maintenance task API endpoints (fetch, acknowledge, complete)
│   ├── task-completion.ts       # Photo upload, duration calculations, and offline storage queue
│   └── tasks.ts                 # Task document parsers, status formatting, checklist definitions
│
├── navigation/                  # React Navigation routing and containers
│   ├── AppNavigator.tsx         # Root switcher between Auth and Main stacks
│   ├── AuthNavigator.tsx        # Stack for Login and Forgot Password screens
│   ├── LogoutHeaderButton.tsx   # Reusable navigation header sign-out button
│   ├── MainNavigator.tsx        # Role-based navigator (Bottom Tabs for Workers, Stack for Supervisors)
│   └── navigationRef.ts         # Global navigation ref and deep link queue for notifications
│
├── screens/                     # View screens
│   ├── ActiveTaskScreen.tsx     # Quick summary screen for the current assigned work order
│   ├── ForgotPasswordScreen.tsx # Password reset request screen
│   ├── HistoryScreen.tsx        # Filterable list of completed tasks with duration metrics
│   ├── InboxScreen.tsx          # Primary worker inbox with priority alerts, filters, and status counters
│   ├── LoginScreen.tsx          # Firebase email/password authentication screen
│   ├── SupervisorScreens.tsx    # Dashboard, Team Availability, Task Reassignment, and Review Details
│   └── TaskDetailScreen.tsx     # Comprehensive 3-step task workflow (Details -> Checklist & Proof -> Submit)
│
└── types/                       # TypeScript interfaces and navigation param lists
    └── index.ts                 # Shared types: Task, Checklist, AuthUser, Navigation Param Lists
```

---

## 3. Architecture & Core Systems

### 3.1 Authentication & Role-Based Access Control
- **Authentication Engine:** React Native Firebase Auth (`@react-native-firebase/auth`).
- **Profile & Role Verification:** Upon Firebase Auth state change, [`AuthContext.tsx`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/contexts/AuthContext.tsx) calls the backend `/api/auth/me` with the bearer token to verify role membership (`maintenance` or `supervisor`). Unauthorized roles are signed out immediately.
- **Dynamic Routing:** [`MainNavigator.tsx`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/navigation/MainNavigator.tsx) routes `supervisor` users to the `SupervisorStackNavigator` and `maintenance` users to the 3-tab Bottom Navigator (`InboxTab`, `TaskTab`, `HistoryTab`).

### 3.2 Task Lifecycle & State Machine
A task transitions through the following statuses:
```
unassigned ──> assigned ──> acknowledged ──> completed
     │              │             │
     └──────────────┴─────────────┴──> flagged / reassignment_needed
```
- **Unassigned / Assigned:** Alerts generated by IoT or manual triggers.
- **Acknowledged:** Worker accepts the task in [`TaskDetailScreen.tsx`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/screens/TaskDetailScreen.tsx); `responseTime` and `acknowledgedAt` are tracked.
- **Completed:** Worker completes all 10 checklist items, takes Before & After photos, verifies biometrics, and submits. `workDuration` (acceptance to completion) and `totalTime` (creation to completion) are recorded.
- **Reassignment Needed / Flagged:** Supervisor or system flags issues or reallocates workload to another staff member.

### 3.3 The 10-Point Standard Checklist
Defined in [`lib/tasks.ts`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/lib/tasks.ts), each task tracks:
1. `removeCeilingDust` — Remove dust/cobwebs on ceilings
2. `removeWallDust` — Remove dust/cobwebs on walls
3. `removeLightBulbDust` — Remove dust/cobwebs in light bulbs
4. `cleanWindows` — Clean windows (optional)
5. `wipeDownFixtures` — Wipe down fixtures (optional)
6. `disinfectTouchedSurfaces` — Disinfect often touched surfaces
7. `sweepAndDryFloors` — Sweep and dry floors
8. `emptyTrashBins` — Empty and re-line trash bins
9. `arrangeFixtures` — Arrange fixtures (optional)
10. `disinfectUVLights` — Disinfect using UV lights, etc.

Checklist states: `'unchecked' | 'done' | 'na'`.

### 3.4 Hardware & Proof Validation
- **Native Camera Capture:** [`lib/native-image-picker.ts`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/lib/native-image-picker.ts) directly binds to `ExponentImagePicker` for high-performance capture.
- **Watermarking / Overlay:** Uses `react-native-view-shot` and `expo-image-manipulator` to generate timestamped proof assets.
- **Biometric Security:** Uses `expo-local-authentication` (`LocalAuthentication.authenticateAsync`) before final task submission to guarantee worker identity.

### 3.5 Push Notifications & Deep Linking
- **Push Engine:** Firebase Cloud Messaging via `@react-native-firebase/messaging`.
- **Token Registration:** Handled via [`lib/notifications.ts`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/lib/notifications.ts) (`POST /api/tasks/register-token`).
- **Foreground Banners & Deep Linking:** [`navigationRef.ts`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/navigation/navigationRef.ts) coordinates notification taps, queueing navigation to `TaskDetail` whether the app was closed, backgrounded, or foregrounded.

### 3.6 Offline Capability & Sync
- **Storage:** Offline completions are stored in `AsyncStorage` under key `offline_tasks`.
- **Sync Listener:** [`OfflineSyncContext.tsx`](file:///c:/Users/justi/Development/Smart-Flush-Mobile-App/contexts/OfflineSyncContext.tsx) uses `Network.addNetworkStateListener` to automatically upload queued photo blobs and update Firestore when the device regains internet connection.

---

## 4. API Endpoints Reference

The app communicates with the backend API configured via `EXPO_PUBLIC_BACKEND_API_BASE_URL`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/auth/me` | Fetches authenticated user profile, role, and building assignment |
| `GET` | `/api/tasks` | Fetches all active and historical tasks |
| `GET` | `/api/tasks/:taskId` | Fetches individual task document details |
| `POST` | `/api/tasks/:taskId/acknowledge` | Acknowledges receipt of a task by worker |
| `POST` | `/api/tasks/:taskId/complete` | Closes task and updates availability |
| `POST` | `/api/tasks/register-token` | Registers or refreshes the device FCM push token |
| `GET` | `/api/maintenance-personnel` | Returns list of maintenance team members, shifts, and current status |
| `POST` | `/api/supervisor/reassign-task` | Reassigns a task to a different personnel ID with reason |
| `POST` | `/api/supervisor/flag-task` | Flags a task requiring supervisor intervention |

---

## 5. Development & Build Commands

```powershell
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run on Android emulator / physical device
npm run android
npm run android:device

# Typecheck and health checks
npm run typecheck
npm run doctor

# EAS Build (Android development APK)
npx eas build --platform android --profile development
```
