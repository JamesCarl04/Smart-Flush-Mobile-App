import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as ImagePicker from '../../lib/native-image-picker';

import App from '../../App';
import { mockAuthModule, mockFirestoreDoc } from '../../jest.setup';
import { readOfflineCompletions, syncOfflineCompletions } from '../../lib/task-completion';

describe('Offline Resilience Flow E2E', () => {
  const mockMaintenanceUser = {
    uid: 'worker-offline-007',
    email: 'technician@smartflush.com',
    displayName: 'Offline Field Tech',
    getIdToken: jest.fn().mockResolvedValue('mock-token-offline'),
  };

  const initialTask = {
    id: 'task-offline-888',
    alertId: 'alert-888',
    deviceId: 'GB3-FL1-PWD',
    restroomName: 'GB3 1st Floor PWD Restroom',
    type: 'cleaning',
    component: 'grab_bar_and_sink',
    location: 'GB3 1st Floor PWD',
    floor: '1st Floor',
    building: 'GB3',
    shift: '1st',
    triggerType: 'maintenance',
    message: 'Scheduled sanitation and supply check for PWD restroom',
    status: 'acknowledged',
    assignedTo: 'worker-offline-007',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).getTime(),
    assignedAt: new Date(Date.now() - 1000 * 60 * 40).getTime(),
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 30).getTime(),
    completedAt: null,
    responseTime: 600,
    workDuration: null,
    totalTime: null,
    checklist: null,
    remarks: '',
    beforePhotoUrl: null,
    afterPhotoUrl: null,
    biometricVerified: false,
    offlineSynced: false,
    completedBy: null,
  };

  let currentTasks = [initialTask];

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (Network as any).__setNetworkState(true, true);
    currentTasks = [JSON.parse(JSON.stringify(initialTask))];

    // Auth starts directly logged in as technician
    (mockAuthModule.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(mockMaintenanceUser);
      return jest.fn();
    });

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

      return {
        ok: true,
        status: 200,
        blob: async () => new Blob(['offline-photo-bytes']),
        json: async () => ({ success: true }),
      };
    });
  });

  test('handles complete offline submission into AsyncStorage and syncs to Firestore upon reconnection', async () => {
    render(<App />);

    // Step 1: Open task detail while initial inbox is visible
    const taskCard = await screen.findByText('GB3 1st Floor PWD Restroom', {}, { timeout: 15000 });
    fireEvent.press(taskCard);

    expect(await screen.findByText('GB3 1st Floor PWD Restroom', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('Take Proof Photo', {}, { timeout: 15000 })).toBeTruthy();

    // Step 1b: Network goes offline (e.g. basement/isolated restroom without WiFi/cellular)
    (Network as any).__setNetworkState(false, false);

    // Step 2: Worker takes Before photo, completes checklist, and takes After photo offline
    const takeProofBtn = screen.getByText('Take Proof Photo');
    fireEvent.press(takeProofBtn);

    expect(await screen.findByText('SDCA F-TGS 203 Checklist', {}, { timeout: 15000 })).toBeTruthy();

    // Complete all checklist items
    const doneButtons = screen.getAllByText('Done');
    doneButtons.forEach((btn) => fireEvent.press(btn));

    const remarksInput = screen.getByTestId('remarks-input');
    fireEvent.changeText(remarksInput, 'Completed full sanitization while offline in basement.');

    const takeAfterBtn = screen.getByRole('button', { name: 'Take After Photo' });
    fireEvent.press(takeAfterBtn);

    // Step 3: Submits task while offline -> Queued in AsyncStorage ('offline_tasks')
    expect(await screen.findByText('Completion Summary', {}, { timeout: 15000 })).toBeTruthy();
    const submitBtn = screen.getByRole('button', { name: 'Submit Completion' });
    fireEvent.press(submitBtn);

    // Verify offline message displayed and task queued in AsyncStorage
    expect(await screen.findByText('Saved offline. Will sync when connected.', {}, { timeout: 15000 })).toBeTruthy();

    const queuedTasks = await readOfflineCompletions();
    expect(queuedTasks).toHaveLength(1);
    expect(queuedTasks[0].taskId).toBe('task-offline-888');
    expect(queuedTasks[0].remarks).toBe('Completed full sanitization while offline in basement.');
    expect(queuedTasks[0].offlineSynced).toBe(false);

    // Firestore update should NOT have happened yet because network was offline
    expect(mockFirestoreDoc.update).not.toHaveBeenCalled();

    // Step 4: Network comes back online
    (Network as any).__setNetworkState(true, true);

    // Step 5: Sync process executes (triggered by network reconnect or sync handler)
    const syncedCount = await syncOfflineCompletions();
    expect(syncedCount).toBe(1);

    // Verify Firestore status updated to 'completed' with offlineSynced: true
    expect(mockFirestoreDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        offlineSynced: true,
        remarks: 'Completed full sanitization while offline in basement.',
      }),
    );

    // Step 6: Verifies AsyncStorage queue is cleared
    const remainingQueued = await readOfflineCompletions();
    expect(remainingQueued).toHaveLength(0);
  });
});
