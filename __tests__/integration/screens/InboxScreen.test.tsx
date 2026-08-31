import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { InboxScreen } from '../../../screens/InboxScreen';
import { AuthContext } from '../../../contexts/AuthContext';
import * as useTasksHook from '../../../hooks/useTasks';
import type { Task } from '../../../types';

jest.mock('../../../hooks/useTasks');
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

const mockInboxTasks: Task[] = [
  {
    id: 'task-assigned-1',
    deviceId: 'FShQvy5eRcTVcREcNbns',
    restroomName: 'Restroom 1',
    type: 'maintenance',
    component: 'flush_valve',
    location: '2F Male Restroom',
    floor: '2F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'manual',
    message: 'Continuous water running detected in flush valve',
    assignedTo: 'user-tech-1',
    status: 'assigned',
    createdAt: new Date('2026-08-15T08:00:00Z'),
    createdBy: 'system',
  },
  {
    id: 'task-ack-2',
    deviceId: 'toilet-01',
    restroomName: 'Restroom 2',
    type: 'cleaning',
    component: 'floor',
    location: '1F Female Restroom',
    floor: '1F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'manual',
    message: 'Spill cleanup requested',
    assignedTo: 'user-tech-1',
    status: 'acknowledged',
    createdAt: new Date('2026-08-15T08:15:00Z'),
    acknowledgedAt: new Date('2026-08-15T08:20:00Z'),
    createdBy: 'staff',
  },
  {
    id: 'task-reassign-3',
    deviceId: 'dev-urgent-3',
    restroomName: 'Restroom 3',
    type: 'maintenance',
    component: 'pipe',
    location: '3F Restroom',
    floor: '3F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Main pipe pressure anomaly',
    assignedTo: 'user-tech-2',
    status: 'reassignment_needed',
    createdAt: new Date('2026-08-15T08:30:00Z'),
    createdBy: 'system',
  },
  {
    id: 'task-flagged-4',
    deviceId: 'dev-flagged-4',
    restroomName: 'Restroom 4',
    type: 'cleaning',
    component: 'mirror',
    location: '4F Restroom',
    floor: '4F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'maintenance',
    message: 'Glass streaks flagged by inspector',
    assignedTo: 'user-tech-1',
    status: 'flagged',
    flagReason: 'Mirrors have water streaks and counter is dusty',
    inspectedByName: 'Lead Supervisor',
    createdAt: new Date('2026-08-15T09:00:00Z'),
    createdBy: 'system',
  },
];

describe('InboxScreen Integration', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    key: 'InboxHome',
    name: 'InboxHome',
  };

  const mockRefreshTasks = jest.fn().mockResolvedValue(undefined);
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: mockInboxTasks,
      inboxTasks: mockInboxTasks,
      historyTasks: [],
      pendingCount: 2,
      loading: false,
      errorMessage: null,
      refreshTasks: mockRefreshTasks,
      clearError: mockClearError,
    });
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <AuthContext.Provider
          value={{
            user: {
              uid: 'user-tech-1',
              name: 'Technician Sam',
              email: 'tech@smartflush.com',
              role: 'maintenance',
              building: 'GB3',
            },
            role: 'maintenance',
            loading: false,
            logout: jest.fn(),
          } as any}
        >
          <InboxScreen navigation={mockNavigation} route={mockRoute} />
        </AuthContext.Provider>
      </PaperProvider>,
    );
  };

  it('renders summary counts and active task cards', () => {
    renderScreen();

    expect(screen.getByText("Today's Tasks")).toBeTruthy();

    // Summary counts
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // pendingCount
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);

    // Task cards content
    expect(screen.getByText('Continuous water running detected in flush valve')).toBeTruthy();
    expect(screen.getByText('Spill cleanup requested')).toBeTruthy();
    expect(screen.getAllByText('Main pipe pressure anomaly').length).toBeGreaterThan(0);
  });

  it('displays urgent priority card prioritizing reassignment_needed and navigates on press', () => {
    renderScreen();

    expect(screen.getByText('Open Priority Task')).toBeTruthy();

    fireEvent.press(screen.getByText('Open Priority Task'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('TaskDetail', {
      taskId: 'task-reassign-3',
    });
  });

  it('filters tasks using segmented filter: All, Active, and Flagged', () => {
    renderScreen();

    // Default 'All' filter shows active and flagged
    expect(screen.getByText('Continuous water running detected in flush valve')).toBeTruthy();
    expect(screen.getByText('Spill cleanup requested')).toBeTruthy();
    expect(screen.getByText('Glass streaks flagged by inspector')).toBeTruthy();

    // Select 'Active' filter
    const activeChip = screen.getByText('Active (2)');
    fireEvent.press(activeChip);

    expect(screen.getByText('Continuous water running detected in flush valve')).toBeTruthy();
    expect(screen.queryByText('Glass streaks flagged by inspector')).toBeNull();

    // Select 'Flagged' filter
    const flaggedChip = screen.getByText('Flagged (1)');
    fireEvent.press(flaggedChip);

    expect(screen.queryByText('Continuous water running detected in flush valve')).toBeNull();
    expect(screen.getByText('Glass streaks flagged by inspector')).toBeTruthy();
    expect(screen.getByText('Supervisor Remarks:')).toBeTruthy();

    // Select 'All' filter back
    const allChip = screen.getByText('All (4)');
    fireEvent.press(allChip);

    expect(screen.getByText('Continuous water running detected in flush valve')).toBeTruthy();
    expect(screen.getByText('Glass streaks flagged by inspector')).toBeTruthy();
  });

  it('navigates to TaskDetail with correct taskId when task card is pressed', () => {
    renderScreen();

    const taskHeadline = screen.getByText('Continuous water running detected in flush valve');
    fireEvent.press(taskHeadline);

    expect(mockNavigation.navigate).toHaveBeenCalledWith('TaskDetail', {
      taskId: 'task-assigned-1',
    });
  });

  it('opens FlaggedRemarksModal when Review Remarks button is clicked on a flagged task', async () => {
    renderScreen();

    const flaggedChip = screen.getByText('Flagged (1)');
    fireEvent.press(flaggedChip);

    const reviewBtn = screen.getByText('Review Remarks & Accept Recheck');
    fireEvent.press(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText('Flagged for Re-inspection')).toBeTruthy();
      expect(screen.getByText('Mirrors have water streaks and counter is dusty')).toBeTruthy();
      expect(screen.getByText('Accept Recheck')).toBeTruthy();
    });
  });

  it('renders empty state when there are no inbox tasks', () => {
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: [],
      inboxTasks: [],
      historyTasks: [],
      pendingCount: 0,
      loading: false,
      errorMessage: null,
      refreshTasks: mockRefreshTasks,
      clearError: mockClearError,
    });

    renderScreen();

    expect(screen.getByText('No pending tasks')).toBeTruthy();
  });
});
