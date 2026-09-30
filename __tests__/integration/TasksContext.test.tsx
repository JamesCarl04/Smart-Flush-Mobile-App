import React from 'react';
import { Button, Text, View } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import { TasksProvider } from '../../contexts/TasksContext';
import { useTasks } from '../../hooks/useTasks';
import * as taskApi from '../../lib/task-api';
import * as useAuthHook from '../../hooks/useAuth';
import { queueOfflineCompletion } from '../../lib/task-completion';
import { db } from '../../lib/firebase';
import type { Task } from '../../types';

jest.mock('../../lib/task-api');
jest.mock('../../hooks/useAuth');

function TestTasksConsumer(): React.JSX.Element {
  const {
    tasks,
    inboxTasks,
    activeTasks,
    activeTasksCount,
    historyTasks,
    pendingCount,
    historyBadgeCount,
    loading,
    errorMessage,
    refreshTasks,
    updateLocalTask,
    clearHistoryBadge,
    clearError,
  } = useTasks();

  return (
    <View>
      <Text testID="loading">{loading ? 'LOADING' : 'IDLE'}</Text>
      <Text testID="error-message">{errorMessage ?? 'NO_ERROR'}</Text>
      <Text testID="tasks-count">{tasks.length}</Text>
      <Text testID="inbox-count">{inboxTasks.length}</Text>
      <Text testID="active-count">{activeTasksCount}</Text>
      <Text testID="history-count">{historyTasks.length}</Text>
      <Text testID="pending-count">{pendingCount}</Text>
      <Text testID="history-badge-count">{historyBadgeCount}</Text>
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
      <View testID="all-task-ids">
        {tasks.map((t) => (
          <Text key={t.id} testID={`task-row-${t.id}`}>
            {t.id}:{t.status}:{t.completedBy}:{t.additionalPhotos?.length ?? 0}:{Object.keys(t.submissions ?? {}).join(',')}
          </Text>
        ))}
      </View>
      <Button testID="refresh-btn" title="Refresh" onPress={() => void refreshTasks()} />
      <Button testID="clear-error-btn" title="Clear Error" onPress={clearError} />
      <Button testID="clear-history-badge-btn" title="Clear History Badge" onPress={clearHistoryBadge} />
      <Button
        testID="complete-task-4-btn"
        title="Complete Task 4"
        onPress={() => {
          const t4 = tasks.find((t) => t.id === 'task-4');
          if (t4) {
            updateLocalTask({
              ...t4,
              status: 'completed',
              inspectionStatus: 'pending_review',
              completedAt: new Date('2026-08-15T06:00:00Z'),
              completedBy: 'user-tech-1',
              offlineSynced: false,
            });
          }
        }}
      />
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
    isBroadcast: true,
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
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
      // pendingCount: task-1 (assigned) + task-2 (unassigned) + task-3 (reassignment_needed) = 3
      expect(screen.getByTestId('pending-count').props.children).toBe(3);
    });
  });

  it('keeps supervisor-only unassigned automation tasks out of a technician inbox', async () => {
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([
      ...mockTasksData,
      {
        ...mockTasksData[1],
        id: 'task-supervisor-only',
        isBroadcast: false,
        assignmentType: 'individual',
        automationTrigger: 'no_water_after_flush',
        requiresSupervisorAssignment: true,
      },
    ]);

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('IDLE'));
    expect(screen.queryByTestId('inbox-task-supervisor-only')).toBeNull();
    expect(screen.getByTestId('inbox-task-2')).toBeTruthy();
  });

  it('keeps supervisor-only unassigned automation tasks in a supervisor inbox', async () => {
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-supervisor-1',
        email: 'supervisor@smartflush.com',
        role: 'supervisor',
        name: 'Sam Supervisor',
        building: 'GB3',
      },
      role: 'supervisor',
      loading: false,
      logout: jest.fn(),
    });
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([
      {
        ...mockTasksData[1],
        id: 'task-supervisor-only',
        isBroadcast: false,
        assignmentType: 'individual',
        automationTrigger: 'maintenance_due',
        requiresSupervisorAssignment: true,
      },
    ]);

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('IDLE'));
    expect(screen.getByTestId('inbox-task-supervisor-only')).toBeTruthy();
  });

  it('subscribes technicians only through assignment and explicit-broadcast queries', async () => {
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([]);
    const onSnapshot = jest.fn(() => jest.fn());
    const where = jest.fn(() => ({ onSnapshot }));
    const broadOnSnapshot = jest.fn();
    (db.collection as jest.Mock).mockReturnValueOnce({ where, onSnapshot: broadOnSnapshot });

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => expect(where).toHaveBeenCalledTimes(5));
    expect(where).toHaveBeenCalledWith('assignedToIds', 'array-contains', 'user-tech-1');
    expect(where).toHaveBeenCalledWith('assignedTo', '==', 'user-tech-1');
    expect(where).toHaveBeenCalledWith('assignedTo', '==', 'tech1@smartflush.com');
    expect(where).toHaveBeenCalledWith('isBroadcast', '==', true);
    expect(where).toHaveBeenCalledWith('recheckedBy', '==', 'user-tech-1');
    expect(broadOnSnapshot).not.toHaveBeenCalled();
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
      expect(screen.getByTestId('error-message').props.children).toBe(
        'Unable to refresh maintenance tasks: Network connection failed',
      );
    });

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

  it('isolates activeTasks count for team tasks: only technicians who personally acknowledged have active tasks', async () => {
    const teamTask: Task = {
      id: 'team-task-1',
      deviceId: 'dev-team',
      type: 'maintenance',
      component: 'flush_valve',
      location: '1F Restroom',
      floor: '1F',
      building: 'GB3',
      shift: '1st',
      triggerType: 'hardware_failure',
      message: 'Urgent team task',
      assignedTo: null,
      assignedToIds: ['user-tech-1', 'user-tech-2'],
      status: 'acknowledged',
      acknowledgedAt: new Date('2026-08-15T02:00:00Z'),
      acknowledgedBy: {
        'user-tech-1': new Date('2026-08-15T02:00:00Z'),
      },
      createdAt: new Date('2026-08-15T01:00:00Z'),
      createdBy: 'system',
    };

    // 1. When logged in as user-tech-2 (who has NOT acknowledged):
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-2',
        email: 'tech2@smartflush.com',
        role: 'maintenance',
        name: 'Jordan Technician',
      },
      role: 'maintenance',
      loading: false,
      logout: jest.fn(),
    });
    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([teamTask]);

    const { unmount } = render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    // Tech 2 sees it in inbox, but active count is 0 because Tech 2 has not acknowledged!
    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    expect(screen.getByTestId('active-count').props.children).toBe(0);

    unmount();

    // 2. When logged in as user-tech-1 (who HAS acknowledged):
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-1',
        email: 'tech1@smartflush.com',
        role: 'maintenance',
        name: 'Alex Technician',
      },
      role: 'maintenance',
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

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    // Tech 1 sees it in active tasks!
    expect(screen.getByTestId('active-count').props.children).toBe(1);
  });

  it('includes solo-assigned flagged tasks in inboxTasks and excludes them from historyTasks', async () => {
    const flaggedSoloTask: Task = {
      id: 'task-flagged-solo',
      deviceId: 'dev-solo-1',
      type: 'maintenance',
      component: 'flush_valve',
      location: '1F Restroom A',
      floor: '1F',
      building: 'GB3',
      shift: '1st',
      triggerType: 'hardware_failure',
      message: 'Repair flush valve',
      assignedTo: 'user-tech-1',
      status: 'flagged',
      inspectionStatus: 'flagged',
      flagReason: 'Water still running after valve repair',
      completedBy: 'user-tech-1',
      submissions: {
        'user-tech-1': {
          technicianUid: 'user-tech-1',
          technicianName: 'Technician 1',
          checklist: {} as any,
          remarks: 'Fixed valve',
          completedAt: new Date('2026-08-15T03:00:00Z'),
          biometricVerified: true,
        },
      },
      createdAt: new Date('2026-08-15T01:00:00Z'),
      createdBy: 'system',
    };

    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([flaggedSoloTask]);

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

    // Appears in inboxTasks
    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    expect(screen.getByTestId('inbox-task-flagged-solo')).toBeTruthy();

    // MUST NOT appear in historyTasks
    expect(screen.getByTestId('history-count').props.children).toBe(0);
    expect(screen.queryByTestId('history-task-flagged-solo')).toBeNull();
  });

  it('includes multi-assigned flagged tasks in inboxTasks for all assignees and excludes from historyTasks', async () => {
    const flaggedMultiTask: Task = {
      id: 'task-flagged-multi',
      deviceId: 'dev-multi-1',
      type: 'maintenance',
      component: 'pipe',
      location: '2F Restroom B',
      floor: '2F',
      building: 'GB3',
      shift: '1st',
      triggerType: 'hardware_failure',
      message: 'Replace pipe section',
      assignedTo: null,
      assignedToIds: ['user-tech-1', 'user-tech-2'],
      status: 'flagged',
      inspectionStatus: 'flagged',
      flagReason: 'Pipe joint still dripping',
      completedByMap: {
        'user-tech-1': new Date('2026-08-15T03:00:00Z'),
        'user-tech-2': new Date('2026-08-15T03:10:00Z'),
      },
      submissions: {
        'user-tech-1': {
          technicianUid: 'user-tech-1',
          technicianName: 'Technician 1',
          checklist: {} as any,
          remarks: 'Done tech 1',
          completedAt: new Date('2026-08-15T03:00:00Z'),
          biometricVerified: true,
        },
        'user-tech-2': {
          technicianUid: 'user-tech-2',
          technicianName: 'Technician 2',
          checklist: {} as any,
          remarks: 'Done tech 2',
          completedAt: new Date('2026-08-15T03:10:00Z'),
          biometricVerified: true,
        },
      },
      createdAt: new Date('2026-08-15T01:00:00Z'),
      createdBy: 'system',
    };

    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([flaggedMultiTask]);

    // 1. Check for user-tech-1
    const { unmount } = render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    expect(screen.getByTestId('inbox-task-flagged-multi')).toBeTruthy();
    expect(screen.getByTestId('history-count').props.children).toBe(0);

    unmount();

    // 2. Check for user-tech-2
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-2',
        email: 'tech2@smartflush.com',
        role: 'maintenance',
        name: 'Jordan Technician',
      },
      role: 'maintenance',
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

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    expect(screen.getByTestId('inbox-task-flagged-multi')).toBeTruthy();
    expect(screen.getByTestId('history-count').props.children).toBe(0);
  });

  it('includes rechecking task in activeTasks and inboxTasks even with prior submissions, and excludes from historyTasks', async () => {
    const recheckingTask: Task = {
      id: 'task-rechecking-1',
      deviceId: 'dev-recheck-1',
      type: 'maintenance',
      component: 'flush_valve',
      location: '1F Restroom A',
      floor: '1F',
      building: 'GB3',
      shift: '1st',
      triggerType: 'hardware_failure',
      message: 'Rectify flush valve',
      assignedTo: 'user-tech-1',
      status: 'rechecking',
      inspectionStatus: 'flagged',
      flagReason: 'Water still running',
      recheckedBy: 'user-tech-1',
      submissions: {
        'user-tech-1': {
          technicianUid: 'user-tech-1',
          technicianName: 'Technician 1',
          checklist: {} as any,
          remarks: 'Prior completion',
          completedAt: new Date('2026-08-15T02:00:00Z'),
          biometricVerified: true,
        },
      },
      createdAt: new Date('2026-08-15T01:00:00Z'),
      createdBy: 'system',
    };

    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([recheckingTask]);

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

    // In inbox
    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    // In active tasks
    expect(screen.getByTestId('active-count').props.children).toBe(1);
    // NOT in history
    expect(screen.getByTestId('history-count').props.children).toBe(0);
  });

  it('includes rechecking task in inboxTasks and activeTasks when user is recheckedBy even if originally assigned to someone else', async () => {
    const reassignedRecheckTask: Task = {
      id: 'task-recheck-handover',
      deviceId: 'dev-valve-handover',
      type: 'maintenance',
      component: 'flush_valve',
      location: '1F Restroom A',
      floor: '1F',
      building: 'GB3',
      shift: '2nd',
      triggerType: 'hardware_failure',
      message: 'Rectify flush valve during 2nd shift',
      assignedTo: 'user-tech-2',
      assignedToIds: ['user-tech-2'],
      status: 'rechecking',
      inspectionStatus: 'flagged',
      flagReason: 'Water still running',
      recheckedBy: 'user-tech-1',
      submissions: {
        'user-tech-2': {
          technicianUid: 'user-tech-2',
          technicianName: 'Technician 2',
          checklist: {} as any,
          remarks: 'Prior attempt by tech 2',
          completedAt: new Date('2026-08-15T02:00:00Z'),
          biometricVerified: true,
        },
      },
      createdAt: new Date('2026-08-15T01:00:00Z'),
      createdBy: 'system',
    };

    (taskApi.fetchTasks as jest.Mock).mockResolvedValue([reassignedRecheckTask]);

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

    // In inbox
    expect(screen.getByTestId('inbox-count').props.children).toBe(1);
    expect(screen.getByTestId('inbox-task-recheck-handover')).toBeTruthy();
    // In active tasks
    expect(screen.getByTestId('active-count').props.children).toBe(1);
    // NOT in history
    expect(screen.getByTestId('history-count').props.children).toBe(0);
  });

  it('optimistically updates task locally via updateLocalTask, removing from active/inbox and adding to history and cache', async () => {
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

    // task-4 is in activeTasks and inboxTasks
    expect(screen.getByTestId('active-count').props.children).toBe(1);
    expect(screen.getByTestId('inbox-task-4')).toBeTruthy();
    expect(screen.getByTestId('history-count').props.children).toBe(1);
    expect(screen.getByTestId('history-badge-count').props.children).toBe(0);

    // Trigger local optimistic update
    fireEvent.press(screen.getByTestId('complete-task-4-btn'));

    // task-4 immediately removed from active and inbox, and added to history
    await waitFor(() => {
      expect(screen.getByTestId('active-count').props.children).toBe(0);
      expect(screen.queryByTestId('inbox-task-4')).toBeNull();
      expect(screen.getByTestId('history-count').props.children).toBe(2);
      expect(screen.getByTestId('history-task-4')).toBeTruthy();
      expect(screen.getByTestId('history-badge-count').props.children).toBe(1);
    });

    // Clear history badge
    fireEvent.press(screen.getByTestId('clear-history-badge-btn'));
    expect(screen.getByTestId('history-badge-count').props.children).toBe(0);

    // Verify written to AsyncStorage cache
    const cached = await AsyncStorage.getItem('@klir:tasks:maintenance:user-tech-1');
    expect(cached).toBeTruthy();
    const parsedCached = JSON.parse(cached!);
    const cachedTask4 = parsedCached.find((t: any) => t.id === 'task-4');
    expect(cachedTask4.status).toBe('completed');
  });

  it('reconciles with offline completion queue on cold-boot cache hydration', async () => {
    // Seed AsyncStorage cache with acknowledged task-4
    const initialTasks = [mockTasksData[3]]; // task-4 acknowledged
    await AsyncStorage.setItem(
      '@klir:tasks:maintenance:user-tech-1',
      JSON.stringify(initialTasks),
    );

    // Queue offline completion bundle in AsyncStorage
    await queueOfflineCompletion({
      taskId: 'task-4',
      completedAt: new Date('2026-08-15T06:00:00Z').toISOString(),
      acknowledgedAt: new Date('2026-08-15T04:00:00Z').toISOString(),
      checklist: {} as any,
      remarks: 'Sanitized offline',
      beforePhotoLocalUri: 'file:///before.jpg',
      afterPhotoLocalUri: 'file:///after.jpg',
      biometricVerified: true,
      completedBy: 'user-tech-1',
      offlineSynced: false,
    });

    // Mock fetchTasks to return nothing (simulating offline startup where API fails)
    (taskApi.fetchTasks as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    render(
      <PaperProvider>
        <TasksProvider>
          <TestTasksConsumer />
        </TasksProvider>
      </PaperProvider>,
    );

    // Task-4 is reconciled immediately on cold boot from cache + offline_tasks
    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    // It should NOT be active or in inbox, but should be in history
    expect(screen.getByTestId('active-count').props.children).toBe(0);
    expect(screen.queryByTestId('inbox-task-4')).toBeNull();
    expect(screen.getByTestId('history-count').props.children).toBe(1);
    expect(screen.getByTestId('history-task-4')).toBeTruthy();
  });

  it('suppresses refreshTasks error banner when device is offline', async () => {
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

    // Simulate device going offline
    (Network as any).__setNetworkState(false, false);
    (taskApi.fetchTasks as jest.Mock).mockRejectedValue(new Error('Network unreachable'));

    fireEvent.press(screen.getByTestId('refresh-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('IDLE');
    });

    // Error banner is cleanly suppressed
    expect(screen.getByTestId('error-message').props.children).toBe('NO_ERROR');

    // Restore online
    (Network as any).__setNetworkState(true, true);
  });

  it('reconciles offline completion with additionalPhotos preserving photos on cold boot', async () => {
    const initialTasks = [mockTasksData[3]]; // task-4
    await AsyncStorage.setItem(
      '@klir:tasks:maintenance:user-tech-1',
      JSON.stringify(initialTasks),
    );

    await queueOfflineCompletion({
      taskId: 'task-4',
      completedAt: new Date('2026-08-15T06:00:00Z').toISOString(),
      acknowledgedAt: new Date('2026-08-15T04:00:00Z').toISOString(),
      checklist: {} as any,
      remarks: 'Sanitized offline with extra photos',
      beforePhotoLocalUri: 'file:///before.jpg',
      afterPhotoLocalUri: 'file:///after.jpg',
      additionalPhotos: [
        {
          id: 'area-1',
          areaTag: 'Stall 1',
          localUri: 'file:///stall1.jpg',
          capturedAt: new Date('2026-08-15T05:30:00Z').toISOString(),
        },
      ],
      biometricVerified: true,
      completedBy: 'user-tech-1',
      offlineSynced: false,
    });

    (taskApi.fetchTasks as jest.Mock).mockRejectedValue(new Error('Network request failed'));

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

    expect(screen.getByTestId('active-count').props.children).toBe(0);
    expect(screen.getByTestId('history-count').props.children).toBe(1);

    // Verify additionalPhotos are preserved in task
    const taskRow = screen.getByTestId('task-row-task-4');
    expect(taskRow.props.children.join('')).toContain(':1:');
  });

  it('reconciles multiple offline completion bundles for team task on cold boot', async () => {
    const teamTask: Task = {
      ...mockTasksData[3],
      id: 'task-team-1',
      assignedToIds: ['user-tech-1', 'user-tech-2'],
      submissions: {},
      status: 'acknowledged',
    };
    await AsyncStorage.setItem(
      '@klir:tasks:maintenance:user-tech-1',
      JSON.stringify([teamTask]),
    );

    // Queue 2 offline completion bundles: one for tech-2, one for tech-1
    await queueOfflineCompletion({
      taskId: 'task-team-1',
      completedAt: new Date('2026-08-15T05:00:00Z').toISOString(),
      acknowledgedAt: new Date('2026-08-15T04:00:00Z').toISOString(),
      checklist: {} as any,
      remarks: 'Tech 2 done',
      beforePhotoLocalUri: 'file:///before2.jpg',
      afterPhotoLocalUri: 'file:///after2.jpg',
      biometricVerified: true,
      completedBy: 'user-tech-2',
      offlineSynced: false,
    });
    await queueOfflineCompletion({
      taskId: 'task-team-1',
      completedAt: new Date('2026-08-15T06:00:00Z').toISOString(),
      acknowledgedAt: new Date('2026-08-15T04:00:00Z').toISOString(),
      checklist: {} as any,
      remarks: 'Tech 1 done',
      beforePhotoLocalUri: 'file:///before1.jpg',
      afterPhotoLocalUri: 'file:///after1.jpg',
      biometricVerified: true,
      completedBy: 'user-tech-1',
      offlineSynced: false,
    });

    (taskApi.fetchTasks as jest.Mock).mockRejectedValue(new Error('Network request failed'));

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

    // Both assignees submitted -> fully completed!
    expect(screen.getByTestId('active-count').props.children).toBe(0);
    expect(screen.getByTestId('history-count').props.children).toBe(1);

    const taskRow = screen.getByTestId('task-row-task-team-1');
    expect(taskRow.props.children.join('')).toContain('completed');
    expect(taskRow.props.children.join('')).toContain('user-tech-2,user-tech-1');
  });
});

