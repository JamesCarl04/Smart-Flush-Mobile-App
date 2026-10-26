import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';

import { MainNavigator } from '../../../navigation/MainNavigator';
import { useAuth } from '../../../hooks/useAuth';
import { useTasks } from '../../../hooks/useTasks';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useTasks');
jest.mock('../../../contexts/SupervisorContext', () => ({
  useSupervisorContext: () => ({
    tasks: [],
    people: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
    clearError: jest.fn(),
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseTasks = useTasks as jest.Mock;

describe('MainNavigator RBAC Partitioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTasks.mockReturnValue({
      pendingCount: 0,
      activeTasksCount: 0,
      historyBadgeCount: 0,
      clearHistoryBadge: jest.fn(),
      tasks: [],
      inboxTasks: [],
      activeTasks: [],
      historyTasks: [],
      loading: false,
      errorMessage: null,
      refreshTasks: jest.fn(),
      updateLocalTask: jest.fn(),
      incrementHistoryBadge: jest.fn(),
      clearError: jest.fn(),
    });
  });

  it('exclusively routes supervisor role to SupervisorStackNavigator and hides technician tabs', () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: 'sup-1',
        email: 'supervisor@smartflush.com',
        role: 'supervisor',
        name: 'Sarah Supervisor',
      },
      role: 'supervisor',
      loading: false,
      logout: jest.fn(),
    });

    render(
      <PaperProvider>
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </PaperProvider>,
    );

    // Supervisor screen contents should be rendered
    expect(screen.getByText('Completed Tasks')).toBeTruthy();
    expect(screen.getByText('Reports & Export')).toBeTruthy();

    // Technician navigation tabs must NOT exist
    expect(screen.queryByLabelText(/Inbox, tab/i)).toBeNull();
    expect(screen.queryByLabelText(/Active Task, tab/i)).toBeNull();
    expect(screen.queryByLabelText(/History, tab/i)).toBeNull();
  });

  it.each(['maintenance', 'technician'] as const)(
    'exclusively routes %s role to Tab.Navigator (Inbox, Active Task, History) and hides supervisor screens',
    (workerRole) => {
      mockUseAuth.mockReturnValue({
        user: {
          uid: 'tech-1',
          email: `${workerRole}@smartflush.com`,
          role: workerRole,
          name: 'Alex Technician',
        },
        role: workerRole,
        loading: false,
        logout: jest.fn(),
      });

      render(
        <PaperProvider>
          <NavigationContainer>
            <MainNavigator />
          </NavigationContainer>
        </PaperProvider>,
      );

      // Technician navigation tabs must exist
      expect(screen.getByLabelText(/Inbox, tab/i)).toBeTruthy();
      expect(screen.getByLabelText(/Active Task, tab/i)).toBeTruthy();
      expect(screen.getByLabelText(/History, tab/i)).toBeTruthy();

      // Supervisor dashboard header must NOT exist
      expect(screen.queryByText('Supervisor Dashboard')).toBeNull();
    },
  );
});
