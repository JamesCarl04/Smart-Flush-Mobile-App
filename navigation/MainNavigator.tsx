import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
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
  SupervisorReportsScreen,
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
  headerRight: () => null,
  headerRightContainerStyle: {
    paddingRight: 12,
  },
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: '#FFFFFF',
  },
  headerTitleStyle: {
    color: '#222222',
    fontSize: 18,
    fontWeight: '800' as const,
  },
  headerTintColor: '#B5121B',
} as const;

function InboxStackNavigator(): React.JSX.Element {
  return (
    <InboxStack.Navigator screenOptions={sharedHeaderOptions}>
      <InboxStack.Screen
        name="InboxHome"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          headerRight: () => <LogoutHeaderButton />,
        }}
      />
      <InboxStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details', headerRight: () => null }}
      />
    </InboxStack.Navigator>
  );
}

function HistoryStackNavigator(): React.JSX.Element {
  return (
    <HistoryStack.Navigator screenOptions={sharedHeaderOptions}>
      <HistoryStack.Screen
        name="HistoryHome"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
      <HistoryStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details', headerRight: () => null }}
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
        options={{ title: 'Active Task' }}
      />
      <TaskStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details', headerRight: () => null }}
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
        options={{
          title: 'Supervisor Dashboard',
          headerRight: () => <LogoutHeaderButton />,
        }}
      />
      <SupervisorStack.Screen
        name="TeamAvailability"
        component={TeamAvailabilityScreen}
        options={{ title: 'Team Availability' }}
      />
      <SupervisorStack.Screen
        name="SupervisorTasks"
        component={SupervisorTasksScreen}
        options={{ title: 'All Tasks' }}
      />
      <SupervisorStack.Screen
        name="SupervisorTaskDetail"
        component={SupervisorTaskDetailScreen}
        options={{ title: 'Task Review', headerRight: () => null }}
      />
      <SupervisorStack.Screen
        name="CompletedReviews"
        component={CompletedReviewsScreen}
        options={{ title: 'Completed Reviews' }}
      />
      <SupervisorStack.Screen
        name="CompletedReviewDetail"
        component={CompletedReviewDetailScreen}
        options={{ title: 'Review Details', headerRight: () => null }}
      />
      <SupervisorStack.Screen
        name="SupervisorReports"
        component={SupervisorReportsScreen}
        options={{
          title: 'Reports & Export',
        }}
      />
    </SupervisorStack.Navigator>
  );
}

export function MainNavigator(): React.JSX.Element {
  const theme = useTheme();
  const { role } = useAuth();
  const { pendingCount, activeTasksCount } = useTasks();

  if (role !== 'maintenance') {
    return <SupervisorStackNavigator />;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route);
        const hideTabBar =
          routeName === 'TaskDetail' ||
          routeName === 'SupervisorTaskDetail' ||
          routeName === 'CompletedReviewDetail';

        return {
          headerShown: false,
          tabBarActiveTintColor: '#B5121B',
          tabBarInactiveTintColor: '#757575',
          tabBarStyle: {
            display: hideTabBar ? 'none' : 'flex',
            height: 74,
            paddingBottom: 12,
            paddingTop: 8,
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E5E5',
            borderTopWidth: 1,
            shadowColor: '#222222',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.2,
          },
          tabBarIcon: ({ color, focused }) => {
            const iconName =
              route.name === 'InboxTab'
                ? (focused ? 'bell' : 'bell-outline')
                : route.name === 'TaskTab'
                  ? (focused ? 'clipboard-text' : 'clipboard-text-outline')
                  : (focused ? 'clock-check' : 'clock-check-outline');

            return (
              <MaterialCommunityIcons
                name={iconName}
                size={24}
                color={color}
              />
            );
          },
        };
      }}
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
            fontSize: 11,
            fontWeight: '800',
          },
        }}
      />
      <Tab.Screen
        name="TaskTab"
        component={TaskStackNavigator}
        options={{
          title: 'Active Task',
          tabBarBadge: activeTasksCount > 0 ? activeTasksCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.error,
            color: theme.colors.onError,
            fontSize: 11,
            fontWeight: '800',
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
