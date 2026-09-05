# 🚽 Klir Mobile — Smart Facility Sanitation & IoT Dispatch System

> **Enterprise Mobile Client for Smart Flush IoT Ecosystem**  
> *SDCA Annex Campus Edition • 4-Floor Facility Operations • St. Dominic College of Asia*

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-54.0-black.svg?logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage%20%7C%20FCM-orange.svg?logo=firebase)](https://firebase.google.com/)
[![Jest Tests](https://img.shields.io/badge/Tests-20%20Suites%20%7C%20188%20Passed-brightgreen.svg?logo=jest)](#-11-quality-assurance--testing-matrix)
[![UI Library](https://img.shields.io/badge/UI-React%20Native%20Paper%20MD3-purple.svg)](https://callstack.github.io/react-native-paper/)
[![Target OS](https://img.shields.io/badge/Platform-Android%2014%2B%20(Dev%20Client)-green.svg?logo=android)](https://www.android.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#)

---

## 📌 Table of Contents

1. [🏢 Executive Summary & Problem-Solution Framing](#-1-executive-summary--problem-solution-framing)
2. [🏗️ End-to-End System Architecture](#-2-end-to-end-system-architecture)
3. [🗺️ SDCA Annex Facility Master Mapping](#-3-sdca-annex-facility-master-mapping)
4. [👥 Dual-Role System & Access Matrix](#-4-dual-role-system--access-matrix)
5. [📱 Complete Screen & Page Directory (Every Screen Explained)](#-5-complete-screen--page-directory-every-screen-explained)
   - [A. Authentication & Security Gateways](#a-authentication--security-gateways)
   - [B. Technician / Maintenance Workspace](#b-technician--maintenance-workspace)
   - [C. Supervisor Command Hub](#c-supervisor-command-hub)
   - [D. Interactive Sheets & System Modals](#d-interactive-sheets--system-modals)
6. [🧼 The 3-Step Maintenance Execution Workflow](#-6-the-3-step-maintenance-execution-workflow)
7. [📊 Supervisor Compliance Reporting & Data Export System](#-7-supervisor-compliance-reporting--data-export-system)
8. [🚀 The 12 Core Production Engineering Modules](#-8-the-12-core-production-engineering-modules)
9. [🎨 The "Design 3's" System & UX Principles](#-9-the-design-3s-system--ux-principles)
10. [⚙️ Project Setup, Installation & Configuration](#-10-project-setup-installation--configuration)
11. [🧪 Quality Assurance & Testing Matrix](#-11-quality-assurance--testing-matrix)
12. [🛠️ Troubleshooting & Frequently Asked Questions (FAQ)](#-12-troubleshooting--frequently-asked-questions-faq)
13. [📖 Comprehensive Glossary of Technical Terms](#-13-comprehensive-glossary-of-technical-terms)

---

## 🏢 1. Executive Summary & Problem-Solution Framing

### The Real-World Challenge
In large academic campuses such as the **SDCA Annex Building** (St. Dominic College of Asia), restroom facility maintenance typically relies on manual pen-and-paper inspection sheets, static cleaning intervals, or delayed complaints from students and faculty. This traditional model suffers from:
* **Zero Real-Time Visibility:** Facilities staff cannot predict when a toilet clogs, a flush valve sticks, or water runs continuously until physical flooding occurs.
* **Accountability Gaps:** Paper logbooks hung behind restroom doors are frequently pre-signed or lack verifiable proof of cleaning quality and timing.
* **Unbalanced Workload:** Supervisors lack live visibility into which technicians are actively working, idle, or overloaded.
* **Basement & Signal Deadzones:** Technicians working in concrete-reinforced stairwells and ground-floor utility zones lose connectivity, resulting in dropped work orders.

### The Smart Flush Solution
**Klir Mobile** is the mission-critical, human-in-the-loop mobile execution client of the **Smart Flush IoT Platform**. It connects smart hardware sensors embedded in restroom fixtures directly with on-ground maintenance workers and facility supervisors.

```mermaid
flowchart LR
    Sensors["📡 Restroom IoT Sensors<br/>(Flush Counts, Water Flow, UV-C)"] --> AlertEngine["🖥️ Smart Flush Backend<br/>(Telemetry & Threshold Engine)"]
    AlertEngine --> Cloud["🔥 Cloud Firestore & FCM<br/>(Realtime DB & Push Dispatch)"]
    Cloud --> Mobile["📱 Klir Mobile Client<br/>(Android Native / Expo SDK 54)"]
    
    Mobile --> Workers["🛠️ Custodial Technicians<br/>• Instant Work Orders<br/>• 10-Point Checklist<br/>• Watermarked Photo Proofs"]
    Mobile --> Supervisors["👑 Campus Supervisors<br/>• Live Squad Capacity<br/>• Biometric Audit Gates<br/>• Executive PDF/CSV Reports"]
```

### Purpose of this Document
This documentation provides a 360-degree, structured guide designed for **all stakeholders**:
* **Facility Managers & Evaluators:** Understand operational workflows, compliance tracking, and campus facility coverage.
* **Supervisors & Custodians:** Understand daily actions, step-by-step cleaning procedures, and auditing tools.
* **Software Engineers & DevOps:** Understand the architecture, state machines, SWR caching, hardware APIs, and testing infrastructure.

---

## 🏗️ 2. End-to-End System Architecture

Klir Mobile is built on a modern, reactive, offline-first mobile architecture utilizing React Native, Expo, and Google Firebase.

```mermaid
graph TD
    subgraph IoTLayer [Physical Facility Layer - SDCA Annex]
        Hardware[Flush Actuation Sensors • PIR Occupancy • UV-C Modules • Leak Detectors]
    end

    subgraph BackendCloud [Cloud & Communication Layer]
        MQTT[IoT Gateway / MQTT Broker]
        BackendAPI[Smart Flush Node.js Server]
        Firestore[(Google Cloud Firestore)]
        FCM[Firebase Cloud Messaging v1]
        Storage[Firebase Storage - Encrypted Proofs]
    end

    subgraph MobileClient [Klir Mobile Architecture]
        AuthGate[Auth & Role Routing]
        SWRCache[AsyncStorage SWR Offline Engine]
        
        subgraph TechWorkspace [Technician Workspace]
            Inbox[Inbox & Push Alerts]
            ActiveTask[Active Task Hero]
            ThreeStepModal[3-Step Execution Sheet]
            WatermarkEngine[Watermark & Image Compressor]
            LocalAuthTech[Biometric Identity Lock]
        end

        subgraph SupervisorHub [Supervisor Command Hub]
            Dash[Overview & Bento KPIs]
            Roster[Squad Capacity Roster]
            AllTasks[Operational Work Orders]
            ReviewAudit[Biometric Gated QA Review]
            ReportGen[PDF & CSV Compliance Engine]
        end
    end

    Hardware -->|Telemetry & Hardware Faults| MQTT
    MQTT --> BackendAPI
    BackendAPI -->|Generate Work Order| Firestore
    BackendAPI -->|High-Priority Push| FCM

    FCM -->|Push Banner & Deep Link| AuthGate
    Firestore <-->|Realtime Listener & SWR Sync| SWRCache

    AuthGate -->|role: maintenance| TechWorkspace
    AuthGate -->|role: supervisor| SupervisorHub

    ThreeStepModal --> WatermarkEngine
    WatermarkEngine --> LocalAuthTech
    LocalAuthTech -->|Encrypted Proof Upload| Storage
    LocalAuthTech -->|Status: Completed| Firestore

    SupervisorHub -->|Audit & Reassign| Firestore
    ReportGen -->|Native Print & Share| MobileClient
```

### Complete Technology Stack

| Layer | Technology | Version | Purpose in Klir Mobile |
| :--- | :--- | :--- | :--- |
| **Mobile Core** | **React Native** | `0.81.5` | Native Android mobile framework running on modern architecture |
| **Tooling & Engine** | **Expo SDK** | `54.0.34` | Unified runtime, native build orchestration, and module linking |
| **Language** | **TypeScript** | `5.9.2` | 100% strict type safety across all models, screens, and payloads |
| **UI Library** | **React Native Paper** | `5.15.0` | Material Design 3 (MD3) components, surface elevations, and dynamic theming |
| **Navigation** | **React Navigation** | `v6` | Native Stack + Bottom Tabs with deep linking and notification routing |
| **Authentication** | **Firebase Auth** | `^24.0.0` | Secure email/password login and token-based role verification |
| **Database** | **Cloud Firestore** | `^24.0.0` | Real-time bi-directional synchronisation of tasks and personnel rosters |
| **File Storage** | **Firebase Storage** | `^24.0.0` | Encrypted cloud storage for forensic Before/After/Multi-Area proof photos |
| **Push Notifications**| **Firebase Cloud Messaging** | `^24.0.0` | Background, foreground, and lock-screen dispatch work order alerts |
| **Biometric Security**| **expo-local-authentication** | `~17.0.8` | Hardware fingerprint and facial recognition validation |
| **Image Compression**| **expo-image-manipulator** | `~14.0.8` | Client-side 1080p smart image downscaling ($~97\%$ bandwidth savings) |
| **Proof Watermarking**| **react-native-view-shot** | `^5.1.0` | Burn-in metadata (timestamp, room, fixture ID, GPS tag) onto proof photos |
| **Reporting & Export**| **expo-print** & **expo-sharing** | `~15.0.8` | Dynamic HTML-to-PDF rendering and native Android OS file sharing |
| **Local Persistence**| **AsyncStorage** | `2.2.0` | Stale-While-Revalidate (SWR) cache and offline transaction queue |
| **Automated Testing**| **Jest** & **RNTL** | `29.7.0` | Comprehensive unit, integration, and E2E regression suite (188 tests) |

---

## 🗺️ 3. SDCA Annex Facility Master Mapping

The SDCA Annex building contains **22 registered restroom units** and **96 total fixtures/stalls** across 4 floors, plus 1 hardware engineering test unit:

```
🏢 SDCA ANNEX CAMPUS FACILITY LAYOUT
├── 4th Floor ── 6 Restrooms (Left Wing, Right Wing, PWD) ────── 26 Stalls ── [Supervisor Floating Pool]
├── 3rd Floor ── 6 Restrooms (Left Wing, Right Wing, PWD) ────── 26 Stalls ── [Lead: Maria Lindog]
├── 2nd Floor ── 6 Restrooms (Left Wing, Right Wing, PWD) ────── 26 Stalls ── [Lead: Justine Lopez]
├── 1st Floor ── 4 Restrooms (Canteen M/F, Faculty M/F) ──────── 18 Stalls ── [Lead: James Alvarez]
└── Test Lab  ── 1 Hardware Test Unit (toilet-01) ─────────────── 1 Stall  ── [Hardware Test Unit]
                                                         TOTAL: 97 Fixtures
```

### Complete Restroom Master Directory

| Floor | Restroom Name | Device / Unit ID | Stall / Fixture Count | Wing Orientation | Default Assigned Lead |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **1st Floor** | **1F Canteen Male Restroom** | `SDCA-FL1-CANTEEN-M` | 7 | Ground / Canteen Area | **James Alvarez** |
| **1st Floor** | **1F Canteen Female Restroom** | `SDCA-FL1-CANTEEN-F` | 3 | Ground / Canteen Area | **James Alvarez** |
| **1st Floor** | **1F Faculty Male Restroom** | `SDCA-FL1-FACULTY-M` | 6 | Ground / Faculty Lounge | **James Alvarez** |
| **1st Floor** | **1F Faculty Female Restroom** | `SDCA-FL1-FACULTY-F` | 2 | Ground / Faculty Lounge | **James Alvarez** |
| **2nd Floor** | **2F Left Wing Male Restroom** | `SDCA-FL2-M1` | 7 | West Wing (Classrooms) | **Justine Lopez (Tech)** |
| **2nd Floor** | **2F Right Wing Male Restroom** | `SDCA-FL2-M2` | 7 | East Wing (Laboratories) | **Justine Lopez (Tech)** |
| **2nd Floor** | **2F Left Wing Female Restroom** | `SDCA-FL2-F1` | 5 | West Wing (Classrooms) | **Justine Lopez (Tech)** |
| **2nd Floor** | **2F Right Wing Female Restroom** | `SDCA-FL2-F2` | 5 | East Wing (Laboratories) | **Justine Lopez (Tech)** |
| **2nd Floor** | **2F Left Wing PWD Restroom** | `SDCA-FL2-PWD1` | 1 | West Wing (Accessible) | **Justine Lopez (Tech)** |
| **2nd Floor** | **2F Right Wing PWD Restroom** | `SDCA-FL2-PWD2` | 1 | East Wing (Accessible) | **Justine Lopez (Tech)** |
| **3rd Floor** | **3F Left Wing Male Restroom** | `SDCA-FL3-M1` | 7 | West Wing (Classrooms) | **Maria Lindog** |
| **3rd Floor** | **3F Right Wing Male Restroom** | `SDCA-FL3-M2` | 7 | East Wing (Auditorium) | **Maria Lindog** |
| **3rd Floor** | **3F Left Wing Female Restroom** | `SDCA-FL3-F1` | 5 | West Wing (Classrooms) | **Maria Lindog** |
| **3rd Floor** | **3F Right Wing Female Restroom** | `SDCA-FL3-F2` | 5 | East Wing (Auditorium) | **Maria Lindog** |
| **3rd Floor** | **3F Left Wing PWD Restroom** | `SDCA-FL3-PWD1` | 1 | West Wing (Accessible) | **Maria Lindog** |
| **3rd Floor** | **3F Right Wing PWD Restroom** | `SDCA-FL3-PWD2` | 1 | East Wing (Accessible) | **Maria Lindog** |
| **4th Floor** | **4F Left Wing Male Restroom** | `SDCA-FL4-M1` | 7 | West Wing (Admin/Offices) | *Floating / Supervisor Dispatch* |
| **4th Floor** | **4F Right Wing Male Restroom** | `SDCA-FL4-M2` | 7 | East Wing (Offices) | *Floating / Supervisor Dispatch* |
| **4th Floor** | **4F Left Wing Female Restroom** | `SDCA-FL4-F1` | 5 | West Wing (Admin/Offices) | *Floating / Supervisor Dispatch* |
| **4th Floor** | **4F Right Wing Female Restroom** | `SDCA-FL4-F2` | 5 | East Wing (Offices) | *Floating / Supervisor Dispatch* |
| **4th Floor** | **4F Left Wing PWD Restroom** | `SDCA-FL4-PWD1` | 1 | West Wing (Accessible) | *Floating / Supervisor Dispatch* |
| **4th Floor** | **4F Right Wing PWD Restroom** | `SDCA-FL4-PWD2` | 1 | East Wing (Accessible) | *Floating / Supervisor Dispatch* |
| **Test Lab** | **SDCA Annex Test Stall** | `toilet-01` | 1 | Engineering Hardware Bench | *Hardware Test Unit* |

---

## 👥 4. Dual-Role System & Access Matrix

Klir Mobile provides strict role-based isolation. When a user logs in, their profile document in Firestore is verified, establishing access boundaries:

```
                                  ┌─────────────────────────────┐
                                  │      Login & Biometrics     │
                                  └──────────────┬──────────────┘
                                                 │
                                  Evaluate User Profile Role
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        role == "maintenance"                             role == "supervisor"
        ┌──────────────────────────────────┐              ┌──────────────────────────────────┐
        │ 🛠️ CUSTODIAL TECHNICIAN          │              │ 👑 FACILITY SUPERVISOR           │
        │ • Priority Alert Push Inbox      │              │ • Overview Bento KPI Dashboard   │
        │ • Active Work Order Screen       │              │ • Live Squad Roster & Capacity   │
        │ • 3-Step Execution & Checklist   │              │ • All Facility Work Orders       │
        │ • Multi-Area Photo Proof Capture │              │ • Reassignment & Flagging Engine │
        │ • Personal History & Turnaround  │              │ • Biometric QA Review Hub        │
        │ • Offline Sync Auto-Recovery     │              │ • Executive PDF & CSV Exports    │
        └──────────────────────────────────┘              └──────────────────────────────────┘
```

### Feature Comparison Matrix

| Capability / Module | Custodial Technician (`maintenance`) | Field Supervisor (`supervisor`) |
| :--- | :---: | :---: |
| **Receive Real-time IoT Push Alerts** | ✅ (Assigned zone) | ✅ (Campus-wide) |
| **Acknowledge & Accept Work Orders** | ✅ | ❌ (View / Reassign only) |
| **Execute 10-Point Cleaning Checklist** | ✅ | ❌ (Audit only) |
| **Capture Watermarked Proof Photos** | ✅ | ❌ (Inspect in high-res) |
| **View Personal Work Order History** | ✅ (Personal stats) | ✅ (All personnel records) |
| **View Team Availability & Capacity Roster** | ❌ | ✅ (Live status & active tasks) |
| **Reassign Tasks Between Staff Members** | ❌ | ✅ (With conflict locking) |
| **Flag Tasks with Corrective Remarks** | ❌ | ✅ (Triggers worker recheck) |
| **Approve Completed Work Orders** | ❌ | ✅ (Biometrically gated) |
| **Export Official PDF Compliance Reports** | ❌ | ✅ (Branded SDCA template) |
| **Export RFC 4180 CSV Spreadsheets** | ❌ | ✅ (17 audit columns) |

### Live User Directory & Test Accounts

| Full Name | Login Email | Assigned Role | Assigned Campus Floor / Zone | Default Landing View |
| :--- | :--- | :---: | :--- | :--- |
| **Justine Lopez** | `justine.lopez@sdca.edu.ph` | **`supervisor`** | **SDCA Annex Building (All Floors 1–4)** | **Supervisor Dashboard** |
| **James Alvarez** | `james@gmail.com` | **`maintenance`** | **1st Floor** (Canteen & Faculty Restrooms) | **Technician Inbox** |
| **Justine Lopez (Tech)** | `justine@gmail.com` | **`maintenance`** | **2nd Floor** (Left/Right Wings & PWD) | **Technician Inbox** |
| **Maria Lindog** | `maria@gmail.com` | **`maintenance`** | **3rd Floor** (Left/Right Wings & PWD) | **Technician Inbox** |

---

## 📱 5. Complete Screen & Page Directory (Every Screen Explained)

Klir Mobile comprises **13 dedicated screen views** and **5 shared system overlays**. Below is an exhaustive breakdown of every view in the system, explaining what users see, why it exists, and how it behaves.

```
📁 APPLICATION NAVIGATION STRUCTURE
├── 🔑 Authentication Stack
│   ├── [1] LoginScreen (Email/Password + Biometric Vault Quick Unlock)
│   └── [2] ForgotPasswordScreen (Firebase Password Reset Dispatcher)
│
├── 🛠️ Technician Navigation (Bottom Tabs)
│   ├── 📥 Inbox Tab
│   │   ├── [3] InboxScreen (Triple-Filter Feed + Emergency Alert Card)
│   │   └── [5] TaskDetailScreen (Full-Screen Task View & Execution)
│   ├── 📋 Active Task Tab
│   │   ├── [4] ActiveTaskScreen (Hero Card of In-Progress Assignment)
│   │   └── [5] TaskDetailScreen (Deep Execution & Checklist Flow)
│   └── 🕒 History Tab
│       ├── [6] HistoryScreen (Completed Logs, Turnaround Times & Search)
│       └── [5] TaskDetailScreen (Read-Only Inspection of Past Submissions)
│
├── 👑 Supervisor Stack (Native Stack Navigator)
│   ├── [7] SupervisorDashboardScreen (Bento KPIs, Squad Capacity, Menu)
│   ├── [8] TeamAvailabilityScreen (Live Staff Roster & Operational Status)
│   ├── [9] SupervisorTasksScreen (Facility Work Order Master Board)
│   ├── [10] SupervisorTaskDetailScreen (Live Monitor, Reassign, Flagging)
│   ├── [11] CompletedReviewsScreen (Biometric/Password Gated QA List)
│   ├── [12] CompletedReviewDetailScreen (Before/After & Area Photo Audit)
│   └── [13] SupervisorReportsScreen (Compliance Metrics, PDF & CSV Export)
│
└── 🪟 Shared Interactive Overlays & Modals
    ├── [14] TaskExecutionModal (3-Step Bottom Sheet for Field Work)
    ├── [15] ImageViewerModal (Fullscreen Zoomable Photo Inspector)
    ├── [16] ProfileSheetModal (User Identity, Zone & Sign-Out Sheet)
    ├── [17] FlaggedRemarksModal (Supervisor Recheck Reason Dialog)
    └── [18] SupervisorAuthDialog (Master Password Fallback Gateway)
```

---

### A. Authentication & Security Gateways

#### 1. Login Screen (`LoginScreen.tsx`)
* **Audience:** All users (Custodians and Supervisors).
* **Route:** `AuthNavigator` $\rightarrow$ `Login`.
* **Purpose:** Acts as the primary security checkpoint. It authenticates credentials with Firebase Auth, securely queries the user's role from Firestore, and routes them to their specialized workspace.
* **Key Visual Elements:**
  * Klir brand mark and SDCA institutional title.
  * Email input with format validation.
  * Password input with eye toggle to show/hide plaintext.
  * **`[ Quick Biometric Unlock ]` Button:** Enables 1-tap login via Android Fingerprint or Face Unlock if credentials were previously saved in `@klir:biometric_vault`.
  * **`[ Sign In ]` Button:** High-contrast crimson action button.
  * "Forgot Password?" navigation link.
* **Safeguards:** Disables input during network calls; displays clear error messages for invalid credentials, unassigned roles, or inactive network.

#### 2. Forgot Password Screen (`ForgotPasswordScreen.tsx`)
* **Audience:** All users.
* **Route:** `AuthNavigator` $\rightarrow$ `ForgotPassword`.
* **Purpose:** Allows staff members to initiate a secure self-service password reset.
* **Key Visual Elements:**
  * Clean instructional header explaining the reset procedure.
  * Institutional email input.
  * `[ Send Reset Link ]` CTA button.
  * Instant navigation link back to the login screen.
* **Safeguards:** Sends a standardized password reset link via Firebase Auth; prevents submission of malformed emails.

---

### B. Technician / Maintenance Workspace

#### 3. Primary Alert Inbox Screen (`InboxScreen.tsx`)
* **Audience:** Custodial Technicians (`role: maintenance`).
* **Route:** `MainNavigator` $\rightarrow$ `InboxTab` $\rightarrow$ `InboxHome`.
* **Purpose:** The daily operational hub for technicians. It receives real-time IoT alerts and scheduled work orders, displaying them in priority order.
* **Key Visual Elements:**
  * **Emergency Priority Card:** When an IoT hardware failure occurs (e.g. pump failure, continuous flush, severe leak), a vibrant red priority banner docks at the top with an immediate `[ Open Priority Task → ]` button.
  * **Segmented Triple-Filter Tabs:**
    * **`All`**: Complete list of tasks assigned to this technician or their floor zone.
    * **`Active`**: Tasks currently accepted and in progress (`acknowledged` or `rechecking`).
    * **`Flagged`**: Work orders returned by the supervisor requiring corrective re-inspection.
  * **Task Cards:** Display restroom name, floor, fixture ID, urgency badge (`Critical`, `High`, `Normal`), relative timestamp (`2m ago`), and single-tap action buttons (`[ Acknowledge & Start ]` or `[ Review Remarks & Accept Recheck ]`).
* **Safeguards:** Strict deduplication ensures identical tasks never appear twice; pull-to-refresh provides instant manual sync.

#### 4. Active Task Screen (`ActiveTaskScreen.tsx`)
* **Audience:** Custodial Technicians.
* **Route:** `MainNavigator` $\rightarrow$ `TaskTab` $\rightarrow$ `ActiveTask`.
* **Purpose:** A single-focus workstation showing the technician's currently active work order, preventing distraction from new unacknowledged alerts.
* **Key Visual Elements:**
  * **Unified Hero Card:** High-contrast card with location breadcrumb (`2F • 2F Male Restroom • SDCA Annex`), device ID, and priority badge.
  * **Instruction Callout Box:** Warm amber box detailing the exact issue (e.g., *"Flush actuation threshold exceeded 40 cycles. Inspect flush valve, disinfect bowl, and record water pressure."*).
  * **Assigned Squad Avatars:** Displays technician initials with gold border.
  * **Primary Action CTA:** `[ Resume Task & Take Proofs ]` launching the 3-step modal.
  * **Empty State:** Clean, friendly display when no work is currently in progress.

#### 5. Full Task Detail Screen (`TaskDetailScreen.tsx`)
* **Audience:** Custodial Technicians (and Supervisors in audit mode).
* **Route:** `InboxStack` / `HistoryStack` $\rightarrow$ `TaskDetail`.
* **Purpose:** Comprehensive, full-page execution view providing an alternative to the modal workflow. Supports full checklist verification, camera capture, and submission.
* **Key Visual Elements:**
  * **Segmented Flow Header:** Visual indicator showing progression through **Details**, **Checklist**, and **Summary**.
  * **Full Checklist Accordion:** Categorized items (Dusting, Fixtures, Disinfection) with quick toggles.
  * **1-Tap Quick Action:** Shows `[ Check All as Done (1-Tap) ]` when incomplete, and `[ Reset All Items ]` when done.
  * **Camera Capture Frames:** High-resolution preview viewports with active timestamp watermarks.
* **Safeguards:** Prevents submission until 100% of checklist items are marked and initial photo proof is captured.

#### 6. Task History & Analytics Screen (`HistoryScreen.tsx`)
* **Audience:** Custodial Technicians.
* **Route:** `MainNavigator` $\rightarrow$ `HistoryTab` $\rightarrow$ `HistoryHome`.
* **Purpose:** Allows technicians to review their completed work, inspect before/after photos, and track personal performance metrics.
* **Key Visual Elements:**
  * **Performance KPI Banner:**
    * **Completed Tasks:** Total work orders resolved.
    * **Average Turnaround:** Mean time from task acceptance to completion.
    * **Compliance Rate:** Percentage of tasks submitted with full biometric and checklist compliance.
  * **Timeframe Filters:** Quick pills for **Today**, **7 Days**, and **All**.
  * **Real-time Search Bar:** Filter by restroom name, fixture ID, or task description.
  * **History Card Feed:** Displays completion time, duration pill (`12 min 30 sec`), Before/After image thumbnail pairs, and biometric verified badges.

---

### C. Supervisor Command Hub

#### 7. Supervisor Command Dashboard (`SupervisorDashboardScreen`)
* **Audience:** Campus Supervisors (`role: supervisor`).
* **Route:** `SupervisorStack` $\rightarrow$ `SupervisorDashboard`.
* **Purpose:** Executive command center providing real-time facility health, squad capacity, and direct access to all management modules.
* **Key Visual Elements:**
  * **Bento Metric Grid:**
    * **Active Tasks:** Live counter of unresolved facility work orders.
    * **Unassigned Tasks:** High-urgency alert counter showing tasks waiting for technician assignment.
  * **Squad Capacity Bar:** Interactive horizontal bar displaying live staff counts: 🟢 **Available**, 🔴 **On Task**, and ⚪ **Offline**.
  * **Grouped Action Menu:**
    * **`Tasks`**: Opens the facility-wide work order board.
    * **`Team`**: Opens the live squad roster.
    * **`Completed Tasks`**: Gated entry to QA reviews (requires biometric authentication).
    * **`Reports & Export`**: Opens compliance reporting and PDF/CSV export tools.
* **Safeguards:** Pull-to-refresh triggers simultaneous Firestore and backend sync.

#### 8. Live Team Availability Roster (`TeamAvailabilityScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `TeamAvailability`.
* **Purpose:** Displays live operational status and assignments for all custodial staff members across the SDCA Annex.
* **Key Visual Elements:**
  * **Segmented Status Filter:** Filter staff by **All**, **Available**, or **On Task**.
  * **Technician Roster Cards:**
    * Full name, employee email, and campus building assignment.
    * Real-time status pill: 🟢 `Available` (ready for dispatch), 🔴 `On Task` (actively working), or ⚪ `Offline`.
    * Active assignment callout showing current restroom location and elapsed working time.
    * One-tap phone/email quick-contact links.

#### 9. Facility Work Orders Board (`SupervisorTasksScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `SupervisorTasks`.
* **Purpose:** Comprehensive list of all active, pending, and flagged work orders across the entire 4-floor campus.
* **Key Visual Elements:**
  * Status chips to filter by Unassigned, In-Progress, Flagged, or All.
  * Card metadata highlighting floor, fixture, trigger type (IoT sensor vs. scheduled), and assigned technician.
  * Direct action buttons to reassign work orders or open task details.

#### 10. Supervisor Task Detail & Dispatch (`SupervisorTaskDetailScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `SupervisorTaskDetail`.
* **Purpose:** In-depth inspection view of an active or unassigned work order with manual intervention controls.
* **Key Visual Elements:**
  * Full restroom telemetry, device IDs, and sensor trigger readings.
  * Current assignee status and elapsed response time.
  * **`[ Reassign Task ]` Button:** Opens the technician reallocation modal with reason logging.
  * **`[ Flag Task ]` Button:** Allows supervisors to flag issues requiring immediate escalation.
* **Safeguards:** Locks tasks once acknowledged to prevent conflicting simultaneous reassignments (`409 Conflict`).

#### 11. Completed Reviews QA Hub (`CompletedReviewsScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `CompletedReviews` *(Gated behind Biometric Authentication)*.
* **Purpose:** High-security quality assurance portal where supervisors inspect work orders submitted by custodial staff before closing them.
* **Key Visual Elements:**
  * Timeframe filter pills (**Today**, **7 Days**, **30 Days**, **All**).
  * Review status chips: 🟡 `Pending Review`, 🟢 `Approved`, and 🔴 `Flagged for Recheck`.
  * Task cards showing technician name, completion time, duration, and Before/After photo thumbnails.

#### 12. Forensic Review & Approval Detail (`CompletedReviewDetailScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `CompletedReviewDetail`.
* **Purpose:** Deep forensic audit view. Supervisors inspect photographic proof, verify burned timestamps, review checklist completion, and issue official approvals or flags.
* **Key Visual Elements:**
  * **Side-by-Side Photo Comparison:** High-resolution Before & After photos with tap-to-zoom.
  * **Multi-Area Photo Carousel:** Horizontal gallery showing additional area photos (Stall 1, Stall 2, Urinals, Sink, Floor Drain) with burned watermark metadata.
  * **SDCA F-TGS 203 Checklist Audit:** Verified list of all 10 items marked `Done` or `N/A`.
  * **Audit Actions:**
    * **`[ Approve Task ]`**: Marks task as officially verified and closes the work order.
    * **`[ Flag for Recheck ]`**: Opens remarks dialog, returning the task to the technician's inbox.

#### 13. Compliance Reports & Data Export (`SupervisorReportsScreen`)
* **Audience:** Campus Supervisors.
* **Route:** `SupervisorStack` $\rightarrow$ `SupervisorReports`.
* **Purpose:** Executive compliance and data export hub. Generates institutional compliance summaries, calculates resolution metrics, and exports data to official PDF or CSV files.
* **Key Visual Elements:**
  * **Timeframe Selector:** Filter metrics and records by **Today**, **7 Days**, **30 Days**, or **All Time**.
  * **Executive Compliance Summary Grid:**
    * **Compliance Rate (%):** Proportion of tasks meeting full photographic and biometric standards.
    * **Average Turnaround:** Mean completion duration from dispatch to submission.
    * **Average Response Time:** Mean time between alert generation and technician acknowledgement.
    * **Biometric Verification (%):** Share of tasks confirmed via hardware fingerprint/face ID.
  * **Export Actions:**
    * **`[ Export PDF Compliance Report ]`**: Generates a publication-quality SDCA institutional PDF report and opens the native Android share/print sheet.
    * **`[ Export CSV Audit Log ]`**: Generates an RFC 4180 compliant spreadsheet containing 17 operational audit columns.
  * **Completed Tasks Record Feed:** Scrollable audit trail of all tasks included in the report.

---

### D. Interactive Sheets & System Modals

#### 14. 3-Step Guided Task Execution Sheet (`TaskExecutionModal.tsx`)
* **Audience:** Custodial Technicians.
* **Trigger:** Tapping `[ Acknowledge & Start ]` or `[ Resume Task ]`.
* **Design Pattern:** Ergonomic bottom sheet modal that preserves screen context.
* **Workflow Steps:**
  1. **Step 1 — Arrival Proof:** Wide camera viewfinder frame with live watermark tags and camera trigger.
  2. **Step 2 — 10-Point Checklist:** Categorized SDCA F-TGS 203 checklist with progress bar and 1-tap "Check All / Reset".
  3. **Step 3 — Dual Evidence & Biometrics:** Before/After photo comparison, multi-area photo attachments, technician notes, and biometric confirmation.

#### 15. Fullscreen Zoom Image Viewer (`ImageViewerModal.tsx`)
* **Audience:** Custodians and Supervisors.
* **Trigger:** Tapping any photo thumbnail across the application.
* **Capabilities:** Fullscreen black backdrop, pinch-to-zoom, pan, double-tap to reset, and display of burned metadata tags.

#### 16. User Profile & Building Sheet (`ProfileSheetModal.tsx`)
* **Audience:** All authenticated users.
* **Trigger:** Tapping the user avatar in the top navigation header.
* **Capabilities:** Displays user full name, email, operational role, assigned building, active task count, app build version, and secure `[ Sign Out ]` CTA.

#### 17. Flagging & Recheck Reason Dialog (`FlaggedRemarksModal.tsx`)
* **Audience:** Campus Supervisors.
* **Trigger:** Tapping `[ Flag for Recheck ]` in the review screen.
* **Capabilities:** Quick-select radio buttons for common issues (*"Incomplete sanitization"*, *"Water puddles remaining"*, *"Missed trash bin"*, *"Unclear proof photo"*) plus custom text remarks field.

#### 18. Supervisor Biometric / Password Security Gate (`SupervisorAuthDialog`)
* **Audience:** Campus Supervisors.
* **Trigger:** Attempting to access Completed Reviews or QA records.
* **Capabilities:** Prompts for Android fingerprint/face authentication. If biometrics fail or are not enrolled, automatically provides a secure password fallback modal to protect sensitive audit records.

---

## 🧼 6. The 3-Step Maintenance Execution Workflow

To ensure reliable sanitization and consistent proof-of-work, every custodial work order follows a standardized 3-step lifecycle:

```
┌───────────────────────────┐       ┌───────────────────────────┐       ┌───────────────────────────┐
│ STEP 1: ARRIVAL PROOF     │ ----> │ STEP 2: 10-PT CHECKLIST   │ ----> │ STEP 3: EVIDENCE & SUBMIT │
│ • Wide Doorway Photo      │       │ • SDCA F-TGS 203 Form     │       │ • After Photo + Carousel  │
│ • Timestamp Burn-in       │       │ • 1-Tap "Check All/Reset" │       │ • Multi-Area Attachments  │
│ • Location Watermark      │       │ • Category Progress Bar   │       │ • Biometric Identity Sign │
└───────────────────────────┘       └───────────────────────────┘       └───────────────────────────┘
```

### Step 1: Arrival Proof Photo
* Technician arrives at the designated restroom.
* Camera launches via native viewfinder overlay.
* Captures a wide doorway shot documenting initial restroom condition before cleaning commences.
* System automatically burns forensic metadata into the photo:
  * Restroom Name (e.g. `2F Left Wing Male Restroom`)
  * Device ID (`SDCA-FL2-M1`)
  * GPS coordinates & Building (`SDCA Annex Building`)
  * Exact Date & Time down to the second

### Step 2: The SDCA F-TGS 203 10-Point Checklist
Custodians complete 10 standardized maintenance tasks organized into 3 logical categories:

```
🧹 DUSTING & PREPARATION
 1. Remove dust and cobwebs on ceilings
 2. Remove dust and cobwebs on walls
 3. Remove dust and cobwebs on light bulbs
 4. Clean windows and glass partitions

🚽 FIXTURES & FLOORS
 5. Wipe down, scrub, and sanitize fixtures (toilets, urinals, sinks)
 6. Sweep and dry mop floors (no standing water puddles)
 7. Arrange and align restroom fixtures & accessories

🛡️ DISINFECTION & WASTE
 8. Disinfect high-touch surfaces (faucets, flush levers, door handles)
 9. Empty trash bins and replace liners
10. Disinfect using UV-C light sterilization modules
```

* **1-Tap Quick Action:** When time is critical, custodians can tap `[ Check All as Done (1-Tap) ]` to toggle all 10 items to `Done`. If tapped again, it resets all items for manual verification.

### Step 3: Evidence Comparison, Multi-Area Gallery & Biometric Sign-off
* **After Photo Capture:** Technician captures the final clean condition.
* **Side-by-Side Verification:** App displays Before and After photos side-by-side for comparison.
* **Multi-Area Photo Proofs:** Technicians can attach up to 3 additional photos tagged with specific room areas:
  * `Stall 1` • `Stall 2` • `Urinals` • `Sink & Counter` • `Mirror` • `Floor Drain` • `Supplies & Dispensers`
* **Biometric Identity Lock:** Tapping `[ Complete & Verify Biometrics 🔒 ]` prompts for the technician's fingerprint or face scan, cryptographically stamping their identity into the completion record.
* **Offline Resilience:** If network connection is lost, the complete package (photos, checklist, watermarks, timestamps) is saved locally and queued for automatic upload upon reconnection.

---

## 📊 7. Supervisor Compliance Reporting & Data Export System

Supervisors can generate audit reports and export data directly from the **Reports & Export** screen (`SupervisorReportsScreen`).

```mermaid
flowchart TD
    SelectFilter[Supervisor Selects Timeframe<br/>Today • 7 Days • 30 Days • All Time] --> FetchData[Aggregate Completed Tasks & Calculate KPIs]
    
    FetchData --> SummaryView[Render Executive Compliance Dashboard<br/>Compliance % • Avg Duration • Avg Response • Biometric %]
    
    SummaryView --> Choice{Choose Export Format}
    
    Choice -->|PDF Document| HTMLTemplate[Populate SDCA Branded HTML Template]
    HTMLTemplate --> PrintEngine[expo-print: Compile to PDF]
    PrintEngine --> SharePDF[expo-sharing: Open Android Share Sheet<br/>Print • Drive • Gmail • WhatsApp]
    
    Choice -->|CSV Spreadsheet| CSVBuilder[Format RFC 4180 17-Column Data String]
    CSVBuilder --> FileSystem[expo-file-system: Write to Cache]
    FileSystem --> ShareCSV[expo-sharing: Share CSV Spreadsheet]
```

### Executive KPI Summary Metrics

| Metric | Calculation / Definition | Operational Significance |
| :--- | :--- | :--- |
| **Total Completed** | Count of all resolved work orders within timeframe | Workload volume tracking |
| **Compliance Rate** | Percentage of tasks with verified checklist & photo proofs | Institutional quality benchmark |
| **Average Turnaround** | Mean time from task acceptance (`acknowledgedAt`) to completion (`completedAt`) | Cleaning efficiency measurement |
| **Average Response** | Mean time from alert generation (`createdAt`) to acknowledgement (`acknowledgedAt`) | Squad dispatch responsiveness |
| **Biometric Verification** | Percentage of submissions signed with hardware biometric verification | Fraud prevention & audit integrity |
| **Approved vs. Flagged** | Ratio of tasks passed on first inspection vs. returned for re-cleaning | Quality consistency indicator |

### Export Formats

#### 1. Official SDCA PDF Compliance Report (`expo-print`)
* Generates a formal, printable PDF document bearing the **St. Dominic College of Asia** institutional header.
* Contains the executive summary banner, KPI metric cards, and a detailed audit table of all completed work orders.
* Opens the native Android sharing dialog for instant printing, emailing, or saving to Google Drive.

#### 2. RFC 4180 CSV Spreadsheet Export (`expo-file-system`)
* Exports a standard CSV file with 17 operational audit columns:
  1. `Task ID` • 2. `Restroom / Location` • 3. `Floor` • 4. `Building` • 5. `Component` • 6. `Trigger Type` • 7. `Technician(s)` • 8. `Created At` • 9. `Completed At` • 10. `Work Duration (Seconds)` • 11. `Biometric Verified` • 12. `Inspection Status` • 13. `Inspected By` • 14. `Inspected At` • 15. `Flag Reason` • 16. `Recheck Count` • 17. `Remarks`

---

## 🚀 8. The 12 Core Production Engineering Modules

### 1. Real IoT Hardware Failure Detection & UV Anti-Spam
* Telemetry alarms (valve stuck open, pump failure, sensor disconnect) automatically evaluate against alert thresholds to generate high-urgency work orders.
* `hasActiveHardwareTask` debouncing prevents task flooding when sensors trigger continuously.

### 2. Strict Deduplication & Triple-Tab Inbox Engine
* Custom `deduplicateTasks()` logic guarantees that SWR cache merges and Firestore snapshots never render duplicate task cards.
* Dedicated tabs for **All**, **Active**, and **Flagged** tasks with customized empty states.

### 3. Conflict-Free Task Reassignment Engine & Worker Locking
* Tasks are locked once acknowledged or completed to prevent conflicting reassignments (`409 Conflict`).
* When a supervisor reassigns an unacknowledged task, the previous technician's state is released (`isAvailable = true`), the new assignee is locked, and an FCM push notification is dispatched.

### 4. Zero-Flicker SWR & Instant 0ms Cache Hydration
* On startup, the app instantly hydrates state from local cache (`@klir:technician_tasks` and `@klir:supervisor_tasks`) in 0ms.
* Background revalidation updates the UI without full-screen loading spinners or layout jumps.

### 5. 1-Tap SDCA F-TGS 203 Sanitation Checklist
* Streamlined checklist interface in `TaskExecutionModal.tsx` and `TaskDetailScreen.tsx`.
* Provides a quick toggle: `[ Check All as Done (1-Tap) ]` when incomplete, and `[ Reset All Items ]` when all 10 items are marked.

### 6. Forensic Timestamp & Location Watermark Engine
* Before and After photos are stamped with verifiable metadata (timestamp, floor, device ID, room name) using `react-native-view-shot` before upload.

### 7. Multi-Area Proof Photo Gallery with Fixture Tagging
* Technicians can attach up to 3 additional area photos (Stall 1, Stall 2, Urinals, Sink, Floor Drain) to verify thorough cleaning across large restrooms.

### 8. Smart Client-Side Image Compression Pipeline
* High-resolution camera photos (~5MB) are automatically downscaled to 1080px width at 75% JPEG quality via `expo-image-manipulator`.
* Reduces file sizes to ~140KB (~97% reduction), enabling fast uploads even on poor campus Wi-Fi while preserving watermark legibility.

### 9. Biometric Vault & Hardware Security Gate
* Sensitive operations (QA review access, task completion) are protected behind `LocalAuthentication.authenticateAsync`.
* Provides a secure password fallback dialog when biometric hardware is unavailable.

### 10. Multi-Assignee & Broadcast Team Safeguards
* For team-wide broadcast tasks (`assignedToIds.length > 1`), individual technician contributions are recorded independently under `submissions[uid]`.
* Prevents team members from overwriting each other's work orders.

### 11. Offline-First Synchronization Engine
* Tasks completed without cellular or Wi-Fi connectivity are stored in local `AsyncStorage`.
* `OfflineSyncContext` listens to network state changes via `Network.addNetworkStateListener` and automatically uploads queued tasks upon reconnection.

### 12. Executive Compliance Reports & Native PDF/CSV Export Engine
* Fully integrated reporting engine generating institutional SDCA PDF compliance certificates and RFC 4180 CSV spreadsheets with native Android sharing.

---

## 🎨 9. The "Design 3's" System & UX Principles

Klir Mobile is designed according to the **"Design 3's"** framework, tailored for field technicians working in challenging physical environments (wet floors, protective gear, low light).

```
                      ┌─────────────────────────────────────────┐
                      │            THE "DESIGN 3's"             │
                      └────────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
  ┌──────────────┐                  ┌──────────────┐                  ┌──────────────┐
  │   PILLAR 1   │                  │   PILLAR 2   │                  │   PILLAR 3   │
  │ Design       │                  │ Design       │                  │ Design       │
  │ Pattern      │                  │ Rule         │                  │ Psychology   │
  └──────┬───────┘                  └──────┬───────┘                  └──────┬───────┘
         │                                 │                                 │
  • Single Unified Card             • Zero Redundancy                 • 0.5s Glanceability
  • Progressive Sheets              • High-Contrast Solid Tones       • Thumb-Zone Reach
  • Single-Row Header               • Single Dismiss Affordance       • Polling Isolation
```

### The 3 Core Laws
1. **"Less, but better" (*Weniger, aber besser*):** Every element, border, and badge must serve an operational purpose. Redundant visual noise is eliminated.
2. **The 0.5-Second Glanceability Rule:** A technician must be able to absorb critical location, urgency, and instructions in under half a second.
3. **Ergonomic Progressive Disclosure:** Multi-step workflows (photos, 10-point checklist, biometrics) unfold sequentially through bottom sheets rather than disorienting full-screen jumps.

### Brand Design Tokens (`components/MaintenanceUI.tsx`)

| Token Category | Token Name | Value | Usage |
| :--- | :--- | :--- | :--- |
| **Color** | `primary` | `#B5121B` | Primary action buttons, brand accents, active tab icons |
| **Color** | `primaryDark` | `#8F0D16` | Pressed button states, critical alert borders |
| **Color** | `primarySoft` | `#FEE2E2` | Hardware failure alert container backgrounds |
| **Color** | `gold` | `#C9A227` | Supervisor badges, shift indicators, secondary accents |
| **Color** | `goldSurface` | `#FEF9E7` | Task instruction callout box background |
| **Color** | `charcoal` | `#222222` | H1/H2 headlines, primary text, card titles |
| **Color** | `slateMuted` | `#666666` | Timestamps, secondary subtitles, location breadcrumbs |
| **Color** | `canvas` | `#F3F3F3` | App background surface |
| **Color** | `success` | `#16A34A` | Completed status pills, biometric verified badges |
| **Radius** | `tag` | `6dp` | Operational status tags and state indicators |
| **Radius** | `chip` | `8dp` | Filter buttons and avatar chips |
| **Radius** | `card` | `14dp` | Primary task cards and container surfaces |
| **Radius** | `sheet` | `20dp` | Modal bottom sheet containers |

---

## ⚙️ 10. Project Setup, Installation & Configuration

### Prerequisites
* **Node.js:** `v18.x` or `v20.x` LTS
* **Java Development Kit (JDK):** Version 17 (recommended for Expo SDK 54 / Android Gradle)
* **Android Studio:** Android SDK Build-Tools 34+, Android 14 (API 34) target platform
* **Google Services:** `google-services.json` placed in the project root directory

### 1. Installation
```powershell
# Clone the repository
git clone https://github.com/JamesCarl04/Smart-Flush-Mobile-App.git
cd Smart-Flush-Mobile-App

# Install dependencies
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root directory:

```env
# Backend API Base URL (Node.js Smart Flush Server)
EXPO_PUBLIC_API_URL=http://<YOUR_BACKEND_IP>:3000

# Firebase Project Credentials (SDCA Klir Production / Staging)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyDvTCyVj4w9KO0hzWobKy7D_fMrI2iKTTU
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=klir-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=klir-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=klir-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=526260279429
EXPO_PUBLIC_FIREBASE_APP_ID=1:526260279429:android:98d069af9c580bdd7831ec

# Path to Android Google Services configuration
GOOGLE_SERVICES_JSON=./google-services.json
```

### 3. Running the App
```powershell
# Start the Metro Bundler
npm run start:dev

# Launch on connected Android device or emulator
npm run android

# Target a specific connected physical device
npm run android:device
```

### 4. Building Standalone APKs (EAS Build)
```powershell
# Build preview standalone APK for testing
npm run build:apk

# Build development client APK
npm run build:dev
```

---

## 🧪 11. Quality Assurance & Testing Matrix

Klir Mobile maintains a comprehensive test suite of **20 test suites** and **188 automated tests** covering unit logic, integration contexts, and end-to-end user journeys:

```powershell
# Run the complete test suite (20 suites, 188 tests)
npm test

# Run TypeScript strict typecheck (zero errors enforced)
npm run typecheck

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run end-to-end flow tests only
npm run test:e2e

# Run test coverage report
npm run test:coverage

# Run Expo diagnostic health check
npm run doctor
```

### Test Suite Architecture

```
__tests__/
├── e2e/
│   ├── OfflineResilienceFlow.test.tsx      # Network drop, local queueing & auto-sync
│   ├── SupervisorOperationsFlow.test.tsx   # Dashboard, reassign, flag & export flows
│   └── WorkerTaskLifecycleFlow.test.tsx    # Inbox -> Acknowledge -> Checklist -> Biometrics
│
├── integration/
│   ├── AuthContext.test.tsx                # Role verification & unauthorized auto sign-out
│   ├── OfflineSyncContext.test.tsx         # NetInfo listener & background queue flushing
│   ├── TaskExecutionModal.test.tsx         # 3-step modal state, photos & 1-tap checklist
│   ├── TasksContext.test.tsx               # SWR hydration & Firestore snapshot updates
│   └── screens/
│       ├── HistoryScreen.test.tsx          # Range filtering, search & metrics calculation
│       ├── InboxScreen.test.tsx            # Emergency alert card, filters & deduplication
│       ├── LoginScreen.test.tsx            # Form validation, biometrics & role routing
│       ├── SupervisorScreens.test.tsx      # Bento KPIs, squad capacity, reviews & reports
│       └── TaskDetailScreen.test.tsx       # 3-step full-screen flow & area photo tags
│
└── unit/
    ├── MaintenanceUI.test.ts               # Design tokens, color contrast & badge logic
    ├── api.test.ts                         # Authenticated fetch client & token attachment
    ├── report-export.test.ts               # CSV generation & PDF input formatting
    ├── restrooms.test.ts                   # 22-room SDCA facility mapping & fixture counts
    ├── supervisor-api.test.ts              # Reassignment, flagging & approval endpoints
    ├── task-api.test.ts                    # Acknowledgement & completion API contracts
    ├── task-completion.test.ts             # Image compression & offline storage queue
    └── tasks.test.ts                       # Document parsers, status formatters & checklist
```

---

## 🛠️ 12. Troubleshooting & Frequently Asked Questions (FAQ)

#### Q1: Why does the app display an empty screen or say "Unauthorized Role"?
* **Cause:** The authenticated user document in Cloud Firestore (`users/{uid}`) is missing the `"role"` attribute.
* **Resolution:** In the Firestore Console, verify that the user document contains `"role": "supervisor"` or `"role": "maintenance"`.

#### Q2: Why does Biometric Authentication fail or not appear?
* **Cause:** The device or emulator does not have a fingerprint or PIN enrolled in Android System Settings.
* **Resolution:** Navigate to **Android Settings $\rightarrow$ Security $\rightarrow$ Fingerprint / Screen Lock** and register at least one fingerprint. Alternatively, use the master supervisor password fallback modal.

#### Q3: Push notifications are not appearing on my Android Emulator.
* **Cause:** Standard Android Virtual Devices (AVDs) without Google Play Services cannot register native FCM tokens.
* **Resolution:** Use an emulator image that includes the **Google Play Store** icon, or test on a physical Android device connected via USB.

#### Q4: Why are captured photos rotated or very slow to upload?
* **Cause:** Uncompressed camera photos on modern devices exceed 12 megapixels (~5MB).
* **Resolution:** Klir Mobile automatically routes photos through `ImageManipulator.manipulateAsync`, downscaling images to 1080px width at 75% JPEG quality. Ensure device storage is not completely full.

#### Q5: PowerShell blocks running scripts (`npm run android` fails).
* **Cause:** Windows PowerShell Execution Policy restricts running npm scripts.
* **Resolution:** Run this command in an administrative PowerShell terminal:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
  ```

---

## 📖 13. Comprehensive Glossary of Technical Terms

* **SDCA:** St. Dominic College of Asia (Bacoor, Cavite, Philippines).
* **IoT (Internet of Things):** Network of physical hardware devices (sensors, smart flush valves, water flow meters) communicating data to cloud servers.
* **FCM (Firebase Cloud Messaging):** Google's cross-platform messaging service used by Klir to dispatch instant push notifications to technicians.
* **SWR (Stale-While-Revalidate):** A cache strategy where cached data is shown instantly (0ms) while fresh data is revalidated in the background.
* **Firestore:** Google Cloud's NoSQL real-time document database that synchronizes work order state between devices.
* **Biometric Authentication:** Hardware verification using fingerprint or facial recognition via Android BiometricPrompt API.
* **UV-C Sterilization:** Ultraviolet-C light disinfection modules embedded in smart restroom stalls to neutralize pathogens.
* **PWD Restroom:** Restroom specifically designed and reserved for Persons With Disabilities.
* **RFC 4180:** The official standard format for Comma-Separated Values (CSV) spreadsheets.
* **Dev Client:** A custom Expo development build containing native Android libraries (camera, biometrics, notifications) compiled for development.

---

*© 2026 Smart Flush / Klir Mobile Team • St. Dominic College of Asia (SDCA) Facility Operations. All rights reserved.*
