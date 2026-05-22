import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { ActiveTaskScreen } from '../screens/ActiveTaskScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { LogoutHeaderButton } from './LogoutHeaderButton';
import type {
  HistoryStackParamList,
  InboxStackParamList,
  MainTabParamList,
  TaskStackParamList,
} from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const InboxStack = createNativeStackNavigator<InboxStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const TaskStack = createNativeStackNavigator<TaskStackParamList>();

const sharedHeaderOptions = {
  headerRight: () => <LogoutHeaderButton />,
  headerRightContainerStyle: {
    paddingRight: 12,
  },
  headerShadowVisible: true,
  headerStyle: {
    backgroundColor: '#ffffff',
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

export function MainNavigator(): React.JSX.Element {
  const theme = useTheme();
  const { pendingCount } = useTasks();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: theme.colors.surface,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
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
