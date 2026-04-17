import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import type {
  HistoryStackParamList,
  InboxStackParamList,
  MainTabParamList,
} from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const InboxStack = createNativeStackNavigator<InboxStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function InboxStackNavigator(): React.JSX.Element {
  return (
    <InboxStack.Navigator>
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
    <HistoryStack.Navigator>
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
            route.name === 'InboxTab' ? 'bell-outline' : 'clock-outline';

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
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{ title: 'History' }}
      />
    </Tab.Navigator>
  );
}
