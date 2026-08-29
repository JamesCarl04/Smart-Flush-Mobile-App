import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import {
  SupervisorDashboardScreen,
  TeamAvailabilityScreen,
  SupervisorTasksScreen,
  SupervisorTaskDetailScreen,
  CompletedReviewsScreen,
  CompletedReviewDetailScreen,
  SupervisorReportsScreen,
} from '../../../screens/SupervisorScreens';
import { SupervisorProvider } from '../../../contexts/SupervisorContext';
import * as supervisorApi from '../../../lib/supervisor-api';
import * as useAuthHook from '../../../hooks/useAuth';
import type { Task } from '../../../types';

jest.mock('../../../lib/supervisor-api', () => {
  const actual = jest.requireActual('../../../lib/supervisor-api');
  return {
    ...actual,
    fetchSupervisorTasks: jest.fn(),
    fetchMaintenancePersonnel: jest.fn(),
    reassignTask: jest.fn(),
    flagTask: jest.fn(),
    approveTask: jest.fn(),
  };
});
jest.mock('../../../hooks/useAuth');
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

const renderWithSupervisor = (ui: React.ReactElement) => {
  return render(
    <PaperProvider>
      <SupervisorProvider>{ui}</SupervisorProvider>
    </PaperProvider>,
  );
};

const mockPersonnel: supervisorApi.MaintenancePerson[] = [
  {
    id: 'person-1',
    displayName: 'Juan Cruz',
    email: 'juan@smartflush.com',
    isAvailable: true,
    currentTaskId: null,
    shift: '1st',
    building: 'GB3 Building',
    supervisorUid: 'sup-user-1',
  },
  {
    id: 'person-2',
    displayName: 'Maria Santos',
    email: 'maria@smartflush.com',
    isAvailable: false,
    currentTaskId: 'task-active-1',
    shift: '1st',
    building: 'GB3 Building',
    supervisorUid: 'sup-user-1',
  },
  {
    id: 'person-3',
    displayName: 'Pedro Reyes',
    email: 'pedro@smartflush.com',
    isAvailable: false,
    status: 'offline',
    currentTaskId: null,
    shift: '1st',
    building: 'GB3 Building',
    supervisorUid: 'sup-user-1',
  },
];

const mockSupervisorTasks: Task[] = [
  {
    id: 'task-active-1',
    deviceId: 'dev-pipe-1',
    restroomName: '2F Male Restroom',
    type: 'maintenance',
    component: 'pipe',
    location: '2F Male Restroom',
    floor: '2F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Urgent leak in main water feed',
    assignedTo: 'person-2',
    status: 'assigned',
    createdAt: new Date(),
    assignedAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'task-unassigned-2',
    deviceId: 'dev-toilet-2',
    restroomName: '3F Female Restroom',
    type: 'maintenance',
    component: 'toilet_bowl',
    location: '3F Female Restroom',
    floor: '3F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'hardware_failure',
    message: 'Unassigned toilet flush sensor malfunction',
    assignedTo: null,
    status: 'unassigned',
    createdAt: new Date(),
    createdBy: 'system',
  },
  {
    id: 'task-completed-3',
    deviceId: 'dev-valve-3',
    restroomName: '1F Lobby Restroom',
    type: 'maintenance',
    component: 'flush_valve',
    location: '1F Lobby Restroom',
    floor: '1F',
    building: 'GB3 Building',
    shift: '1st',
    triggerType: 'maintenance',
    message: 'Replaced solenoid flush valve',
    assignedTo: 'person-1',
    status: 'completed',
    completedBy: 'person-1',
    createdAt: new Date(),
    completedAt: new Date(),
    responseTime: 90,
    workDuration: 300,
    totalTime: 390,
    biometricVerified: true,
    beforePhotoUrl: 'https://storage.example.com/before.jpg',
    afterPhotoUrl: 'https://storage.example.com/after.jpg',
    remarks: 'Replaced gasket and calibrated flow rate.',
    checklist: {
      removeCeilingDust: 'done',
      removeWallDust: 'done',
      removeLightBulbDust: 'done',
      cleanWindows: 'na',
      wipeDownFixtures: 'na',
      disinfectTouchedSurfaces: 'done',
      sweepAndDryFloors: 'done',
      emptyTrashBins: 'done',
      arrangeFixtures: 'na',
      disinfectUVLights: 'done',
    },
    createdBy: 'system',
  },
];

