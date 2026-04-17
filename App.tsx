import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './contexts/AuthContext';
import { TasksProvider } from './contexts/TasksContext';
import { useAuth } from './hooks/useAuth';
import {
  consumeInitialNotificationResponse,
  prepareNotificationsAsync,
  registerForPushNotificationsAsync,
  subscribeToNotificationEvents,
  subscribeToPushTokenRefresh,
} from './lib/notifications';
import { AppNavigator } from './navigation/AppNavigator';
import {
  flushPendingTaskNavigation,
  queueTaskNavigation,
} from './navigation/navigationRef';

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

  useEffect(() => {
    void prepareNotificationsAsync();
  }, []);

  useEffect(() => {
    const handleTaskSelection = (taskId: string): void => {
      queueTaskNavigation(taskId);

      if (user) {
        flushPendingTaskNavigation();
      }
    };

    const unsubscribe = subscribeToNotificationEvents(handleTaskSelection);
    void consumeInitialNotificationResponse(handleTaskSelection);

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let isMounted = true;
    let unsubscribeTokenRefresh = (): void => undefined;

    void (async () => {
      try {
        const registration = await registerForPushNotificationsAsync(user.uid);

        if (isMounted && registration.permissionsGranted) {
          unsubscribeTokenRefresh = subscribeToPushTokenRefresh(user.uid);
          flushPendingTaskNavigation();
        }
      } catch (error) {
        console.warn('Failed to register push notifications', error);
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

  return null;
}

function Providers(): React.JSX.Element {
  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <AuthProvider>
          <TasksProvider>
            <NotificationLifecycle />
            <AppNavigator />
            <StatusBar style="dark" />
          </TasksProvider>
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
