import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TaskExecutionModal } from '../../components/TaskExecutionModal';
import type { Task } from '../../types';

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      uid: 'user-tech-1',
      email: 'tech@sdca.edu.ph',
      name: 'Alex Tech',
      role: 'maintenance',
      building: 'GB3',
    },
  }),
}));

jest.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    refreshTasks: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../lib/native-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///mock/photo.jpg' }],
  }),
  CameraType: { back: 'back' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///mock/manipulated.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('../../lib/task-completion', () => ({
  completeTaskOnline: jest.fn().mockResolvedValue(undefined),
  currentUserId: jest.fn().mockReturnValue('user-tech-1'),
  isOnlineAsync: jest.fn().mockResolvedValue(true),
  queueOfflineCompletion: jest.fn().mockResolvedValue(undefined),
}));

const mockTask: Task = {
  id: 'task-modal-1',
  deviceId: 'SF-DEV-001',
  building: 'GB3',
  floor: 'Ground',
  location: 'toilet-01',
  component: 'flush_valve',
  triggerType: 'hardware_failure',
  status: 'acknowledged',
  assignedTo: 'user-tech-1',
  shift: '1st',
  type: 'maintenance',
  message: 'Flush valve stuck',
  createdAt: new Date('2026-08-16T08:00:00Z'),
  createdBy: 'system',
  acknowledgedAt: new Date('2026-08-16T08:05:00Z'),
  completedAt: null,
  completedBy: null,
  beforePhotoUrl: null,
  beforePhotoCapturedAt: null,
  afterPhotoUrl: null,
  afterPhotoCapturedAt: null,
  checklist: undefined,
  remarks: undefined,
  biometricVerified: false,
};

describe('TaskExecutionModal', () => {
  it('renders Step 1 (Proof Photo) when visible', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <TaskExecutionModal
        visible={true}
        task={mockTask}
        onDismiss={onDismiss}
      />,
    );

    expect(getByText('Step 1 of 3 • Proof Photo')).toBeTruthy();
    expect(getByText('Capture Initial Condition')).toBeTruthy();
    expect(getByText('Take Proof Photo')).toBeTruthy();
  });

  it('calls onDismiss when close button is pressed', () => {
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <TaskExecutionModal
        visible={true}
        task={mockTask}
        onDismiss={onDismiss}
      />,
    );

    const closeBtn = getByLabelText('Close execution sheet');
    fireEvent.press(closeBtn);
    expect(onDismiss).toHaveBeenCalled();
  });

  it('progresses to checklist after taking before photo', async () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <TaskExecutionModal
        visible={true}
        task={mockTask}
        onDismiss={onDismiss}
      />,
    );

    const takePhotoBtn = getByText('Take Proof Photo');
    fireEvent.press(takePhotoBtn);

    await waitFor(() => {
      expect(getByText('Step 2 of 3 • Maintenance Checklist')).toBeTruthy();
      expect(getByText('SDCA F-TGS 203 Checklist')).toBeTruthy();
    });
  });

  it('retains Step 2 (Checklist) state when parent re-renders with fresh task reference from polling', async () => {
    const onDismiss = jest.fn();
    const { getByText, rerender, queryByText } = render(
      <TaskExecutionModal
        visible={true}
        task={mockTask}
        onDismiss={onDismiss}
      />,
    );

    // 1. Take photo to move to Step 2
    fireEvent.press(getByText('Take Proof Photo'));

    await waitFor(() => {
      expect(getByText('Step 2 of 3 • Maintenance Checklist')).toBeTruthy();
    });

    // 2. Simulate background polling interval triggering parent re-render with a new task reference
    const polledTask: Task = { ...mockTask };
    rerender(
      <TaskExecutionModal
        visible={true}
        task={polledTask}
        onDismiss={onDismiss}
      />,
    );

    // 3. Confirm modal stays on Step 2 (Checklist) and is NOT reset to Step 1
    expect(getByText('Step 2 of 3 • Maintenance Checklist')).toBeTruthy();
    expect(queryByText('Step 1 of 3 • Proof Photo')).toBeNull();
  });
});
