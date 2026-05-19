import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  AuthorizationStatus,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import { apiFetch } from './api';

const FCM_TOKEN_STORAGE_KEY = 'fcmToken';
const NOTIF_PERMISSION_REQUESTED_KEY = 'notifPermissionRequested';

export interface FcmRegistrationResult {
  fcmToken: string | null;
  permissionsGranted: boolean;
  permissionRequestedNow: boolean;
}

export interface ForegroundTaskNotification {
  title: string;
  body: string;
  taskId: string | null;
}

function resolveTaskId(data: FirebaseMessagingTypes.RemoteMessage['data']): string | null {
  const taskId = data?.taskId;

  if (typeof taskId === 'string' && taskId.trim().length > 0) {
    return taskId;
  }

  return null;
}

function isMessagingPermissionGranted(status: FirebaseMessagingTypes.AuthorizationStatus): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

async function requestAndroidPostNotificationsAsync(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const version =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(Platform.Version, 10);

  if (!Number.isFinite(version) || version < 33) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function requestNotificationPermissionOnceAsync(): Promise<{
  granted: boolean;
  requestedNow: boolean;
}> {
  const requested = await AsyncStorage.getItem(NOTIF_PERMISSION_REQUESTED_KEY);

  if (requested === 'true') {
    const status = await messaging().hasPermission();
    const androidGranted = await requestAndroidPostNotificationsAsync();

    return {
      granted: isMessagingPermissionGranted(status) && androidGranted,
      requestedNow: false,
    };
  }

  const status = await messaging().requestPermission();
  const androidGranted = await requestAndroidPostNotificationsAsync();
  await AsyncStorage.setItem(NOTIF_PERMISSION_REQUESTED_KEY, 'true');

  return {
    granted: isMessagingPermissionGranted(status) && androidGranted,
    requestedNow: true,
  };
}

async function registerFcmTokenValueAsync(fcmToken: string): Promise<void> {
  await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, fcmToken);

  const response = await apiFetch<never>('/api/tasks/register-token', {
    method: 'POST',
    body: JSON.stringify({ fcmToken }),
  });

  if (!response.success) {
    throw new Error(response.error ?? 'Failed to register notification token.');
  }
}

export function configureBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async () => {
    // Notification taps are routed through onNotificationOpenedApp/getInitialNotification.
  });
}

export async function registerForPushNotificationsAsync(): Promise<FcmRegistrationResult> {
  const permission = await requestNotificationPermissionOnceAsync();

  if (!permission.granted) {
    return {
      fcmToken: null,
      permissionsGranted: false,
      permissionRequestedNow: permission.requestedNow,
    };
  }

  await messaging().registerDeviceForRemoteMessages();
  const fcmToken = await messaging().getToken();

  if (!fcmToken) {
    throw new Error('Firebase did not return an FCM registration token.');
  }

  await registerFcmTokenValueAsync(fcmToken);

  return {
    fcmToken,
    permissionsGranted: true,
    permissionRequestedNow: permission.requestedNow,
  };
}

export function subscribeToPushTokenRefresh(
  onError: (message: string) => void,
): () => void {
  return messaging().onTokenRefresh((fcmToken) => {
    void registerFcmTokenValueAsync(fcmToken).catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to refresh notification token.';
      onError(message);
    });
  });
}

export function subscribeToNotificationEvents({
  onForegroundMessage,
  onTaskSelected,
}: {
  onForegroundMessage: (notification: ForegroundTaskNotification) => void;
  onTaskSelected: (taskId: string) => void;
}): () => void {
  const unsubscribeForeground = messaging().onMessage((remoteMessage) => {
    onForegroundMessage({
      title: remoteMessage.notification?.title ?? 'Cleaning Task Assigned',
      body:
        remoteMessage.notification?.body ??
        'A new task has been assigned to your maintenance queue.',
      taskId: resolveTaskId(remoteMessage.data),
    });
  });

  const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    const taskId = resolveTaskId(remoteMessage.data);

    if (taskId) {
      onTaskSelected(taskId);
    }
  });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
  };
}

export async function consumeInitialNotificationResponse(
  onTaskSelected: (taskId: string) => void,
): Promise<void> {
  const remoteMessage = await messaging().getInitialNotification();
  const taskId = resolveTaskId(remoteMessage?.data);

  if (taskId) {
    onTaskSelected(taskId);
  }
}
