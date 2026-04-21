# Klir Mobile

Klir Mobile is an Expo + React Native Android app for Smart Toilet maintenance personnel.

## Stack

- Expo SDK 54
- React Native + TypeScript
- Firebase Authentication
- Firestore
- Expo Notifications
- React Navigation v6
- React Native Paper

## Prerequisites

- Node.js LTS
- Android Studio with Android SDK
- One Android emulator or a physical Android device
- Firebase project credentials
- `google-services.json` for Android

## Project setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Fill in the Firebase values in `.env`.

4. Place `google-services.json` in the project root and keep this in `.env`:

   ```env
   GOOGLE_SERVICES_JSON=./google-services.json
   ```

5. In Firebase Console:

- Enable Email/Password authentication.
- Create a Firestore document at `users/{uid}` with `role: "maintenance"` for each allowed user.

## Local Expo development

Install the Android app on an emulator:

```powershell
npm run android
```

Install the Android app on a physical device:

```powershell
npm run android:device
```

Start the Expo dev server for the development build:

```powershell
npm run start:dev
```

Run general checks:

```powershell
npm run doctor
npm run typecheck
```

## Optional EAS development build

This repo includes [eas.json](./eas.json) with a `development` profile for Android APK builds.

Example:

```powershell
npx eas build --platform android --profile development
```

## Notes

- Use a development build for this project because it relies on native modules such as `expo-notifications`.
- Push notification testing should be done on a physical Android device.
