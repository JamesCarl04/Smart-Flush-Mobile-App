import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppStartupSkeleton } from '../components/SkeletonScreens';
import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import {
  flushPendingTaskNavigation,
  navigationRef,
} from './navigationRef';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.JSX.Element {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (user) {
      flushPendingTaskNavigation();
    }
  }, [user]);

  if (loading) {
    return <AppStartupSkeleton />;
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
