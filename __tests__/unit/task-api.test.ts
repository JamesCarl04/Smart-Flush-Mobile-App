import { apiFetch } from '../../lib/api';
import {
  acknowledgeTask,
  acceptRecheckTask,
  completeTask,
  fetchTask,
  fetchTasks,
} from '../../lib/task-api';

jest.mock('../../lib/api', () => ({
  apiFetch: jest.fn(),
}));

describe('task-api utility', () => {
  const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTasks', () => {
    it('should fetch tasks, parse them, filter invalid items, and sort by createdAt descending', async () => {
      const rawApiTasks = [
        {
          id: 'task-old',
          deviceId: 'toilet-01',
          triggerType: 'maintenance',
          message: 'Older task',
          status: 'assigned',
          createdAt: new Date('2026-08-15T08:00:00Z').getTime(),
        },
        {
          // Invalid task: missing triggerType
          id: 'task-invalid',
          deviceId: 'toilet-01',
          message: 'Invalid task',
          status: 'assigned',
          createdAt: new Date('2026-08-15T08:30:00Z').getTime(),
        },
        {
          id: 'task-new',
          deviceId: 'toilet-02',
          triggerType: 'hardware_failure',
          message: 'Newer task',
          status: 'unassigned',
          createdAt: new Date('2026-08-15T09:00:00Z').getTime(),
        },
      ];

      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: rawApiTasks,
      });

      const tasks = await fetchTasks();

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/tasks');
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-new');
      expect(tasks[1].id).toBe('task-old');
      expect(tasks[0].createdAt).toEqual(new Date('2026-08-15T09:00:00Z'));
      expect(tasks[1].createdAt).toEqual(new Date('2026-08-15T08:00:00Z'));
    });

    it('should throw an error when API response is unsuccessful or data is not an array', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Failed to retrieve task list',
      });

      await expect(fetchTasks()).rejects.toThrow('Failed to retrieve task list');

      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: null as any,
      });

      await expect(fetchTasks()).rejects.toThrow('Failed to fetch tasks.');
    });
  });

  describe('fetchTask', () => {
    it('should fetch and return a single valid task with encoded ID', async () => {
      const rawTask = {
        id: 'task-123/special',
        deviceId: 'toilet-01',
        triggerType: 'maintenance',
        message: 'Inspect sensor',
        status: 'acknowledged',
        createdAt: new Date('2026-08-15T08:00:00Z').getTime(),
      };

      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: rawTask,
      });

      const task = await fetchTask('task-123/special');

      expect(mockedApiFetch).toHaveBeenCalledWith('/api/tasks/task-123%2Fspecial');
      expect(task.id).toBe('task-123/special');
      expect(task.status).toBe('acknowledged');
    });

    it('should throw an error if API returns unsuccessful response', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Task not found',
      });

      await expect(fetchTask('task-999')).rejects.toThrow('Task not found');
    });

    it('should throw an error if task data fails schema parsing', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: { id: 'task-invalid', deviceId: '' }, // missing required fields
      });

      await expect(fetchTask('task-invalid')).rejects.toThrow('The server returned an invalid task.');
    });
  });

  describe('acknowledgeTask', () => {
    it('should send POST request to /api/tasks/:taskId/acknowledge', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: { taskId: 'task-100' },
      });

      await acknowledgeTask('task-100');

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/tasks/task-100/acknowledge',
        { method: 'POST' },
      );
    });

    it('should throw an error when acknowledge fails', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Task is already acknowledged by another user',
      });

      await expect(acknowledgeTask('task-100')).rejects.toThrow(
        'Task is already acknowledged by another user',
      );
    });
  });

  describe('acceptRecheckTask', () => {
    const input = {
      taskId: 'task-300',
      technicianUid: 'tech-1',
      technicianName: 'Technician Sam',
    };

    it('should send POST request to /api/tasks/:taskId/accept-recheck with body', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: true,
        data: { taskId: 'task-300' },
      });

      await acceptRecheckTask(input);

      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/tasks/task-300/accept-recheck',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
    });

    it('should throw an error when accept-recheck fails', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        success: false,
        error: 'Task is not in flagged status',
      });

      await expect(acceptRecheckTask(input)).rejects.toThrow(
        'Task is not in flagged status',
      );
    });
  });
});
