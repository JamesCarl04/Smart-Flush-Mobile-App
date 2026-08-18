# 🚽 Klir Mobile — Smart Facility Sanitation & IoT Dispatch System

> **Enterprise Mobile Client for Smart Flush IoT Ecosystem**  
> *SDCA Annex Campus Edition • 4-Floor Facility Operations*

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-54.0-black.svg?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20FCM-orange.svg?logo=firebase)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#)

---

## 📌 Table of Contents

1. [Executive Summary](#-executive-summary)
2. [Facility Master Mapping (SDCA Annex)](#-facility-master-mapping-sdca-annex)
3. [Dual-Role Architecture](#-dual-role-architecture)
   - [Facility Supervisor (Operations Hub)](#1-facility-supervisor-operations-hub)
   - [Maintenance Technician (Task Workspace)](#2-maintenance-technician-task-workspace)
4. [The 30-Second Cleaning Execution Workflow](#-the-30-second-cleaning-execution-workflow)
5. [Real-Time Availability Engine (3-State Logic)](#-real-time-availability-engine-3-state-logic)
6. [Offline-First Sync & SQLite Architecture](#-offline-first-sync--sqlite-architecture)
7. [Push Notifications & Role-Aware Deep Linking](#-push-notifications--role-aware-deep-linking)
8. [Live User Directory & Permissions](#-live-user-directory--permissions)
9. [Project Setup & Installation](#-project-setup--installation)
10. [Build & Verification Scripts](#-build--verification-scripts)
11. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏢 Executive Summary

**Klir Mobile** is a mission-critical Android application built on **Expo SDK 54** and **React Native** designed for campus facility managers and custodial technicians. 

Directly integrated with the **Smart Flush IoT Web Platform**, Klir automates restroom sanitation dispatch by bridging live hardware telemetry (flush counts, occupancy duration, UV sterilization cycles, and critical leak detection) with human operational response.

```mermaid
graph TD
    IoT[📡 IoT Hardware Sensors & MQTT] -->|Alerts & Thresholds| WebBackend[🖥️ Smart Flush Web Backend / Firebase]
    WebBackend -->|FCM Push Notifications| MobileClient[📱 Klir Mobile App]
    
    MobileClient -->|Supervisor View| SupHub[👑 SDCA Annex Command Hub]
    MobileClient -->|Technician View| TechWork[🛠️ Floor Task Workspace]
    
    TechWork -->|Before/After Photos + Checklist| SyncEngine[💾 SQLite + Sync Engine]
    SyncEngine -->|Verified Submissions| WebBackend
    WebBackend -->|Inspection Review| SupHub
```

---

## 🗺️ Facility Master Mapping (SDCA Annex)

The SDCA Annex facility contains **19 registered restroom units** distributed across 4 floors. Each unit is individually addressable via hardware device IDs:

| Floor | Restroom Name | Device ID | Default Lead Technician |
| :--- | :--- | :--- | :--- |
| **1st Floor** | **1F Canteen Male Restroom**<br>**1F Canteen Female Restroom**<br>**1F Faculty Male Restroom**<br>**1F Faculty Female Restroom** | `SDCA-FL1-CANTEEN-M`<br>`SDCA-FL1-CANTEEN-F`<br>`SDCA-FL1-FACULTY-M`<br>`SDCA-FL1-FACULTY-F` | **James Alvarez**<br>(`james@gmail.com`) |
| **2nd Floor** | **2F Male Restroom 1**<br>**2F Male Restroom 2**<br>**2F Female Restroom 1**<br>**2F Female Restroom 2**<br>**2F PWD Restroom** | `SDCA-FL2-M1`<br>`SDCA-FL2-M2`<br>`SDCA-FL2-F1`<br>`SDCA-FL2-F2`<br>`SDCA-FL2-PWD` | **Justine Lopez (Tech)**<br>(`justine@gmail.com`) |
| **3rd Floor** | **3F Male Restroom 1**<br>**3F Male Restroom 2**<br>**3F Female Restroom 1**<br>**3F Female Restroom 2**<br>**3F PWD Restroom** | `SDCA-FL3-M1`<br>`SDCA-FL3-M2`<br>`SDCA-FL3-F1`<br>`SDCA-FL3-F2`<br>`SDCA-FL3-PWD` | **Maria Lindog**<br>(`maria@gmail.com`) |
| **4th Floor** | **4F Male Restroom 1**<br>**4F Male Restroom 2**<br>**4F Female Restroom 1**<br>**4F Female Restroom 2**<br>**4F PWD Restroom** | `SDCA-FL4-M1`<br>`SDCA-FL4-M2`<br>`SDCA-FL4-F1`<br>`SDCA-FL4-F2`<br>`SDCA-FL4-PWD` | **Floating / Supervisor Dispatch** |
| **Hardware Lab** | **SDCA Annex Test Stall** | `toilet-01` | *Hardware Test Unit* |

---

## 👥 Dual-Role Architecture

The mobile application enforces strict, client-level and backend-level role isolation:

### 1. Facility Supervisor (`role: supervisor`)
Supervisors oversee facility-wide operations across all 4 floors and 19 restrooms without entering task checklist execution screens:

* **Command Hub Dashboard:** Real-time metrics for active work orders, pending alerts, available technicians, and unassigned tasks.
* **Team Availability:** Live 3-state roster monitoring technicians (Available, On Task with active room callouts, and Offline).
* **Task Review & Live Dispatch:** Real-time reallocation of work orders from one staff member to another with logged audit reasons.
* **Completed Review Auditing:** Dual-photo inspection (Before vs. After) with one-tap sign-off or **Flag for Re-Inspection**.

### 2. Maintenance Technician (`role: maintenance`)
Technicians receive a focused 3-tab workspace scoped to their assigned floor and work orders:

* **Tab 1 — Inbox:** Incoming priority alerts, scheduled routine cleanings, and hardware fault dispatches.
* **Tab 2 — Active Task:** Step-by-step checklist execution, photo proof capture, and biometric signature.
* **Tab 3 — History:** Personal work log of completed shifts, timestamps, and performance metrics.

---

## ⚡ The 30-Second Cleaning Execution Workflow

To prevent worker fatigue and eliminate storage bloat, Klir uses the **Wide Entrance Overview** method:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. DOORWAY SHOT │ ----> │ 2. CLEAN ROOM   │ ----> │ 3. FINISH SHOT  │ ----> │ 4. BIOMETRIC    │
│  (Before Photo) │       │ (Phone Pocketed)│       │  (After Photo)  │       │  & SUBMIT       │
│    [3 Seconds]  │       │  [10-15 Mins]   │       │   [3 Seconds]   │       │  [15 Seconds]   │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

1. **Step 1 — Arrival (3s):** Technician enters the restroom, opens the work order, and snaps **1 Wide Before Photo** from the entrance doorway.
2. **Step 2 — Physical Cleaning (10–15m):** Technician pockets their phone and completes the sanitation work (mopping, fixtures, trash, UV sanitization).
3. **Step 3 — Completion Proof (3s):** Technician returns to the doorway and snaps **1 Wide After Photo**.
4. **Step 4 — Checklist & Biometrics (15s):** Checks off the 10 sanitation items, verifies local biometric credentials (fingerprint/face scan), and submits.

---

## 🚦 Real-Time Availability Engine (3-State Logic)

Technician status is dynamically derived every **10 seconds** by evaluating Firestore `tasks` and `users`:

```
                           ┌───────────────────────────┐
                           │   Technician Profile      │
                           └─────────────┬─────────────┘
                                         │
                         Has active incomplete task?
                                  /       \
                                YES        NO
                                /            \
                      ┌───────────────┐     Is isAvailable == true?
                      │  🔴 ON TASK   │             /        \
                      │ (Busy in room)│          YES          NO
                      └───────────────┘         /               \
                                      ┌─────────────────┐   ┌─────────────────┐
                                      │  🟢 AVAILABLE   │   │  🟡 OFFLINE     │
                                      │  (Ready to go)  │   │  (Shift ended)  │
                                      └─────────────────┘   └─────────────────┘
```

* **🟢 Available:** On shift, logged in, and free for assignment (`currentTaskId === null`).
* **🔴 On Task:** Actively executing a cleaning task. The supervisor dashboard displays the exact room and elapsed duration (e.g. *1F Canteen Male Restroom • since 1:45 PM*).
* **🟡 Offline:** Shift ended via profile sheet or user logged out.

---

## 💾 Offline-First Sync & SQLite Architecture

Klir Mobile contains a full offline engine to support basements or thick concrete restroom structures with intermittent Wi-Fi/cellular signal:

* **Local Database:** Powered by `expo-sqlite`, storing tasks, checklists, and pending submissions locally.
* **Optimistic UI Updates:** Task acknowledgments and step completions instantly update the local state without waiting for network ACK.
* **Sync Engine:** Automatic exponential backoff queue that flushes pending photo uploads and checklist payloads as soon as connectivity resumes.

---

## 🔔 Push Notifications & Role-Aware Deep Linking

* **Push Gateway:** Firebase Cloud Messaging (FCM v1) integrated with `expo-notifications`.
* **Token Registration:** Automatic token registration upon login via `POST /api/tasks/register-token`.
* **Role-Aware Deep Linking:**
  * **Supervisor taps alert:** Directly opens `SupervisorTaskDetail` to inspect or reassign.
  * **Technician taps alert:** Directly opens `TaskDetail` to acknowledge and begin checklist.

---

## 📋 Live User Directory & Permissions

| Name | Email | Role | Assigned Zone | Login Destination |
| :--- | :--- | :---: | :--- | :--- |
| **Justine Lopez** | `justine.lopez@sdca.edu.ph` | **`supervisor`** | **SDCA Annex (Floors 1–4)** | **SDCA Annex Command Hub** |
| **James Alvarez** | `james@gmail.com` | **`maintenance`** | **1st Floor** (Canteen & Faculty) | **Technician Workspace** |
| **Justine Lopez (Tech)** | `justine@gmail.com` | **`maintenance`** | **2nd Floor** (General & PWD) | **Technician Workspace** |
| **Maria Lindog** | `maria@gmail.com` | **`maintenance`** | **3rd Floor** (General & PWD) | **Technician Workspace** |

---

## 🚀 Project Setup & Installation

### Prerequisites
* **Node.js**: 18.x or 20.x LTS
* **Android Studio**: Android SDK Build-Tools 34+, Android Emulator or Physical Android Device
* **Google Services**: Valid `google-services.json` in the root directory

### 1. Installation
```powershell
# Clone repository and navigate to directory
cd c:\Users\justi\Development\Smart-Flush-Mobile-App

# Install dependencies
npm install
```

### 2. Environment Configuration
Create `.env` from the example template:
```powershell
Copy-Item .env.example .env
```

Ensure the following keys are populated in `.env`:
```env
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDvTCyVj4w9KO0hzWobKy7D_fMrI2iKTTU
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=klir-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=klir-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=klir-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=526260279429
EXPO_PUBLIC_FIREBASE_APP_ID=1:526260279429:android:98d069af9c580bdd7831ec
GOOGLE_SERVICES_JSON=./google-services.json
```

### 3. Running the App
Launch the Expo Development Build on Android:
```powershell
# Run on connected USB device or running emulator
npm run android

# Start the Expo bundler
npm run start:dev
```

---

## 🧪 Build & Verification Scripts

```powershell
# TypeScript compilation check
npm run typecheck

# Execute unit and integration tests
npm test

# Verify restrooms mapping test
npx jest __tests__/unit/restrooms.test.ts

# Expo diagnostic audit
npm run doctor
```

---

## 🛠️ Troubleshooting & FAQs

#### Q1: Why does the app show "Forbidden" snackbar at the bottom?
* **Cause:** The account's role in Firestore is `admin`, `user`, or `null`.
* **Fix:** Ensure the user document at `users/{uid}` in Firestore has `"role": "supervisor"` or `"role": "maintenance"`.

#### Q2: Why did an Admin account see the Maintenance screen?
* **Cause:** Earlier versions defaulted unrecognized roles to the worker tabs.
* **Fix:** The app now enforces strict role isolation in `MainNavigator.tsx`—non-maintenance roles are blocked from technician tabs.

#### Q3: Push notifications are not appearing on my phone.
* **Cause:** Push tokens require physical device execution (emulators lack native FCM hardware support).
* **Fix:** Run `npm run android` on a physical device and ensure notification permissions are granted.

---

*© 2026 Smart Flush / Klir Mobile Team. All rights reserved.*
