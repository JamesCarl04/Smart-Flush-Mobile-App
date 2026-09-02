# 🚽 Klir Mobile — Smart Facility Sanitation & IoT Dispatch System

> **Enterprise Mobile Client for Smart Flush IoT Ecosystem**  
> *SDCA Annex Campus Edition • 4-Floor Facility Operations*

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-54.0-black.svg?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20FCM-orange.svg?logo=firebase)](https://firebase.google.com/)
[![Jest Tests](https://img.shields.io/badge/Tests-19%20Suites%20%7C%20149%20Passed-brightgreen.svg?logo=jest)](#-testing--qa-verification)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#)

---

## 📌 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [End-to-End System Architecture](#-end-to-end-system-architecture)
3. [The 11 Delivered Production Modules](#-the-11-delivered-production-modules)
4. [Facility Master Mapping (SDCA Annex 19 Restrooms)](#-facility-master-mapping-sdca-annex-19-restrooms)
5. [Dual-Role System & Access Matrix](#-dual-role-system--access-matrix)
6. [3-Step Maintenance Execution & Multi-Area Proofs](#-3-step-maintenance-execution--multi-area-proofs)
7. [Supervisor Command Hub & Inspection Review](#-supervisor-command-hub--inspection-review)
8. [Biometric Vault & Hardware Security Gate](#-biometric-vault--hardware-security-gate)
9. [Offline-First Sync & Smart Compression Pipeline](#-offline-first-sync--smart-compression-pipeline)
10. [Live User Directory & Credentials](#-live-user-directory--credentials)
11. [Project Setup & Installation](#-project-setup--installation)
12. [Testing & QA Verification](#-testing--qa-verification)
13. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏢 Executive Summary

**Klir Mobile** is an enterprise-grade React Native & Expo mobile application purpose-built for campus facility supervisors and custodial technicians operating at the **SDCA Annex Building**.

Directly connected with the **Smart Flush IoT Platform**, Klir bridges real-time telemetry from restroom hardware (flush actuation counters, occupancy sensors, UV-C sterilizers, water leak detectors) with automated, human-in-the-loop custodial dispatching.

```mermaid
graph TD
    IoT[📡 Restroom IoT Sensors & MQTT] -->|Live Telemetry & Faults| WebBackend[🖥️ Smart Flush Web Backend]
    WebBackend -->|Alert Engine & Task Creation| Firestore[(🔥 Cloud Firestore)]
    WebBackend -->|FCM Push Dispatch| FCM[📲 Firebase Cloud Messaging]
    
    FCM -->|Push Notification| MobileApp[📱 Klir Mobile Client]
    Firestore <-->|Realtime Sync & SWR Cache| MobileApp
    
    subgraph MobileApp [Klir Mobile Architecture]
        RoleRouter{Role Router}
        RoleRouter -->|role: supervisor| SupHub[👑 Supervisor Command Hub]
        RoleRouter -->|role: maintenance| TechSpace[🛠️ Technician Workspace]
        
        TechSpace -->|1-Tap Checklist & 1080p Smart Compression| TaskFlow[📸 3-Step Proof Verification]
        TaskFlow -->|Watermarked Proofs & Biometrics| FirebaseStorage[🗄️ Firebase Storage]
        
        SupHub -->|Biometric/Password Gate| ReviewGate[🔐 Completed Review Auditor]
    end
```

---

## 🏗️ End-to-End System Architecture

### Technology Stack
* **Framework:** React Native `0.81.5` on Expo SDK `54.0.34` (New Architecture Enabled)
* **Language:** TypeScript `5.9.2` (Strict mode enforced)
* **UI & Theming:** React Native Paper `5.15.0` + Custom KLIR Design System
* **State & Networking:** React Context + SWR Multi-Tier Cache + Firebase Realtime Subscriptions
* **Cloud & Persistence:** Firebase Auth, Cloud Firestore, Firebase Storage, Firebase Cloud Messaging (FCM v1)
* **Hardware Integrations:** `expo-local-authentication` (Biometrics), `expo-image-manipulator` (Smart Downscaling), `react-native-view-shot` (Timestamp Stamping)

---

## 🚀 The 11 Delivered Production Modules

### 1. 📡 Real IoT Hardware Failure Detection & UV Anti-Spam
* Hardware failure alarms (e.g. valve stuck open, pump failure, sensor disconnect) automatically route to `evaluateAlerts()` to generate high-priority work orders.
* `hasActiveHardwareTask` debouncing prevents task flooding from continuous sensor triggers.

### 2. 📑 Accurate Inbox Tab Filtering & Strict Deduplication
* `deduplicateTasks()` guarantees that SWR cache merges and Firestore snapshots never render duplicate task cards.
* Distinct tabs for **All**, **Active**, and **Flagged** with custom empty states.

### 3. 🔄 Robust Task Reassignment Engine & Locking
* Prevents reassignments once a task is acknowledged or completed (`409 Conflict`).
* When a supervisor reassigns an unacknowledged task, the previous technician's state is immediately released (`isAvailable = true`), the new assignee is locked, and an FCM push notification is dispatched.

### 4. ⚡ Zero-Flicker SWR & Persistent Cache
* Instant 0ms cache hydration from `@klir:technician_tasks` (`AsyncStorage`).
* Non-destructive background revalidation without full-screen spinners or layout jumping.

### 5. ✂️ Streamlined Step 3 Summary Screen
* Removed redundant "Retake Proof Photo" and "Edit Checklist" buttons in Step 3 summary to eliminate accidental submission discard.

### 6. 🧹 Production Hardening & Simulator Purge
* Purged mock simulation controls from `ProfileSheetModal.tsx` and context to ensure clean separation of live IoT telemetry from UI.

### 7. ⚡ 1-Tap "Check All as Done / Reset" Checklist
* Quick toggle button in `TaskExecutionModal.tsx` and `TaskDetailScreen.tsx`.
* Shows `[ Check All as Done (1-Tap) ]` when incomplete, and `[ Reset All Items ]` when 10/10 items are marked done.

### 8. 🔐 Supervisor Biometric & Password Gate
* Gated entry to `Completed Reviews` in supervisor mode behind `LocalAuthentication.authenticateAsync`.
* Fallback to `SupervisorAuthDialog` modal for password verification when biometrics are unavailable.

### 9. 🛡️ Seamless Biometric Login & Credential Vault
* Securely caches user credentials in `@klir:biometric_vault` upon explicit login.
* Biometric quick-resume automatically invokes `signInWithEmailAndPassword` to re-establish an active Firebase session, eliminating session expiration errors.

### 10. 👥 Multi-Assignee & Broadcast Task Safeguards
* In multi-assignee and broadcast tasks (`assignedToIds.length > 1`), individual technician contributions are recorded under `submissions[uid]`.
* Task status remains in-progress until all assignees submit, preventing team members from overwriting each other's work.

### 11. 📸 Multi-Area Photo Proof Gallery & Smart Client-Side Compression
* Automated downscaling to $1080\text{px}$ width at $75\%$ JPEG quality reduces photo sizes from ~5MB to ~140KB (~97% storage and bandwidth savings).
* Technicians can attach up to 3 additional area photos (e.g. Stall 1, Stall 2, Urinals, Sink & Counter, Floor Drain) with burned timestamp/location overlays.
* Supervisors inspect all photos in a horizontal carousel with fullscreen zoom.

---

## 🗺️ Facility Master Mapping (SDCA Annex 22 Restrooms & 96 Fixtures)

The SDCA Annex facility contains **22 registered restroom units** and **96 total fixtures/stalls** across 4 floors:

| Floor | Restroom Name | Device ID | Fixture Count | Default Lead Technician |
| :--- | :--- | :--- | :---: | :--- |
| **1st Floor** | **1F Canteen Male Restroom**<br>**1F Canteen Female Restroom**<br>**1F Faculty Male Restroom**<br>**1F Faculty Female Restroom** | `SDCA-FL1-CANTEEN-M`<br>`SDCA-FL1-CANTEEN-F`<br>`SDCA-FL1-FACULTY-M`<br>`SDCA-FL1-FACULTY-F` | 7<br>3<br>6<br>2 | **James Alvarez**<br>(`james@gmail.com`) |
| **2nd Floor** | **2F Male (Left Wing)**<br>**2F Male (Right Wing)**<br>**2F Female (Left Wing)**<br>**2F Female (Right Wing)**<br>**2F PWD (Left Wing)**<br>**2F PWD (Right Wing)** | `SDCA-FL2-M1`<br>`SDCA-FL2-M2`<br>`SDCA-FL2-F1`<br>`SDCA-FL2-F2`<br>`SDCA-FL2-PWD1`<br>`SDCA-FL2-PWD2` | 7<br>7<br>5<br>5<br>1<br>1 | **Justine Lopez (Tech)**<br>(`justine@gmail.com`) |
| **3rd Floor** | **3F Male (Left Wing)**<br>**3F Male (Right Wing)**<br>**3F Female (Left Wing)**<br>**3F Female (Right Wing)**<br>**3F PWD (Left Wing)**<br>**3F PWD (Right Wing)** | `SDCA-FL3-M1`<br>`SDCA-FL3-M2`<br>`SDCA-FL3-F1`<br>`SDCA-FL3-F2`<br>`SDCA-FL3-PWD1`<br>`SDCA-FL3-PWD2` | 7<br>7<br>5<br>5<br>1<br>1 | **Maria Lindog**<br>(`maria@gmail.com`) |
| **4th Floor** | **4F Male (Left Wing)**<br>**4F Male (Right Wing)**<br>**4F Female (Left Wing)**<br>**4F Female (Right Wing)**<br>**4F PWD (Left Wing)**<br>**4F PWD (Right Wing)** | `SDCA-FL4-M1`<br>`SDCA-FL4-M2`<br>`SDCA-FL4-F1`<br>`SDCA-FL4-F2`<br>`SDCA-FL4-PWD1`<br>`SDCA-FL4-PWD2` | 7<br>7<br>5<br>5<br>1<br>1 | **Floating / Supervisor Dispatch** |
| **Hardware Lab** | **SDCA Annex Test Stall** | `toilet-01` | 1 | *Hardware Test Unit* |

---

## 👥 Dual-Role System & Access Matrix

The app implements strict client and server-side role isolation:

```
                      ┌──────────────────────────────────────┐
                      │          Authentication Gateway      │
                      └──────────────────┬───────────────────┘
                                         │
                         Evaluate request.auth.token.role
                                         │
                        ┌────────────────┴────────────────┐
                        │                                 │
                 role == "supervisor"              role == "maintenance"
                        │                                 │
           ┌────────────▼────────────┐       ┌────────────▼────────────┐
           │ 👑 SUPERVISOR HUB       │       │ 🛠️ TECHNICIAN WORKSPACE  │
           │ • Live Squad Roster     │       │ • Priority Alert Inbox  │
           │ • Work Order Dispatch   │       │ • 3-Step Execution Flow │
           │ • Reassignment Engine   │       │ • Multi-Area Proofs     │
           │ • Biometric Review Gate │       │ • Work History & Stats  │
           └─────────────────────────┘       └─────────────────────────┘
```

---

## 📸 3-Step Maintenance Execution & Multi-Area Proofs

```
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│ 1. ARRIVAL PROOF        │ ----> │ 2. CHECKLIST (10-ITEMS) │ ----> │ 3. COMPLETION & AREA    │
│  • Wide Doorway Shot    │       │  • 1-Tap Check All/Reset│       │  • After Photo          │
│  • Watermark Stamped    │       │  • Categorized Grid     │       │  • Multi-Area Carousel  │
│  • Biometric Identity   │       │  • SDCA F-TGS 203 Form  │       │  • Cloud Submission     │
└─────────────────────────┘       └─────────────────────────┘       └─────────────────────────┘
```

### SDCA F-TGS 203 Checklist Items
1. Remove ceiling dust & cobwebs
2. Wipe and clean wall surfaces
3. Dust and inspect light bulbs
4. Clean windows and glass partitions
5. Wipe and sanitize fixtures
6. Disinfect high-touch surfaces
7. Sweep and dry mop floors
8. Empty trash bins and replace liners
9. Organize and arrange restroom supplies
10. Disinfect UV-C sterilization modules

---

## 👑 Supervisor Command Hub & Inspection Review

* **Squad Roster Monitor:** Live 3-state visibility:
  * 🟢 **Available:** Ready for dispatch (`currentTaskId === null`).
  * 🔴 **On Task:** Actively executing a task with room callout & elapsed time.
  * 🟡 **Offline:** Off-duty or signed out.
* **Reassignment Modal:** Reallocate tasks from busy/offline workers with reason logging.
* **Gated Review:** High-security audit screen requiring biometric or password verification before inspecting or flagging completed work orders.

---

## 💾 Offline-First Sync & Smart Compression Pipeline

* **Offline Queue:** Captures task acknowledgments and submissions locally when cellular/Wi-Fi is lost.
* **Auto-Flush Sync:** Seamlessly uploads queued tasks when network connectivity is restored.
* **Smart Compression:**
  ```typescript
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  ```
  Reduces 5MB images to ~140KB without losing forensic watermark clarity.

---

## 📋 Live User Directory & Credentials

| Name | Email | Role | Assigned Zone | Default Screen |
| :--- | :--- | :---: | :--- | :--- |
| **Justine Lopez** | `justine.lopez@sdca.edu.ph` | **`supervisor`** | **SDCA Annex (Floors 1–4)** | **Supervisor Command Hub** |
| **James Alvarez** | `james@gmail.com` | **`maintenance`** | **1st Floor** (Canteen & Faculty) | **Technician Workspace** |
| **Justine Lopez (Tech)** | `justine@gmail.com` | **`maintenance`** | **2nd Floor** (General & PWD) | **Technician Workspace** |
| **Maria Lindog** | `maria@gmail.com` | **`maintenance`** | **3rd Floor** (General & PWD) | **Technician Workspace** |

---

## 🚀 Project Setup & Installation

### Prerequisites
* **Node.js**: `v18.x` or `v20.x` LTS
* **Android Studio**: Android SDK Build-Tools 34+, Physical Device or Emulator
* **Google Services**: Place `google-services.json` in the root directory

### 1. Installation
```powershell
# Navigate to project directory
cd c:\Users\justi\Development\Smart-Flush-Mobile-App

# Install npm dependencies
npm install
```

### 2. Environment Setup
Create `.env` in the root directory:
```env
EXPO_PUBLIC_API_URL=http://<YOUR_BACKEND_IP>:3000
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDvTCyVj4w9KO0hzWobKy7D_fMrI2iKTTU
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=klir-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=klir-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=klir-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=526260279429
EXPO_PUBLIC_FIREBASE_APP_ID=1:526260279429:android:98d069af9c580bdd7831ec
GOOGLE_SERVICES_JSON=./google-services.json
```

### 3. Launching the App
```powershell
# Build and run Android Development Client
npm run android

# Start the Expo Metro Bundler
npm run start:dev
```

---

## 🧪 Testing & QA Verification

```powershell
# 1. Full TypeScript Typecheck
npm run typecheck

# 2. Run All 19 Jest Test Suites (149 Tests)
npm test

# 3. Run Specific Suite (e.g. Supervisor Screens)
npx jest __tests__/integration/screens/SupervisorScreens.test.tsx

# 4. Run Task Execution Modal Tests
npx jest __tests__/integration/TaskExecutionModal.test.tsx

# 5. Expo Diagnostic Healthcheck
npm run doctor
```

---

## 🛠️ Troubleshooting & FAQs

#### Q1: Why does the app say "Forbidden" or display an empty screen?
* **Cause:** User document in Firestore is missing the `"role"` field.
* **Fix:** Ensure `users/{uid}` contains `"role": "supervisor"` or `"role": "maintenance"`.

#### Q2: Why did biometric authentication fail?
* **Cause:** Device has no fingerprint/face enrolled in Android System Settings.
* **Fix:** Enroll biometrics in device settings or use the password fallback option.

#### Q3: Push notifications are not received.
* **Cause:** Emulators do not support native FCM push tokens.
* **Fix:** Test push notifications on a physical Android device with Google Play Services.

---

*© 2026 Smart Flush / Klir Mobile Team • SDCA Facility Operations. All rights reserved.*

