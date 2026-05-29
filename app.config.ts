import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Klir Mobile',
  slug: 'klir-mobile',
  scheme: 'klirmobile',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  plugins: [
    'expo-dev-client',
    'expo-font',
    'expo-notifications',
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
  ],
  android: {
    ...config.android,
    package: 'com.james.klir',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#eaf7f4',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['POST_NOTIFICATIONS'],
    ...(process.env.GOOGLE_SERVICES_JSON
      ? {
          googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
        }
      : {}),
  },
  extra: {
    ...(config.extra ?? {}),
    backendApiBaseUrl: process.env.EXPO_PUBLIC_BACKEND_API_BASE_URL,
    expoProjectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
  },
});
