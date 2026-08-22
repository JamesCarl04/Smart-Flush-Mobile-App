import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { getAuth, type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getStorage, type FirebaseStorageTypes } from '@react-native-firebase/storage';

import { getRequiredConfigValue, runtimeConfig } from './config';

const firebaseConfig = {
  apiKey: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    runtimeConfig.firebase.apiKey,
  ),
  authDomain: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    runtimeConfig.firebase.authDomain,
  ),
  projectId: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    runtimeConfig.firebase.projectId,
  ),
  storageBucket: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    runtimeConfig.firebase.storageBucket,
  ),
  messagingSenderId: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    runtimeConfig.firebase.messagingSenderId,
  ),
  appId: getRequiredConfigValue(
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    runtimeConfig.firebase.appId,
  ),
};

const hasExistingApp = getApps().length > 0;

const app: FirebaseApp = hasExistingApp
  ? getApp()
  : initializeApp(firebaseConfig);

const auth: FirebaseAuthTypes.Module = getAuth();
const db: FirebaseFirestoreTypes.Module = firestore();
const storage: FirebaseStorageTypes.Module = getStorage();

export { app, auth, db, storage };
