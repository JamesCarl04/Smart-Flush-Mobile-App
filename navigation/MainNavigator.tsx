import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { ActiveTaskScreen } from '../screens/ActiveTaskScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InboxScreen } from '../screens/InboxScreen';
import {
  CompletedReviewDetailScreen,
  CompletedReviewsScreen,
  SupervisorDashboardScreen,
  SupervisorTaskDetailScreen,
  SupervisorTasksScreen,
  TeamAvailabilityScreen,
} from '../screens/SupervisorScreens';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { LogoutHeaderButton } from './LogoutHeaderButton';
import type {
  HistoryStackParamList,
  InboxStackParamList,
  MainTabParamList,
  SupervisorStackParamList,
  TaskStackParamList,
} from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const InboxStack = createNativeStackNavigator<InboxStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const TaskStack = createNativeStackNavigator<TaskStackParamList>();
const SupervisorStack = createNativeStackNavigator<SupervisorStackParamList>();

const sharedHeaderOptions = {
  headerRight: () => <LogoutHeaderButton />,
  headerRightContainerStyle: {
    paddingRight: 12,
  },
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: '#ffffff',
  },
  headerTitleStyle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
} as const;

function InboxStackNavigator(): React.JSX.Element {
  return (
    <InboxStack.Navigator
      screenOptions={sharedHeaderOptions}
    >
      <InboxStack.Screen
        name="InboxHome"
        component={InboxScreen}
        options={{ title: 'Inbox' }}
      />
      <InboxStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task details' }}
      />
    </InboxStack.Navigator>
  );
}

function HistoryStackNavigator(): React.JSX.Element {
  return (
    <HistoryStack.Navigator
      screenOptions={sharedHeaderOptions}
    >
      <HistoryStack.Screen
        name="HistoryHome"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
      <HistoryStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task details' }}
      />
    </HistoryStack.Navigator>
  );
}

function TaskStackNavigator(): React.JSX.Element {
  return (
    <TaskStack.Navigator screenOptions={sharedHeaderOptions}>
      <TaskStack.Screen
        name="ActiveTask"
        component={ActiveTaskScreen}
        options={{ title: 'Task Detail' }}
      />
    </TaskStack.Navigator>
  );
}

function SupervisorStackNavigator(): React.JSX.Element {
  return (
    <SupervisorStack.Navigator screenOptions={sharedHeaderOptions}>
      <SupervisorStack.Screen
        name="SupervisorDashboard"
        component={SupervisorDashboardScreen}
        options={{ title: 'Supervisor Dashboard' }}
      />
      <SupervisorStack.Screen
        name="TeamAvailability"
        component={TeamAvailabilityScreen}
        options={{ title: 'Team Availability' }}
      />
      <SupervisorStack.Screen
        name="SupervisorTasks"
        component={SupervisorTasksScreen}
        options={{ title: 'Task Management' }}
      />
      <SupervisorStack.Screen
        name="SupervisorTaskDetail"
        component={SupervisorTaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
      <SupervisorStack.Screen
        name="CompletedReviews"
        component={CompletedReviewsScreen}
        options={{ title: 'Completed Reviews' }}
      />
      <SupervisorStack.Screen
        name="CompletedReviewDetail"
        component={CompletedReviewDetailScreen}
        options={{ title: 'Review Details' }}
      />
    </SupervisorStack.Navigator>
  );
}

export function MainNavigator(): React.JSX.Element {
  const theme = useTheme();
  const { role } = useAuth();
  const { pendingCount } = useTasks();

  if (role === 'supervisor') {
    return <SupervisorStackNavigator />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          height: 76,
          paddingBottom: 12,
          paddingTop: 9,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '800',
        },
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === 'InboxTab'
              ? 'bell-outline'
              : route.name === 'TaskTab'
                ? 'clipboard-text-outline'
                : 'clock-outline';

          return (
            <MaterialCommunityIcons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="InboxTab"
        component={InboxStackNavigator}
        options={{
          title: 'Inbox',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.error,
            color: theme.colors.onError,
          },
        }}
      />
      <Tab.Screen
        name="TaskTab"
        component={TaskStackNavigator}
        options={{
          title: 'Task Detail',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.error,
            color: theme.colors.onError,
          },
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{ title: 'History' }}
      />
    </Tab.Navigator>
  );
}
