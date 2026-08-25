import { apiFetch } from '../../lib/api';
import {
  approveTask,
  fetchMaintenancePersonnel,
  flagTask,
  reassignTask,
  type MaintenancePerson,
} from '../../lib/supervisor-api';

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

describe('supervisor-api utility', () => {
  const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchMaintenancePersonnel', () => {
    it('should fetch and return maintenance personnel list', async () => {
      const mockPersonnel: MaintenancePerson[] = [
        {
          id: 'worker-1',
          displayName: 'John Doe',
          email: 'john@example.com',
          isAvailable: true,
          currentTaskId: null,
          shift: '1st',
          building: 'GB3',
          supervisorUid: 'sup-1',
        },
        {
          id: 'worker-2',
          displayName: 'Jane Smith',
          email: 'jane@example.com',
          isAvailable: false,
          currentTaskId: 'task-555',
          shift: '2nd',
          building: 'GB3',
          supervisorUid: 'sup-1',
        },
      ];

      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: mockPersonnel,
      });

      const result = await fetchMaintenancePersonnel();

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/maintenance-personnel');
      expect(result).toEqual(mockPersonnel);
    });

    it('should throw an error when API response is unsuccessful or data is not an array', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized supervisor access',
      });

      await expect(fetchMaintenancePersonnel()).rejects.toThrow(
        'Unauthorized supervisor access',
      );

      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: null as any,
      });

      await expect(fetchMaintenancePersonnel()).rejects.toThrow(
        'Failed to fetch maintenance personnel.',
      );
    });
  });

  describe('reassignTask', () => {
    const reassignInput = {
      taskId: 'task-100',
      newAssigneeUid: 'worker-2',
      reason: 'Previous technician on leave',
      supervisorUid: 'sup-1',
    };

    it('should send POST request with JSON payload to /api/supervisor/reassign-task', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
      });

      await reassignTask(reassignInput);

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/supervisor/reassign-task', {
        method: 'POST',
        body: JSON.stringify(reassignInput),
      });
    });

    it('should throw an error when reassignTask fails', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Target technician is not available',
      });

      await expect(reassignTask(reassignInput)).rejects.toThrow(
        'Target technician is not available',
      );
    });
  });

  describe('flagTask', () => {
    const flagInput = {
      taskId: 'task-100',
      reason: 'Requires external plumber assistance',
      supervisorUid: 'sup-1',
      supervisorName: 'Supervisor Jane',
      flagPhotoUrls: ['file:///photos/leak.jpg'],
    };

    it('should send POST request with JSON payload to /api/supervisor/flag-task', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
      });

      await flagTask(flagInput);

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/supervisor/flag-task', {
        method: 'POST',
        body: JSON.stringify(flagInput),
      });
    });

    it('should throw an error when flagTask fails', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Task has already been completed',
      });

      await expect(flagTask(flagInput)).rejects.toThrow(
        'Task has already been completed',
      );
    });
  });

  describe('approveTask', () => {
    const approveInput = {
      taskId: 'task-100',
      supervisorUid: 'sup-1',
      supervisorName: 'Supervisor Jane',
    };

    it('should send POST request with JSON payload to /api/supervisor/approve-task', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
      });

      await approveTask(approveInput);

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/supervisor/approve-task', {
        method: 'POST',
        body: JSON.stringify(approveInput),
      });
    });

    it('should throw an error when approveTask fails', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Task not found',
      });

      await expect(approveTask(approveInput)).rejects.toThrow('Task not found');
    });
  });

  describe('normalizeBuildingName & isPersonMatchingBuilding', () => {
    const {
      normalizeBuildingName,
      isPersonMatchingBuilding,
    } = require('../../lib/supervisor-api');

    it('should normalize building names ignoring facility/building suffixes', () => {
      expect(normalizeBuildingName('SDCA Annex Facility')).toBe('sdcaannex');
      expect(normalizeBuildingName('SDCA Annex Building')).toBe('sdcaannex');
      expect(normalizeBuildingName('GB3 Building')).toBe('gb3');
      expect(normalizeBuildingName('')).toBe('');
      expect(normalizeBuildingName(null)).toBe('');
    });

    it('should match buildings flexibly between supervisor and technician', () => {
      expect(isPersonMatchingBuilding('SDCA Annex Building', 'SDCA Annex Facility')).toBe(true);
      expect(isPersonMatchingBuilding('GB3 Building', 'GB3')).toBe(true);
      expect(isPersonMatchingBuilding(null, 'SDCA Annex Facility')).toBe(true);
      expect(isPersonMatchingBuilding('SDCA Annex Building', null)).toBe(true);
      expect(isPersonMatchingBuilding('Main Campus', 'Annex Campus')).toBe(false);
    });
  });

  describe('getPersonOperationalStatus', () => {
    const { getPersonOperationalStatus } = require('../../lib/supervisor-api');

    const samplePerson = {
      id: 'tech-1',
      displayName: 'Justine Lopez',
      email: 'justine@example.com',
      isAvailable: true,
      currentTaskId: null,
      shift: '1st',
      building: 'SDCA Annex',
      supervisorUid: null,
    };

    it('should return available when person has no active tasks and isAvailable is true', () => {
      const { status, activeTask } = getPersonOperationalStatus(samplePerson, []);
      expect(status).toBe('available');
      expect(activeTask).toBeNull();
    });

    it('should return on_task when person has an active uncompleted task', () => {
      const mockActiveTask: any = {
        id: 'task-1',
        status: 'acknowledged',
        assignedTo: 'tech-1',
      };
      const { status, activeTask } = getPersonOperationalStatus(samplePerson, [mockActiveTask]);
      expect(status).toBe('on_task');
      expect(activeTask).toEqual(mockActiveTask);
    });

    it('should return available if task is completed even if currentTaskId was set', () => {
      const personWithOldTask = { ...samplePerson, currentTaskId: 'task-completed-99' };
      const completedTask: any = {
        id: 'task-completed-99',
        status: 'completed',
        assignedTo: 'tech-1',
      };
      const { status, activeTask } = getPersonOperationalStatus(personWithOldTask, [completedTask]);
      expect(status).toBe('available');
      expect(activeTask).toBeNull();
    });

    it('should return available when a task was deleted and person currentTaskId is stale', () => {
      const personWithDeletedTask = { ...samplePerson, currentTaskId: 'deleted-task-404' };
      const { status, activeTask } = getPersonOperationalStatus(personWithDeletedTask, []);
      expect(status).toBe('available');
      expect(activeTask).toBeNull();
    });

    it('should universally match active task by assignedToIds, email, acknowledgedBy, or recheckedBy', () => {
      const taskWithIds: any = {
        id: 'task-multi-1',
        status: 'assigned',
        assignedToIds: ['tech-1'],
      };
      expect(getPersonOperationalStatus(samplePerson, [taskWithIds]).status).toBe('on_task');

      const taskWithEmail: any = {
        id: 'task-email-1',
        status: 'acknowledged',
        assignedTo: 'justine@example.com',
      };
      expect(getPersonOperationalStatus(samplePerson, [taskWithEmail]).status).toBe('on_task');

      const taskWithAckBy: any = {
        id: 'task-ack-1',
        status: 'acknowledged',
        acknowledgedBy: { 'tech-1': '2026-08-25T10:00:00Z' },
      };
      expect(getPersonOperationalStatus(samplePerson, [taskWithAckBy]).status).toBe('on_task');

      const taskWithRecheck: any = {
        id: 'task-recheck-1',
        status: 'rechecking',
        recheckedBy: 'tech-1',
      };
      expect(getPersonOperationalStatus(samplePerson, [taskWithRecheck]).status).toBe('on_task');
    });

    it('should return offline when isOnline is false or status is offline and no active task', () => {
      const offlinePerson = { ...samplePerson, isOnline: false };
      const { status, activeTask } = getPersonOperationalStatus(offlinePerson, []);
      expect(status).toBe('offline');
      expect(activeTask).toBeNull();

      const statusOfflinePerson = { ...samplePerson, status: 'offline' };
      expect(getPersonOperationalStatus(statusOfflinePerson, []).status).toBe('offline');
    });

    it('should return available when person has no active tasks even if legacy isAvailable was false', () => {
      const personWithStaleOccupancy = { ...samplePerson, isAvailable: false };
      const { status, activeTask } = getPersonOperationalStatus(personWithStaleOccupancy, []);
      expect(status).toBe('available');
      expect(activeTask).toBeNull();
    });
  });
});
