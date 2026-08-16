import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { HistoryScreen } from '../../../screens/HistoryScreen';
import * as useTasksHook from '../../../hooks/useTasks';
import type { Task } from '../../../types';

jest.mock('../../../hooks/useTasks');

const now = new Date();
const todayCompletedDate = new Date(); // Current timestamp (guaranteed today)
const threeDaysAgoCompletedDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3);
const fifteenDaysAgoCompletedDate = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 15);

const mockHistoryTasks: Task[] = [
  {
    id: 'hist-1',
    deviceId: 'FShQvy5eRcTVcREcNbns',
    restroomName: 'Restroom 1',
    type: 'maintenance',
    component: 'sensor',
    location: '2F Male Restroom',
    floor: '2F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Fixed sensor sensitivity calibration',
    assignedTo: 'user-tech-1',
    status: 'completed',
    completedBy: 'user-tech-1',
    completedAt: todayCompletedDate,
    createdAt: new Date(todayCompletedDate.getTime() - 1000 * 60 * 15),
    workDuration: 330, // 5 min 30 sec
    beforePhotoUrl: 'https://storage.example.com/before.jpg',
    afterPhotoUrl: 'https://storage.example.com/after.jpg',
    createdBy: 'system',
  },
  {
    id: 'hist-2',
    deviceId: 'dev-lobby-1f',
    restroomName: 'Main Lobby 1F',
    type: 'cleaning',
    component: 'mirror',
    location: '1F Lobby Restroom',
    floor: '1F',
    building: 'GB3',
    shift: '1st',
    triggerType: 'maintenance',
    message: 'Cleaned mirror surfaces and sanitized counter',
    assignedTo: 'user-tech-1',
    status: 'completed',
    completedBy: 'user-tech-1',
    completedAt: threeDaysAgoCompletedDate,
    createdAt: new Date(threeDaysAgoCompletedDate.getTime() - 1000 * 60 * 10),
    workDuration: 120, // 2 min 0 sec
    beforePhotoUrl: 'https://storage.example.com/before2.jpg',
    afterPhotoUrl: 'https://storage.example.com/after2.jpg',
    createdBy: 'system',
  },
  {
    id: 'hist-3',
    deviceId: 'dev-exec-5f',
    restroomName: 'Executive Suite 5F',
    type: 'maintenance',
    component: 'valve',
    location: '5F Executive Restroom',
    floor: '5F',
    building: 'GB3',
    shift: '2nd',
    triggerType: 'hardware_failure',
    message: 'Replaced solenoid valve',
    assignedTo: 'user-tech-1',
    status: 'completed',
    completedBy: 'user-tech-1',
    completedAt: fifteenDaysAgoCompletedDate,
    createdAt: new Date(fifteenDaysAgoCompletedDate.getTime() - 1000 * 60 * 20),
    workDuration: 600, // 10 min 0 sec
    beforePhotoUrl: 'https://storage.example.com/before3.jpg',
    afterPhotoUrl: 'https://storage.example.com/after3.jpg',
    createdBy: 'system',
  },
];

describe('HistoryScreen Integration', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    key: 'HistoryHome',
    name: 'HistoryHome',
  };

  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTasksHook.useTasks as jest.Mock).mockReturnValue({
      tasks: mockHistoryTasks,
      inboxTasks: [],
      historyTasks: mockHistoryTasks,
      pendingCount: 0,
      loading: false,
      errorMessage: null,
      refreshTasks: jest.fn(),
      clearError: mockClearError,
    });
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <HistoryScreen navigation={mockNavigation} route={mockRoute} />
      </PaperProvider>,
    );
  };

  it('renders completed tasks with work duration metrics for default 7 days range', () => {
    renderScreen();

    expect(screen.getByText('Completed Work')).toBeTruthy();
    expect(screen.getByText('Tasks Completed')).toBeTruthy();

    // Default range is '7 days': includes hist-1 (today) and hist-2 (3 days ago)
    expect(screen.getByText('2')).toBeTruthy(); // count

    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.getByText('5 min 30 sec')).toBeTruthy();
    expect(screen.getByText('Main Lobby 1F')).toBeTruthy();
    expect(screen.getByText('2 min 0 sec')).toBeTruthy();

    // Excludes 15-day-old task in 7 days range
    expect(screen.queryByText('Executive Suite 5F')).toBeNull();
  });

  it('filters completed tasks by time range chips (Today, 7 days, All)', () => {
    renderScreen();

    // Switch to 'Today'
    fireEvent.press(screen.getByText('Today'));

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.queryByText('Main Lobby 1F')).toBeNull();
    expect(screen.queryByText('Executive Suite 5F')).toBeNull();

    // Switch to 'All'
    fireEvent.press(screen.getByText('All'));

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.getByText('Main Lobby 1F')).toBeTruthy();
    expect(screen.getByText('Executive Suite 5F')).toBeTruthy();
    expect(screen.getByText('10 min 0 sec')).toBeTruthy();

    // Switch back to '7 days'
    fireEvent.press(screen.getByText('7 days'));

    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.getByText('Main Lobby 1F')).toBeTruthy();
    expect(screen.queryByText('Executive Suite 5F')).toBeNull();
  });

  it('filters tasks by search input query matching restroom name and message', () => {
    renderScreen();

    // Switch to 'All' first so all candidate items are in range
    fireEvent.press(screen.getByText('All'));

    const searchInput = screen.getByTestId('text-input-outlined');

    // Search by message keyword
    fireEvent.changeText(searchInput, 'sensor');

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Restroom 1')).toBeTruthy();
    expect(screen.queryByText('Main Lobby 1F')).toBeNull();
    expect(screen.queryByText('Executive Suite 5F')).toBeNull();

    // Search by restroom name
    fireEvent.changeText(searchInput, 'Executive');

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Executive Suite 5F')).toBeTruthy();
    expect(screen.queryByText('Restroom 1')).toBeNull();

    // Clear search
    fireEvent.changeText(searchInput, '');
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('navigates to TaskDetail when a completed task card is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Restroom 1'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('TaskDetail', {
      taskId: 'hist-1',
    });
  });

  it('renders empty state when search produces no matching tasks', () => {
    renderScreen();

    const searchInput = screen.getByTestId('text-input-outlined');
    fireEvent.changeText(searchInput, 'nonexistent query 12345');

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('No completed tasks yet')).toBeTruthy();
  });
});
