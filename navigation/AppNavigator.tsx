import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Surface, Text } from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import {
  flushPendingTaskNavigation,
  navigationRef,
} from './navigationRef';

const RootStack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <Surface style={styles.loadingCard} elevation={1}>
        <ActivityIndicator size="large" />
        <Text variant="titleMedium" style={styles.loadingTitle}>
          Checking your session
        </Text>
        <Text variant="bodyMedium" style={styles.loadingDescription}>
          Klir Mobile is validating your maintenance access.
        </Text>
      </Surface>
    </View>
  );
}

export function AppNavigator(): React.JSX.Element {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (user) {
      flushPendingTaskNavigation();
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (user) {
          flushPendingTaskNavigation();
        }
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f3faf8',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 12,
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 8,
  },
  loadingDescription: {
    textAlign: 'center',
    color: '#56615d',
  },
});