describe('Supervisor Screens Integration Suite', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'sup-user-1',
        email: 'supervisor@smartflush.com',
        role: 'supervisor',
        name: 'Supervisor Chief',
        building: 'GB3 Building',
      },
      role: 'supervisor',
      loading: false,
      logout: jest.fn(),
    });

    (supervisorApi.fetchSupervisorTasks as jest.Mock).mockResolvedValue(mockSupervisorTasks);
    (supervisorApi.fetchMaintenancePersonnel as jest.Mock).mockResolvedValue(mockPersonnel);
    (supervisorApi.reassignTask as jest.Mock).mockResolvedValue(undefined);
    (supervisorApi.flagTask as jest.Mock).mockResolvedValue(undefined);
  });

  describe('SupervisorDashboardScreen', () => {
    it('displays active tasks today, staff counts (available, on task, offline), and unassigned tasks', async () => {
      renderWithSupervisor(
        <SupervisorDashboardScreen
          navigation={mockNavigation}
          route={{ key: 'SupervisorDashboard', name: 'SupervisorDashboard' }}
        />,
      );

      await waitFor(() => {
        expect(supervisorApi.fetchSupervisorTasks).toHaveBeenCalled();
      });

      // Active tasks today: task-active-1, task-unassigned-2 -> 2
      expect(screen.getByText('Active Tasks')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();

      // Personnel breakdown: 1 available (Juan), 1 on task (Maria), 1 offline (Pedro)
      expect(screen.getByText('Team Availability')).toBeTruthy();
      expect(screen.getAllByText('1 Available').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1 On Task').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1 Offline').length).toBeGreaterThan(0);

      // Unassigned tasks: task-unassigned-2 -> 1
      expect(screen.getByText('Unassigned')).toBeTruthy();
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('navigates to management screens on button presses', async () => {
      renderWithSupervisor(
        <SupervisorDashboardScreen
          navigation={mockNavigation}
          route={{ key: 'SupervisorDashboard', name: 'SupervisorDashboard' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('Tasks'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SupervisorTasks');

      fireEvent.press(screen.getByText('Team'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('TeamAvailability');

      fireEvent.press(screen.getByText('Completed Tasks'));
      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('CompletedReviews');
      });

      fireEvent.press(screen.getByText('Reports & Export'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SupervisorReports');
    });
  });

  describe('TeamAvailabilityScreen', () => {
    it('displays staff list with status tags and active task descriptions', async () => {
      renderWithSupervisor(<TeamAvailabilityScreen />);

      await waitFor(() => {
        expect(screen.getByText('Juan Cruz')).toBeTruthy();
      });

      expect(screen.getByText('Available')).toBeTruthy();
      expect(screen.getByText('Maria Santos')).toBeTruthy();
      expect(screen.getByText('On Task')).toBeTruthy();
      expect(screen.getByText(/Urgent leak in main water feed/)).toBeTruthy();
      expect(screen.getByText('Pedro Reyes')).toBeTruthy();
      expect(screen.getByText('Offline')).toBeTruthy();
    });
  });

  describe('SupervisorTasksScreen & SupervisorTaskDetailScreen', () => {
    it('lists active tasks and opens task detail on press', async () => {
      renderWithSupervisor(
        <SupervisorTasksScreen
          navigation={mockNavigation}
          route={{ key: 'SupervisorTasks', name: 'SupervisorTasks' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('2F Male Restroom')).toBeTruthy();
      });

      expect(screen.getByText('3F Female Restroom')).toBeTruthy();
      // Completed task is excluded from active list
      expect(screen.queryByText('1F Lobby Restroom')).toBeNull();

      fireEvent.press(screen.getByText('3F Female Restroom'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('SupervisorTaskDetail', {
        taskId: 'task-unassigned-2',
      });
    });

    it('submits reassignment for an unassigned or assigned task', async () => {
      renderWithSupervisor(
        <SupervisorTaskDetailScreen
          navigation={mockNavigation}
          route={{
            key: 'SupervisorTaskDetail',
            name: 'SupervisorTaskDetail',
            params: { taskId: 'task-unassigned-2' },
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('3F Female Restroom')).toBeTruthy();
      });

      // Available staff: Juan Cruz (person-1)
      expect(screen.getByText('Juan Cruz')).toBeTruthy();

      // Select Juan Cruz
      fireEvent.press(screen.getByText('Juan Cruz'));

      // Change Reason
      const reasonInput = screen.getByDisplayValue('Manual reassignment');
      fireEvent.changeText(reasonInput, 'Priority reassignment to available technician');

      // Submit reassignment
      const reassignButton = screen.getByText('Reassign Task');
      fireEvent.press(reassignButton);

      await waitFor(() => {
        expect(supervisorApi.reassignTask).toHaveBeenCalledWith({
          taskId: 'task-unassigned-2',
          newAssigneeUid: 'person-1',
          reason: 'Priority reassignment to available technician',
          supervisorUid: 'sup-user-1',
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Task reassigned.')).toBeTruthy();
      });
    });
  });

  describe('CompletedReviewsScreen & CompletedReviewDetailScreen', () => {
    it('lists today completed tasks and opens detail view', async () => {
      renderWithSupervisor(
        <CompletedReviewsScreen
          navigation={mockNavigation}
          route={{ key: 'CompletedReviews', name: 'CompletedReviews' }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('1F Lobby Restroom')).toBeTruthy();
      });

      fireEvent.press(screen.getByText('1F Lobby Restroom'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('CompletedReviewDetail', {
        taskId: 'task-completed-3',
      });
    });

    it('displays completion details, checklist, proof metrics, and allows approving and flagging task', async () => {
      (supervisorApi.approveTask as jest.Mock).mockResolvedValue(undefined);
      (supervisorApi.flagTask as jest.Mock).mockResolvedValue(undefined);

      renderWithSupervisor(
        <CompletedReviewDetailScreen
          navigation={mockNavigation}
          route={{
            key: 'CompletedReviewDetail',
            name: 'CompletedReviewDetail',
            params: { taskId: 'task-completed-3' },
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Checklist')).toBeTruthy();
      });

      expect(screen.getByText('Biometric Verified')).toBeTruthy();
      expect(screen.getByText('Notes: Replaced gasket and calibrated flow rate.')).toBeTruthy();
      expect(screen.getByText('Response time: 1 min 30 sec')).toBeTruthy();
      expect(screen.getByText('Duration: 5 min 0 sec')).toBeTruthy();

      // Test Approve Task
      fireEvent.press(screen.getByText('Approve Task'));
      await waitFor(() => {
        expect(supervisorApi.approveTask).toHaveBeenCalledWith({
          taskId: 'task-completed-3',
          supervisorUid: 'sup-user-1',
          supervisorName: 'Supervisor Chief',
        });
      });

      // Open Flag Dialog
      fireEvent.press(screen.getByText('Flag for Re-inspection'));

      await waitFor(() => {
        expect(screen.getAllByText('Flag for Re-inspection').length).toBeGreaterThan(0);
      });

      const reasonInput = screen.getByDisplayValue('Requires re-inspection');
      fireEvent.changeText(reasonInput, 'Water pressure is still suboptimal.');

      fireEvent.press(screen.getByText('Flag Task'));

      await waitFor(() => {
        expect(supervisorApi.flagTask).toHaveBeenCalledWith({
          taskId: 'task-completed-3',
          reason: 'Water pressure is still suboptimal.',
          supervisorUid: 'sup-user-1',
          supervisorName: 'Supervisor Chief',
          flagPhotoUrls: [],
        });
      });

      await waitFor(() => {
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });
  });

  describe('SupervisorReportsScreen', () => {
    it('renders audit KPI cards and completed submissions feed', async () => {
      renderWithSupervisor(
        <SupervisorReportsScreen
          navigation={mockNavigation}
          route={{
            key: 'SupervisorReports',
            name: 'SupervisorReports',
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Tasks Completed')).toBeTruthy();
      });

      expect(screen.getByText('Inspection Overview')).toBeTruthy();
      expect(screen.getByText('Avg Resolution Time')).toBeTruthy();
      expect(screen.getByText('Photo Proof')).toBeTruthy();
      expect(screen.getByText('Biometric Verified')).toBeTruthy();
      expect(screen.getAllByText('Export Reports').length).toBeGreaterThan(0);
      expect(screen.getByText('Export PDF Report')).toBeTruthy();
      expect(screen.getByText('Export CSV')).toBeTruthy();

      const exportActions = screen.getByTestId('supervisor-export-actions');
      expect(StyleSheet.flatten(exportActions.props.style)).toMatchObject({
        width: '100%',
      });

      const pdfButton = screen.getByTestId('supervisor-export-pdf');
      const pdfContainer = (pdfButton as any).parent;
      expect(StyleSheet.flatten(pdfContainer?.props.style)).toMatchObject({
        width: '100%',
        minWidth: 0,
      });
    });

    it('keeps export actions disabled when the timeframe has no completed tasks', async () => {
      await AsyncStorage.clear();
      (supervisorApi.fetchSupervisorTasks as jest.Mock).mockResolvedValue([]);

      renderWithSupervisor(
        <SupervisorReportsScreen
          navigation={mockNavigation}
          route={{
            key: 'SupervisorReports-empty',
            name: 'SupervisorReports',
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('No completed tasks')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByTestId('supervisor-export-pdf').props.accessibilityState).toMatchObject({
          disabled: true,
        });
        expect(screen.getByTestId('supervisor-export-csv').props.accessibilityState).toMatchObject({
          disabled: true,
        });
      });
    });
  });
});
