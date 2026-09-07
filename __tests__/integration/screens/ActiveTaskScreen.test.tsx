import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { ActiveTaskScreen } from '../../../screens/ActiveTaskScreen';
import * as useAuthHook from '../../../hooks/useAuth';
import * as useTasksHook from '../../../hooks/useTasks';
import type { Task } from '../../../types';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useTasks');
jest.mock('../../../lib/task-api');
jest.mock('react-native-paper', () => {
  const actual = jest.requireActual('react-native-paper');
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    ...actual,
    Snackbar: ({ children, visible }: any) =>
      visible ? <View testID="mock-snackbar"><Text>{children}</Text></View> : null,
  };
});

const mockTask1: Task = {
  id: 'task-1',
  deviceId: 'toilet-01',
  restroomName: 'Restroom 1',
  type: 'maintenance',
  component: 'flush_valve',
  location: '1F Male Restroom',
  floor: '1F',
  building: 'Main Building',
  shift: '1st',
  triggerType: 'hardware_failure',
  message: 'Valve leak detected',
  assignedTo: 'tech-user-1',
  assignedToIds: ['tech-user-1', 'tech-user-2'],
  status: 'acknowledged',
  acknowledgedBy: {
    'tech-user-1': new Date('2026-09-07T10:00:00.000Z'),
  },
  createdAt: new Date('2026-09-07T09:00:00.000Z'),
  createdBy: 'system',
};

const mockTask2: Task = {
  id: 'task-2',
  deviceId: 'toilet-02',
  restroomName: 'Restroom 2',
  type: 'cleaning',
  component: 'floor',
  location: '2F Female Restroom',
  floor: '2F',
  building: 'Main Building',
  shift: '1st',
  triggerType: 'manual',
  message: 'Spill cleanup required',
  assignedTo: 'tech-user-1',
  status: 'acknowledged',
  createdAt: new Date('2026-09-07T09:30:00.000Z'),
  createdBy: 'staff',
};

describe('ActiveTaskScreen Integration', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    getParent: jest.fn().mockReturnValue({ navigate: jest.fn() }),
    addListener: jest.fn().mockReturnValue(jest.fn()),
  };

  const defaultUser = {
    uid: 'tech-user-1',
    email: 'tech1@example.com',
    role: 'maintenance',
    name: 'Tech One',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: defaultUser,
      role: 'maintenance',
      loading: false,
    });
  });

  it('renders the first active task when no route taskId is specified', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockTask1, mockTask2],
      activeTasks: [mockTask1, mockTask2],
      loading: false,
      refreshTasks: jest.fn(),
    });

    render(
      <PaperProvider>
        <ActiveTaskScreen navigation={mockNavigation} route={{ key: 'ActiveTask', name: 'ActiveTask', params: undefined }} />
      </PaperProvider>
    );

    expect(screen.getAllByText('Restroom 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Valve leak detected')).toBeTruthy();
    expect(screen.getByText('Active Tasks (2):')).toBeTruthy();
  });

  it('falls back to tasks when routeTaskId is not yet in activeTasks', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockTask1],
      activeTasks: [],
      loading: false,
      refreshTasks: jest.fn(),
    });

    render(
      <PaperProvider>
        <ActiveTaskScreen
          navigation={mockNavigation}
          route={{ key: 'ActiveTask', name: 'ActiveTask', params: { taskId: 'task-1' } }}
        />
      </PaperProvider>
    );

    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.getByText('Valve leak detected')).toBeTruthy();
    expect(screen.queryByText('No active task in progress')).toBeNull();
  });

  it('does not fallback to tasks if the task is already completed by the user', () => {
    const completedTeamTask: Task = {
      ...mockTask1,
      status: 'assigned',
      completedByMap: {
        'tech-user-1': new Date('2026-09-07T10:30:00.000Z'),
      },
    };

    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [completedTeamTask],
      activeTasks: [],
      loading: false,
      refreshTasks: jest.fn(),
    });

    render(
      <PaperProvider>
        <ActiveTaskScreen
          navigation={mockNavigation}
          route={{ key: 'ActiveTask', name: 'ActiveTask', params: { taskId: 'task-1' } }}
        />
      </PaperProvider>
    );

    expect(screen.getByText('No active task in progress')).toBeTruthy();
  });

  it('allows switching active tasks via multi-task tabs row', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockTask1, mockTask2],
      activeTasks: [mockTask1, mockTask2],
      loading: false,
      refreshTasks: jest.fn(),
    });

    render(
      <PaperProvider>
        <ActiveTaskScreen navigation={mockNavigation} route={{ key: 'ActiveTask', name: 'ActiveTask', params: undefined }} />
      </PaperProvider>
    );

    expect(screen.getByText('Valve leak detected')).toBeTruthy();

    // Click Restroom 2 tab in switcher bar
    const tabPill2 = screen.getByText('Restroom 2');
    fireEvent.press(tabPill2);

    expect(screen.getByText('Spill cleanup required')).toBeTruthy();
  });

  it('updates viewed task when route taskId changes', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [mockTask1, mockTask2],
      activeTasks: [mockTask1, mockTask2],
      loading: false,
      refreshTasks: jest.fn(),
    });

    const { rerender } = render(
      <PaperProvider>
        <ActiveTaskScreen
          navigation={mockNavigation}
          route={{ key: 'ActiveTask', name: 'ActiveTask', params: { taskId: 'task-1' } }}
        />
      </PaperProvider>
    );

    expect(screen.getByText('Valve leak detected')).toBeTruthy();

    // Switch via navigation to task-2
    rerender(
      <PaperProvider>
        <ActiveTaskScreen
          navigation={mockNavigation}
          route={{ key: 'ActiveTask', name: 'ActiveTask', params: { taskId: 'task-2' } }}
        />
      </PaperProvider>
    );

    expect(screen.getByText('Spill cleanup required')).toBeTruthy();
  });

  it('renders empty panel when activeTasks is empty and route taskId does not match any tasks', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [],
      activeTasks: [],
      loading: false,
      refreshTasks: jest.fn(),
    });

    render(
      <PaperProvider>
        <ActiveTaskScreen
          navigation={mockNavigation}
          route={{ key: 'ActiveTask', name: 'ActiveTask', params: { taskId: 'non-existent' } }}
        />
      </PaperProvider>
    );

    expect(screen.getByText('No active task in progress')).toBeTruthy();
  });
});
