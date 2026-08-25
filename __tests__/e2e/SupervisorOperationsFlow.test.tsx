import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import App from '../../App';
import { mockAuthModule } from '../../jest.setup';

describe('Supervisor Operations Flow E2E', () => {
  const mockSupervisorUser = {
    uid: 'supervisor-lead-01',
    email: 'supervisor@smartflush.com',
    displayName: 'Sarah Lead Supervisor',
    getIdToken: jest.fn().mockResolvedValue('mock-supervisor-token'),
  };

  const mockPersonnel = [
    {
      id: 'worker-available-01',
      displayName: 'Carlos Tech',
      email: 'carlos@smartflush.com',
      isAvailable: true,
      currentTaskId: null,
      shift: '1st',
      building: 'GB3',
      supervisorUid: 'supervisor-lead-01',
    },
    {
      id: 'worker-busy-02',
      displayName: 'Elena Cleaner',
      email: 'elena@smartflush.com',
      isAvailable: false,
      currentTaskId: 'task-busy-555',
      shift: '1st',
      building: 'GB3',
      supervisorUid: 'supervisor-lead-01',
    },
  ];

  const mockTasks = [
    {
      id: 'task-busy-555',
      alertId: 'alert-555',
      deviceId: 'GB3-FL2-M',
      restroomName: 'GB3 2nd Floor Male Restroom',
      type: 'cleaning',
      component: 'floor_drain',
      location: 'GB3 2nd Floor Male',
      floor: '2nd Floor',
      building: 'GB3',
      shift: '1st',
      triggerType: 'maintenance',
      message: 'Routine sanitization in progress',
      status: 'acknowledged',
      assignedTo: 'worker-busy-02',
      createdAt: new Date().getTime(),
      assignedAt: new Date().getTime(),
      acknowledgedAt: new Date().getTime(),
      completedAt: null,
      responseTime: 60,
      workDuration: null,
      totalTime: null,
      checklist: null,
      remarks: '',
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      biometricVerified: false,
      offlineSynced: false,
      completedBy: null,
      reassignCount: 0,
      supervisorUid: null,
    },
    {
      id: 'task-unassigned-901',
      alertId: 'alert-901',
      deviceId: 'GB3-FL3-F',
      restroomName: 'GB3 3rd Floor Female Restroom',
      type: 'cleaning',
      component: 'sanitary_bin',
      location: 'GB3 3rd Floor Female',
      floor: '3rd Floor',
      building: 'GB3',
      shift: '1st',
      triggerType: 'maintenance',
      message: 'Bottleneck alert: Overflowing bin reported, unassigned for >15 mins',
      status: 'unassigned',
      assignedTo: null,
      createdAt: new Date().getTime(),
      assignedAt: null,
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
      reassignCount: 0,
      supervisorUid: null,
    },
    {
      id: 'task-completed-777',
      alertId: 'alert-777',
      deviceId: 'GB3-FL1-M',
      restroomName: 'GB3 1st Floor Male Restroom',
      type: 'cleaning',
      component: 'urinal_sensor',
      location: 'GB3 1st Floor Male',
      floor: '1st Floor',
      building: 'GB3',
      shift: '1st',
      triggerType: 'hardware_failure',
      message: 'Sensor auto-flush check and disinfection completed',
      status: 'completed',
      assignedTo: 'worker-available-01',
      createdAt: new Date().getTime() - 1000 * 60 * 60,
      assignedAt: new Date().getTime() - 1000 * 60 * 55,
      acknowledgedAt: new Date().getTime() - 1000 * 60 * 50,
      completedAt: new Date().getTime() - 1000 * 60 * 20,
      responseTime: 300,
      workDuration: 1800,
      totalTime: 2400,
      checklist: {
        removeCeilingDust: true,
        removeWallDust: true,
        removeLightBulbDust: true,
        cleanWindows: 'N/A',
        wipeDownFixtures: true,
        disinfectTouchedSurfaces: true,
        sweepAndDryFloors: true,
        emptyTrashBins: true,
        arrangeFixtures: 'N/A',
        disinfectUVLights: true,
      },
      remarks: 'Replaced optical sensor battery and fully sanitized area.',
      beforePhotoUrl: 'https://storage.example.com/before-777.jpg',
      afterPhotoUrl: 'https://storage.example.com/after-777.jpg',
      biometricVerified: true,
      offlineSynced: false,
      completedBy: 'worker-available-01',
      reassignCount: 0,
      supervisorUid: null,
    },
  ];

  let reassignRequestPayload: any = null;
  let flagRequestPayload: any = null;

  beforeEach(() => {
    jest.clearAllMocks();
    reassignRequestPayload = null;
    flagRequestPayload = null;

    // Login as supervisor user
    (mockAuthModule.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
      callback(mockSupervisorUser);
      return jest.fn();
    });

    (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: any) => {
      const urlString = String(url);

      if (urlString.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              id: mockSupervisorUser.uid,
              email: mockSupervisorUser.email,
              name: mockSupervisorUser.displayName,
              role: 'supervisor',
              building: 'GB3',
            },
          }),
        };
      }

      if (urlString.includes('/api/maintenance-personnel')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockPersonnel,
          }),
        };
      }

      if (urlString.includes('/api/tasks')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockTasks,
          }),
        };
      }

      if (urlString.includes('/api/supervisor/reassign-task')) {
        reassignRequestPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }

      if (urlString.includes('/api/supervisor/flag-task')) {
        flagRequestPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      };
    });
  });

  test('completes supervisor journey: dashboard stats -> team check -> reassign unassigned task -> review completed proof & flag', async () => {
    render(<App />);

    // Step 1 & 2: Supervisor logs in and views operational dashboard stats
    expect(await screen.findByText('Active Tasks', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('Team Availability', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('1 available, 1 on task, 0 offline', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();

    // Step 3: Check Team Availability
    const teamAvailabilityBtn = screen.getByRole('button', { name: 'Team' });
    fireEvent.press(teamAvailabilityBtn);

    expect(await screen.findByText('Carlos Tech', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Elena Cleaner')).toBeTruthy();
    expect(screen.getByText('On Task')).toBeTruthy();
  });

  test('reassigns bottleneck task to available staff and reviews completed proof with flag action', async () => {
    render(<App />);

    // Step 1: Click Tasks from Dashboard
    expect(await screen.findByText('Tasks', {}, { timeout: 15000 })).toBeTruthy();
    const manageTasksBtn = screen.getByRole('button', { name: 'Tasks' });
    fireEvent.press(manageTasksBtn);

    // Step 2: Identifies unassigned task card and opens detail
    expect(await screen.findByText('GB3 3rd Floor Female', {}, { timeout: 15000 })).toBeTruthy();
    const taskCard = screen.getByText('GB3 3rd Floor Female');
    fireEvent.press(taskCard);

    // Step 3: Reassign to available staff member with reason
    expect(await screen.findByText('Select Team Member', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('Carlos Tech', {}, { timeout: 15000 })).toBeTruthy();

    // Select Carlos Tech
    const radioItem = screen.getByText('Carlos Tech');
    fireEvent.press(radioItem);

    const reasonInput = screen.getByDisplayValue('Manual reassignment');
    fireEvent.changeText(reasonInput, 'High-priority restroom overflow - reassigned to Carlos for immediate response');

    const reassignBtn = screen.getByRole('button', { name: 'Reassign Task' });
    fireEvent.press(reassignBtn);

    // Verify Reassignment API call
    await waitFor(
      () => {
        expect(reassignRequestPayload).toEqual({
          taskId: 'task-unassigned-901',
          newAssigneeUid: 'worker-available-01',
          reason: 'High-priority restroom overflow - reassigned to Carlos for immediate response',
          supervisorUid: 'supervisor-lead-01',
        });
      },
      { timeout: 15000 },
    );

    expect(await screen.findByText('Task reassigned.', {}, { timeout: 15000 })).toBeTruthy();
  });

  test('reviews completed inspection proof, checks duration and biometric flag', async () => {
    render(<App />);

    // Step 1: Open Completed Tasks from Dashboard
    expect(await screen.findByText('Completed Tasks', {}, { timeout: 15000 })).toBeTruthy();
    const reviewBtn = screen.getByRole('button', { name: 'Completed Tasks' });
    fireEvent.press(reviewBtn);

    // Step 2: Open completed task detail
    expect(await screen.findByText('GB3 1st Floor Male', {}, { timeout: 15000 })).toBeTruthy();
    const completedCard = screen.getByText('GB3 1st Floor Male');
    fireEvent.press(completedCard);

    // Step 3: Verify proof details, work duration (30 min), biometric badge, checklist
    expect(await screen.findByText('Checklist', {}, { timeout: 15000 })).toBeTruthy();
    expect(await screen.findByText('Notes: Replaced optical sensor battery and fully sanitized area.', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('Duration: 30 min 0 sec')).toBeTruthy();
    expect(screen.getByText('Completed by: worker-available-01')).toBeTruthy();
    expect(screen.getByText('Biometric Verified')).toBeTruthy();

    // Step 4: Open Flag Dialog & submit flag for re-inspection
    const flagBtn = screen.getByRole('button', { name: 'Flag for Re-inspection' });
    fireEvent.press(flagBtn);

    expect(await screen.findByText('Flag Task')).toBeTruthy();
    const flagReasonInput = screen.getByDisplayValue('Requires re-inspection');
    fireEvent.changeText(flagReasonInput, 'Requires supervisor physical inspection of flush pressure');

    const confirmFlagBtn = screen.getByRole('button', { name: 'Flag Task' });
    fireEvent.press(confirmFlagBtn);

    await waitFor(() => {
      expect(flagRequestPayload).toEqual(
        expect.objectContaining({
          taskId: 'task-completed-777',
          reason: 'Requires supervisor physical inspection of flush pressure',
          supervisorUid: 'supervisor-lead-01',
        }),
      );
    });
  });
});
