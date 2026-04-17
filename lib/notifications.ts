import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { runtimeConfig } from './config';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface PushRegistrationResult {
  expoPushToken: string | null;
  fcmToken: string | null;
  permissionsGranted: boolean;
}

function resolveTaskId(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const taskId = record.taskId;

  if (typeof taskId === 'string' && taskId.trim().length > 0) {
    return taskId;
  }

  if (typeof taskId === 'number') {
    return String(taskId);
  }

  return null;
}

async function ensureNotificationChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('maintenance-tasks', {
    name: 'Maintenance Tasks',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 200, 200, 200],
    lightColor: '#127369',
    sound: 'default',
  });
}

async function ensurePermissionAsync(): Promise<boolean> {
  const existingPermissions = await Notifications.getPermissionsAsync();
  let currentStatus = existingPermissions.status;

  if (currentStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    currentStatus = requestedPermissions.status;
  }

  return currentStatus === 'granted';
}

async function updatePushTokenDocument(
  uid: string,
  payload: {
    expoPushToken?: string | null;
    fcmToken?: string | null;
  },
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      ...payload,
      pushTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function prepareNotificationsAsync(): Promise<boolean> {
  await ensureNotificationChannelAsync();
  return ensurePermissionAsync();
}

export async function registerForPushNotificationsAsync(
  uid: string,
): Promise<PushRegistrationResult> {
  const permissionsGranted = await prepareNotificationsAsync();

  if (!permissionsGranted) {
    return {
      expoPushToken: null,
      fcmToken: null,
      permissionsGranted: false,
    };
  }

  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  const fcmToken =
    typeof devicePushToken.data === 'string' ? devicePushToken.data : null;

  let expoPushToken: string | null = null;

  if (runtimeConfig.expoProjectId) {
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync({
        projectId: runtimeConfig.expoProjectId,
        devicePushToken,
      });
      expoPushToken = expoToken.data;
    } catch (error) {
      console.warn('Failed to fetch Expo push token', error);
    }
  }

  await updatePushTokenDocument(uid, {
    expoPushToken,
    fcmToken,
  });

  return {
    expoPushToken,
    fcmToken,
    permissionsGranted: true,
  };
}

export function subscribeToPushTokenRefresh(uid: string): () => void {
  const subscription = Notifications.addPushTokenListener((nextToken) => {
    const fcmToken =
      typeof nextToken.data === 'string' ? nextToken.data : null;

    void updatePushTokenDocument(uid, { fcmToken });
  });

  return () => {
    subscription.remove();
  };
}

export function subscribeToNotificationEvents(
  onTaskSelected: (taskId: string) => void,
): () => void {
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const title = notification.request.content.title ?? 'New maintenance task';
      const body =
        notification.request.content.body ??
        'A new task has been assigned to your maintenance queue.';

      Alert.alert(title, body);
    },
  );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = resolveTaskId(response.notification.request.content.data);

      if (taskId) {
        onTaskSelected(taskId);
      }
    });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

export async function consumeInitialNotificationResponse(
  onTaskSelected: (taskId: string) => void,
): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();

  if (!response) {
    return;
  }

  const taskId = resolveTaskId(response.notification.request.content.data);

  if (taskId) {
    onTaskSelected(taskId);
  }

  Notifications.clearLastNotificationResponse();
}
