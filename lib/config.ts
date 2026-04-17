import Constants from 'expo-constants';

interface FirebaseRuntimeConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

interface AppRuntimeConfig {
  expoProjectId?: string;
  firebase: FirebaseRuntimeConfig;
}

const appExtra = Constants.expoConfig?.extra as
  | {
      expoProjectId?: string;
      firebase?: FirebaseRuntimeConfig;
    }
  | undefined;

export const runtimeConfig: AppRuntimeConfig = {
  expoProjectId:
    appExtra?.expoProjectId ?? Constants.easConfig?.projectId ?? undefined,
  firebase: {
    apiKey: appExtra?.firebase?.apiKey,
    authDomain: appExtra?.firebase?.authDomain,
    projectId: appExtra?.firebase?.projectId,
    storageBucket: appExtra?.firebase?.storageBucket,
    messagingSenderId: appExtra?.firebase?.messagingSenderId,
    appId: appExtra?.firebase?.appId,
  },
};

export function getRequiredConfigValue(
  envName: string,
  value: string | undefined,
): string {
  if (!value) {
    throw new Error(
      `Missing ${envName}. Add it to your Expo environment configuration before launching Klir Mobile.`,
    );
  }

  return value;
}
