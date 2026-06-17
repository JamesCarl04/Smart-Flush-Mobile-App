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
    primary: '#127369',
    onPrimary: '#ffffff',
    primaryContainer: '#c5efe8',
    onPrimaryContainer: '#00201c',
    secondary: '#4c8577',
    onSecondary: '#ffffff',
    secondaryContainer: '#d0ede6',
    onSecondaryContainer: '#0b1f1a',
    tertiary: '#31628b',
    onTertiary: '#ffffff',
    tertiaryContainer: '#d1e4ff',
    onTertiaryContainer: '#001d34',
    background: '#f3faf8',
    onBackground: '#171d1c',
    surface: '#ffffff',
    onSurface: '#171d1c',
    surfaceVariant: '#dce5e2',
    onSurfaceVariant: '#404946',
    error: '#ba1a1a',
    onError: '#ffffff',
    outline: '#707977',
  },
};

function NotificationLifecycle(): React.JSX.Element | null {
  const { user } = useAuth();
  const [banner, setBanner] = useState<ForegroundTaskNotification | null>(null);

  useEffect(() => {
    const handleTaskSelection = (taskId: string): void => {
      queueTaskNavigation(taskId);

      if (user) {
        flushPendingTaskNavigation();
      }
    };

    const unsubscribe = subscribeToNotificationEvents({
      onForegroundMessage: setBanner,
      onTaskSelected: handleTaskSelection,
    });
    void consumeInitialNotificationResponse(handleTaskSelection);

    return unsubscribe;
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
