import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as Network from 'expo-network';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from '../../lib/native-image-picker';

import App from '../../App';
import { mockAuthModule, mockFirestoreDoc } from '../../jest.setup';

jest.mock('../../lib/native-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///mock/captured-before-photo.jpg',
        width: 1200,
        height: 900,
      },
    ],
  }),
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
  CameraType: {
    back: 'back',
    front: 'front',
  },
}));

describe('Worker Task Lifecycle Flow E2E', () => {
  const mockMaintenanceUser = {
    uid: 'worker-tech-001',
    email: 'technician@smartflush.com',
    displayName: 'Alex Technician',
    getIdToken: jest.fn().mockResolvedValue('mock-token-xyz'),
  };

  const initialTaskApiData: Record<string, any>[] = [
    {
      id: 'task-restroom-101',
      alertId: 'alert-999',
      deviceId: 'GB3-FL2-M',
      restroomName: 'GB3 2nd Floor Male Restroom',
      type: 'cleaning',
      component: 'flush_valve',
      location: 'GB3 2nd Floor Male',
      floor: '2nd Floor',
      building: 'GB3',
      shift: '1st',
      triggerType: 'maintenance',
      message: 'Urgent: High traffic cleaning alert and dispenser refill needed',
      status: 'assigned',
      assignedTo: 'worker-tech-001',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).getTime(), // 30 mins ago
      assignedAt: new Date(Date.now() - 1000 * 60 * 25).getTime(),
      acknowledgedAt: null,
      completedAt: null,
      responseTime: null,
      workDuration: null,
      totalTime: null,
      checklist: null,
      remarks: '',
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      biometricVerified: false,
      offlineSynced: false,
      completedBy: null,
    },
  ];

  let authStateCallback: ((user: any) => void) | null = null;
  let currentTasks: Record<string, any>[] = [...initialTaskApiData];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    (Network as any).__setNetworkState(true, true);
    currentTasks = JSON.parse(JSON.stringify(initialTaskApiData));

    // Setup auth state callback interceptor
    (mockAuthModule.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      authStateCallback = callback;
      callback(null); // start unauthenticated
      return jest.fn();
    });

    (mockAuthModule.signInWithEmailAndPassword as jest.Mock).mockImplementation(async () => {
      if (authStateCallback) {
        authStateCallback(mockMaintenanceUser);
      }
      return { user: mockMaintenanceUser };
    });

    // Mock backend REST API calls
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const urlString = String(url);

      if (urlString.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: mockMaintenanceUser.uid,
              email: mockMaintenanceUser.email,
              name: mockMaintenanceUser.displayName,
              role: 'maintenance',
              building: 'GB3',
            },
          }),
        };
      }

      if (urlString.includes('/api/tasks/task-restroom-101/acknowledge')) {
        currentTasks[0].status = 'acknowledged';
        currentTasks[0].acknowledgedAt = Date.now();
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, taskId: 'task-restroom-101' }),
        };
      }

      if (urlString.includes('/api/tasks/task-restroom-101')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: currentTasks[0],
          }),
        };
      }

      if (urlString.includes('/api/tasks')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: currentTasks,
          }),
        };
      }

      // Default mock for image fetch or other endpoints
      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(['mock-binary-image-data']),
        json: async () => ({ success: true }),
      };
    });
  });

  test('completes full worker lifecycle: login -> inbox -> acknowledge -> checklist -> biometric & photos -> complete -> history', async () => {
    render(<App />);

    // Step 1: User logs in with maintenance credentials
    expect(await screen.findByText('KLIR')).toBeTruthy();
    expect(screen.getAllByText('Login').length).toBeGreaterThan(0);

    const emailInput = screen.getAllByTestId('text-input-outlined')[0];
    const passwordInput = screen.getAllByTestId('text-input-outlined')[1];
    const signInButton = screen.getByRole('button', { name: /login/i });

    fireEvent.changeText(emailInput, 'technician@smartflush.com');
    fireEvent.changeText(passwordInput, 'ValidPassword123');
    fireEvent.press(signInButton);

    // Step 2: Views Inbox and selects high-priority restroom alert
    expect(await screen.findByText("Today's Tasks", {}, { timeout: 15000 })).toBeTruthy();
    expect((await screen.findAllByText('GB3 2nd Floor Male Restroom', {}, { timeout: 15000 })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Urgent: High traffic cleaning alert and dispenser refill needed', {}, { timeout: 15000 })).length).toBeGreaterThan(0);

    const openPriorityBtn = screen.getByText('Open Priority Task');
    fireEvent.press(openPriorityBtn);

    // Step 3: Acknowledges task
    expect(await screen.findByText('GB3 2nd Floor Male Restroom', {}, { timeout: 15000 })).toBeTruthy();

    const acknowledgeBtn = await screen.findByText('Acknowledge Task', {}, { timeout: 15000 });
    fireEvent.press(acknowledgeBtn);

    // Verify task acknowledged notification & status transition
    expect(await screen.findByText('Take Proof Photo', {}, { timeout: 15000 })).toBeTruthy();

    // Step 4 & 5: Trigger Before Photo & Biometric Verification
    const takeProofBtn = screen.getByText('Take Proof Photo');
    fireEvent.press(takeProofBtn);

    // Verify biometric authentication was prompted and camera photo taken
    await waitFor(
      () => {
        expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
      },
      { timeout: 15000 },
    );

    // Step 4b: Complete all 10 checklist items & remarks
    expect(await screen.findByText('SDCA F-TGS 203 Checklist', {}, { timeout: 15000 })).toBeTruthy();

    // Check all 'Done' buttons for the 10 items
    const doneButtons = screen.getAllByText('Done');
    expect(doneButtons.length).toBeGreaterThanOrEqual(10);
    doneButtons.forEach((btn) => {
      fireEvent.press(btn);
    });

    const remarksInput = screen.getByTestId('remarks-input');
    fireEvent.changeText(remarksInput, 'All fixtures disinfected, soap replenished, and floors dried.');

    // Step 4c: Capture After Photo
    const takeAfterPhotoBtn = screen.getByRole('button', { name: 'Take After Photo' });
    fireEvent.press(takeAfterPhotoBtn);

    await waitFor(
      () => {
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(2);
      },
      { timeout: 15000 },
    );

    // Step 6: Verify Completion Summary & Submit Online
    expect(await screen.findByText('Completion Summary', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('Biometric: Verified')).toBeTruthy();
    expect(screen.getByText('Remarks: All fixtures disinfected, soap replenished, and floors dried.')).toBeTruthy();

    const submitCompletionBtn = screen.getByRole('button', { name: 'Submit Completion' });
    fireEvent.press(submitCompletionBtn);

    // Verify Firestore task update called
    await waitFor(
      () => {
        expect(mockFirestoreDoc.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            remarks: 'All fixtures disinfected, soap replenished, and floors dried.',
            biometricVerified: true,
            completedBy: expect.any(String),
          }),
        );
      },
      { timeout: 15000 },
    );

    // Step 7: Navigates to History tab -> Verifies task is in history with calculated work duration
    // Update local state to reflect completed task in API response
    currentTasks[0] = {
      ...currentTasks[0],
      status: 'completed',
      completedBy: mockMaintenanceUser.uid,
      completedAt: Date.now(),
      workDuration: 300, // 5 minutes
      remarks: 'All fixtures disinfected, soap replenished, and floors dried.',
    };

    // Trigger the Alert.alert 'View History' action to navigate to History tab
    const alertCalls = (Alert.alert as jest.Mock).mock.calls;
    if (alertCalls.length > 0) {
      const buttons = alertCalls[alertCalls.length - 1][2];
      const viewHistoryBtn = buttons?.find((b: any) => b.text === 'View History');
      if (viewHistoryBtn?.onPress) {
        viewHistoryBtn.onPress();
      }
    }

    expect(await screen.findByText('Completed Work', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('GB3 2nd Floor Male Restroom', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('5 min 0 sec')).toBeTruthy();
    expect(screen.getByText('Proof submitted')).toBeTruthy();
  });
});
