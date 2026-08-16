import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImageManipulator from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';

import { TaskDetailScreen } from '../../../screens/TaskDetailScreen';
import * as taskApi from '../../../lib/task-api';
import * as taskCompletion from '../../../lib/task-completion';
import * as imagePicker from '../../../lib/native-image-picker';
import * as useAuthHook from '../../../hooks/useAuth';
import * as useTasksHook from '../../../hooks/useTasks';
import { CHECKLIST_LABELS } from '../../../lib/tasks';
import type { Task } from '../../../types';

jest.mock('../../../lib/task-api');
jest.mock('../../../lib/task-completion');
jest.mock('../../../lib/native-image-picker');
jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useTasks');

const initialMockTask: Task = {
  id: 'task-flow-123',
  deviceId: 'FShQvy5eRcTVcREcNbns',
  restroomName: 'Restroom 1',
  type: 'maintenance',
  component: 'flush_valve',
  location: '2F Male Restroom',
  floor: '2F',
  building: 'GB3 Building',
  shift: '1st',
  triggerType: 'hardware_failure',
  message: 'Continuous water flow and low water pressure.',
  assignedTo: 'user-tech-1',
  status: 'assigned',
  createdAt: new Date('2026-08-15T08:00:00Z'),
  createdBy: 'system',
};

