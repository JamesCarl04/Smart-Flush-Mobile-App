import { apiFetch } from '../../lib/api';
import {
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
});
