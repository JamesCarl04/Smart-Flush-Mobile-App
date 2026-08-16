import React from 'react';
import { Button, Text, View } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { TasksProvider } from '../../contexts/TasksContext';
import { useTasks } from '../../hooks/useTasks';
import * as taskApi from '../../lib/task-api';
import * as useAuthHook from '../../hooks/useAuth';
import type { Task } from '../../types';

jest.mock('../../lib/task-api');
jest.mock('../../hooks/useAuth');

function TestTasksConsumer(): React.JSX.Element {
  const {
    tasks,
    inboxTasks,
    historyTasks,
    pendingCount,
    loading,
    errorMessage,
    refreshTasks,
    clearError,
  } = useTasks();

  return (
    <View>
      <Text testID="loading">{loading ? 'LOADING' : 'IDLE'}</Text>
      <Text testID="error-message">{errorMessage ?? 'NO_ERROR'}</Text>
      <Text testID="tasks-count">{tasks.length}</Text>
      <Text testID="inbox-count">{inboxTasks.length}</Text>
      <Text testID="history-count">{historyTasks.length}</Text>
      <Text testID="pending-count">{pendingCount}</Text>
      <View testID="inbox-task-ids">
        {inboxTasks.map((t) => (
          <Text key={t.id} testID={`inbox-${t.id}`}>
            {t.id}:{t.status}
          </Text>
        ))}
      </View>
      <View testID="history-task-ids">
        {historyTasks.map((t) => (
          <Text key={t.id} testID={`history-${t.id}`}>
            {t.id}:{t.status}:{t.completedBy}
          </Text>
        ))}
      </View>
      <Button testID="refresh-btn" title="Refresh" onPress={() => void refreshTasks()} />
      <Button testID="clear-error-btn" title="Clear Error" onPress={clearError} />
    </View>
  );
}

const mockTasksData: Task[] = [
  {
    id: 'task-1',
    deviceId: 'dev-1',
    type: 'maintenance',
    component: 'flush_valve',
    location: '2F Restroom A',
    floor: '2F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Low flush pressure detected',
    assignedTo: 'user-tech-1',
    status: 'assigned',
    createdAt: new Date('2026-08-15T01:00:00Z'),
    createdBy: 'system',
  },
  {
    id: 'task-2',
    deviceId: 'dev-2',
    type: 'cleaning',
    component: 'soap_dispenser',
    location: '1F Restroom B',
    floor: '1F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'maintenance',
    message: 'Refill soap dispenser',
    assignedTo: null,
    status: 'unassigned',
    createdAt: new Date('2026-08-15T02:00:00Z'),
    createdBy: 'system',
  },
  {
    id: 'task-3',
    deviceId: 'dev-3',
    type: 'maintenance',
    component: 'pipe',
    location: '3F Restroom C',
    floor: '3F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Reassignment needed for urgent pipe check',
    assignedTo: 'user-tech-2',
    status: 'reassignment_needed',
    createdAt: new Date('2026-08-15T03:00:00Z'),
    createdBy: 'supervisor',
  },
  {
    id: 'task-4',
    deviceId: 'dev-4',
    type: 'maintenance',
    component: 'faucet',
    location: '1F Restroom A',
    floor: '1F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'manual',
    message: 'Faucet leaking',
    assignedTo: 'user-tech-1',
    status: 'acknowledged',
    createdAt: new Date('2026-08-15T04:00:00Z'),
    createdBy: 'user',
  },
  {
    id: 'task-5',
    deviceId: 'dev-5',
    type: 'maintenance',
    component: 'toilet_bowl',
    location: '2F Restroom B',
    floor: '2F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Sensor calibrated and tested',
    assignedTo: 'user-tech-1',
    status: 'completed',
    completedBy: 'user-tech-1',
    completedAt: new Date('2026-08-15T05:00:00Z'),
    createdAt: new Date('2026-08-15T04:30:00Z'),
    createdBy: 'system',
  },
  {
    id: 'task-6',
    deviceId: 'dev-6',
    type: 'cleaning',
    component: 'floor',
    location: '4F Restroom A',
    floor: '4F',
    building: 'GB3',
    shift: '2nd',
    triggerType: 'maintenance',
    message: 'Completed by another tech',
    assignedTo: 'user-tech-2',
    status: 'completed',
    completedBy: 'user-tech-2',
    completedAt: new Date('2026-08-15T05:30:00Z'),
    createdAt: new Date('2026-08-15T05:00:00Z'),
    createdBy: 'system',
  },
];

describe('TasksContext Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-1',
        email: 'tech1@smartflush.com',
        role: 'maintenance',
        name: 'Alex Technician',
        building: 'GB3',
      },
      role: 'maintenance',
      loading: false,
      logout: jest.fn(),
    });
  });

  it('fetches tasks on mount and accurately categorizes inboxTasks and historyTasks', async () => {
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue(mockTasksData);

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    expect(screen.getByTestId('tasks-count').props.children).toBe(6);
    // inboxTasks: task-1 (assigned), task-2 (unassigned), task-3 (reassignment_needed), task-4 (acknowledged) -> 4
    expect(screen.getByTestId('inbox-count').props.children).toBe(4);
    // historyTasks: only completed tasks completed by 'user-tech-1' -> task-5 (task-6 was completed by user-tech-2) -> 1
    expect(screen.getByTestId('history-count').props.children).toBe(1);

    expect(screen.getByTestId('inbox-task-1')).toBeTruthy();
    expect(screen.getByTestId('inbox-task-2')).toBeTruthy();
    expect(screen.getByTestId('inbox-task-3')).toBeTruthy();
    expect(screen.getByTestId('inbox-task-4')).toBeTruthy();
    expect(screen.getByTestId('history-task-5')).toBeTruthy();
    expect(screen.queryByTestId('history-task-6')).toBeNull();
  });

  it('calculates pendingCount for unassigned, assigned, and reassignment_needed tasks', async () => {
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue(mockTasksData);

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    // pendingCount: task-1 (assigned) + task-2 (unassigned) + task-3 (reassignment_needed) = 3
    expect(screen.getByTestId('pending-count').props.children).toBe(3);
  });

  it('handles fetch error and allows clearing error via clearError()', async () => {
    (taskApi.fetchTasks as jest.Mock).mockRejectedValue(new Error('Network connection failed'));

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    expect(screen.getByTestId('error-message').props.children).toBe(
      'Unable to refresh maintenance tasks: Network connection failed',
    );

    fireEvent.press(screen.getByTestId('clear-error-btn'));

    expect(screen.getByTestId('error-message').props.children).toBe('NO_ERROR');
  });

  it('supports manual refreshTasks() triggering API reload', async () => {
    (taskApi.fetchTasks as jest.Mock).mockResolvedValueOnce([mockTasksData[0]]);

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('tasks-count').props.children).toBe(1);
    });

    (taskApi.fetchTasks as jest.Mock).mockResolvedValueOnce(mockTasksData);

    await act(async () => {
      fireEvent.press(screen.getByTestId('refresh-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('tasks-count').props.children).toBe(6);
    });

    expect(taskApi.fetchTasks).toHaveBeenCalledTimes(2);
  });

  it('clears tasks when user logs out (user is null)', async () => {
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: null,
      role: null,
      loading: false,
      logout: jest.fn(),
    });

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    expect(screen.getByTestId('tasks-count').props.children).toBe(0);
    expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    expect(taskApi.fetchTasks).not.toHaveBeenCalled();
  });
});