describe('TaskDetailScreen Integration - 3-Step Completion Flow', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    key: 'TaskDetail',
    name: 'TaskDetail',
    params: { taskId: 'task-flow-123' },
  };

  const mockRefreshTasks = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-1',
        email: 'tech1@smartflush.com',
        role: 'maintenance',
        name: 'Alex Technician',
        building: 'GB3 Building',
      },
      role: 'maintenance',
      loading: false,
      logout: jest.fn(),
    });

    let currentMockTask: Task = { ...initialMockTask };

    (useTasksHook.useTasks as jest.Mock).mockImplementation(() => ({
      tasks: [currentMockTask],
      inboxTasks: [currentMockTask],
      historyTasks: [],
      pendingCount: 1,
      loading: false,
      errorMessage: null,
      refreshTasks: mockRefreshTasks,
      clearError: jest.fn(),
    }));

    (taskApi.fetchTask as jest.Mock).mockImplementation(async () => currentMockTask);
    (taskApi.acknowledgeTask as jest.Mock).mockImplementation(async () => {
      currentMockTask = {
        ...currentMockTask,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      };
    });
    (taskCompletion.isOnlineAsync as jest.Mock).mockResolvedValue(true);
    (taskCompletion.currentUserId as jest.Mock).mockReturnValue('user-tech-1');
    (taskCompletion.completeTaskOnline as jest.Mock).mockResolvedValue(undefined);
    (taskCompletion.queueOfflineCompletion as jest.Mock).mockResolvedValue(undefined);

    (imagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });

    (imagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///mock/captured-photo.jpg',
          width: 1200,
          height: 900,
        },
      ],
    });

    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({
      uri: 'file:///mock/manipulated.jpg',
      width: 800,
      height: 600,
    });

    (captureRef as jest.Mock).mockResolvedValue('file:///mock/stamped-overlay.jpg');

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: true,
    });
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <TaskDetailScreen navigation={mockNavigation} route={mockRoute} />
      </PaperProvider>,
    );
  };

  it('renders initial task details in "details" step', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Restroom 1')).toBeTruthy();
    });

    expect(screen.getByText('2F • 2F Male Restroom • GB3 Building')).toBeTruthy();
    expect(screen.getByText('1st Shift')).toBeTruthy();
    expect(screen.getAllByText('Flush Valve').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Continuous water flow and low water pressure.')).toBeTruthy();
    expect(screen.getByText('Acknowledge Task')).toBeTruthy();
  });

  it('acknowledges task, calls acknowledgeTask API, and updates button to "Take Proof Photo"', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Acknowledge Task')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Acknowledge Task'));

    await waitFor(() => {
      expect(taskApi.acknowledgeTask).toHaveBeenCalledWith('task-flow-123');
      expect(mockRefreshTasks).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Task acknowledged. Proceed to the location.')).toBeTruthy();
      expect(screen.getByText('Take Proof Photo')).toBeTruthy();
    });
  });

  it('executes end-to-end 3-step completion flow: details -> checklist -> summary -> online submit', async () => {
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Acknowledge Task')).toBeTruthy();
    });

    // 1. Acknowledge task first
    fireEvent.press(screen.getByText('Acknowledge Task'));
    await waitFor(() => {
      expect(screen.getByText('Take Proof Photo')).toBeTruthy();
    });

    // 2. Start completion flow (Biometric auth + Before photo)
    fireEvent.press(screen.getByText('Take Proof Photo'));

    await waitFor(() => {
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
      expect(imagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(imagePicker.launchCameraAsync).toHaveBeenCalled();
    });

    // 3. Verify transition to Step 2: 'checklist'
    await waitFor(() => {
      expect(screen.getByText('SDCA F-TGS 203 Checklist')).toBeTruthy();
    });

    // Check that clicking "Take After Photo" with incomplete checklist shows validation snackbar
    fireEvent.press(screen.getByText('Take After Photo'));
    await waitFor(() => {
      expect(
        screen.getByText('Set every checklist item to Done or N/A before proceeding.'),
      ).toBeTruthy();
    });

    // Fill every checklist item to 'Done'
    const doneButtons = screen.getAllByText('Done');
    doneButtons.forEach((btn) => {
      fireEvent.press(btn);
    });

    // Add remarks
    const remarksInput = screen.getByTestId('remarks-input');
    fireEvent.changeText(remarksInput, 'Replaced diaphragm and tested flush cycle.');

    // Capture after photo
    fireEvent.press(screen.getByText('Take After Photo'));

    // 4. Verify transition to Step 3: 'summary'
    await waitFor(() => {
      expect(screen.getByText('Completion Summary')).toBeTruthy();
    });

    expect(screen.getByText(/Remarks: Replaced diaphragm and tested flush cycle./)).toBeTruthy();
    expect(screen.getByText('Biometric: Verified')).toBeTruthy();

    // 5. Submit completion online
    fireEvent.press(screen.getByText('Submit Completion'));

    await waitFor(() => {
      expect(taskCompletion.completeTaskOnline).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-flow-123',
          remarks: 'Replaced diaphragm and tested flush cycle.',
          biometricVerified: true,
          completedBy: 'user-tech-1',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Task completed and synced.')).toBeTruthy();
      expect(mockRefreshTasks).toHaveBeenCalled();
    });
  });

  it('queues completion offline when device is offline', async () => {
    (taskCompletion.isOnlineAsync as jest.Mock).mockResolvedValue(false);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Acknowledge Task')).toBeTruthy();
    });

    // Acknowledge
    fireEvent.press(screen.getByText('Acknowledge Task'));
    await waitFor(() => {
      expect(screen.getByText('Take Proof Photo')).toBeTruthy();
    });

    // Take Before Photo
    fireEvent.press(screen.getByText('Take Proof Photo'));
    await waitFor(() => {
      expect(screen.getByText('SDCA F-TGS 203 Checklist')).toBeTruthy();
    });

    // Mark all items
    const doneButtons = screen.getAllByText('Done');
    doneButtons.forEach((btn) => {
      fireEvent.press(btn);
    });

    // Capture after photo
    fireEvent.press(screen.getByText('Take After Photo'));

    await waitFor(() => {
      expect(screen.getByText('Completion Summary')).toBeTruthy();
    });

    // Submit completion while offline
    fireEvent.press(screen.getByText('Submit Completion'));

    await waitFor(() => {
      expect(taskCompletion.queueOfflineCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-flow-123',
          biometricVerified: true,
          completedBy: 'user-tech-1',
          offlineSynced: false,
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Saved offline. Will sync when connected.')).toBeTruthy();
    });
  });
});
