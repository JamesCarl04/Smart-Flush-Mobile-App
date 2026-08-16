import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3LightTheme, PaperProvider, Snackbar } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './contexts/AuthContext';
import { OfflineSyncProvider } from './contexts/OfflineSyncContext';
import { TasksProvider } from './contexts/TasksContext';
import { useAuth } from './hooks/useAuth';
import {
  configureBackgroundMessageHandler,
  consumeInitialNotificationResponse,
  type ForegroundTaskNotification,
  registerForPushNotificationsAsync,
  subscribeLocalNotifications,
  subscribeToNotificationEvents,
  subscribeToPushTokenRefresh,
} from './lib/notifications';
import { AppNavigator } from './navigation/AppNavigator';
import {
  flushPendingTaskNavigation,
  queueTaskNavigation,
} from './navigation/navigationRef';

configureBackgroundMessageHandler();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B5121B',
    secondary: '#D97706',
    error: '#B5121B',
    background: '#F9FAFB',
    surface: '#FFFFFF',
  },
};

function NotificationLifecycle(): React.JSX.Element {
  const { user } = useAuth();
  const [banner, setBanner] = useState<ForegroundTaskNotification | null>(null);

  useEffect(() => {
    const handleTaskSelection = (taskId: string): void => {
      queueTaskNavigation(taskId);

      if (user) {
        flushPendingTaskNavigation();
      }
    };

    const unsubscribeFirebase = subscribeToNotificationEvents({
      onForegroundMessage: setBanner,
      onTaskSelected: handleTaskSelection,
    });
    const unsubscribeLocal = subscribeLocalNotifications((notification) => {
      setBanner(notification);
    });
    void consumeInitialNotificationResponse(handleTaskSelection);

    return () => {
      unsubscribeFirebase();
      unsubscribeLocal();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let isMounted = true;
    let unsubscribeTokenRefresh = (): void => undefined;

    const showErrorBanner = (message: string): void => {
      if (!isMounted) {
        return;
      }

      setBanner({
        title: 'Notification setup failed',
        body: message,
        taskId: null,
      });
    };

    unsubscribeTokenRefresh = subscribeToPushTokenRefresh(showErrorBanner);

    void (async () => {
      try {
        const registration = await registerForPushNotificationsAsync();

        if (!isMounted) {
          return;
        }

        if (registration.permissionsGranted) {
          flushPendingTaskNavigation();
          return;
        }

        if (registration.permissionRequestedNow) {
          setBanner({
            title: 'Notifications disabled',
            body: 'Notifications are required to receive cleaning task alerts.',
            taskId: null,
          });
        }
      } catch (error) {
        showErrorBanner(
          error instanceof Error
            ? error.message
            : 'Failed to register push notifications.',
        );
      }
    })();

    return () => {
      isMounted = false;
      unsubscribeTokenRefresh();
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      flushPendingTaskNavigation();
    }
  }, [user]);

  const openBannerTask = (): void => {
    const taskId = banner?.taskId;
    setBanner(null);

    if (taskId) {
      queueTaskNavigation(taskId);
      flushPendingTaskNavigation();
    }
  };

  return (
    <Snackbar
      visible={banner !== null}
      onDismiss={() => setBanner(null)}
      duration={7000}
      action={
        banner?.taskId
          ? {
              label: 'View',
              onPress: openBannerTask,
            }
          : undefined
      }
    >
      {banner ? `${banner.title}\n${banner.body}` : ''}
    </Snackbar>
  );
}

function Providers(): React.JSX.Element {
  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <AuthProvider>
          <OfflineSyncProvider>
            <TasksProvider>
              <NotificationLifecycle />
              <AppNavigator />
              <StatusBar style="dark" />
            </TasksProvider>
          </OfflineSyncProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </PaperProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Providers />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
