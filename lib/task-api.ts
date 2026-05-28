import { apiFetch } from './api';
import { isTaskStatus, isTaskTriggerType } from './tasks';
import type { Task } from '../types';

interface TaskApiData {
  id?: unknown;
  deviceId?: unknown;
  restroomName?: unknown;
  deviceName?: unknown;
  triggerType?: unknown;
  message?: unknown;
  status?: unknown;
  assignedTo?: unknown;
  createdAt?: unknown;
  acknowledgedAt?: unknown;
  completedAt?: unknown;
  createdBy?: unknown;
}

function millisToDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value);
}

function parseTaskApiData(data: TaskApiData): Task | null {
  if (typeof data.id !== 'string' || !data.id.trim()) {
    return null;
  }

  if (typeof data.deviceId !== 'string' || !data.deviceId.trim()) {
    return null;
  }

  if (!isTaskTriggerType(data.triggerType)) {
    return null;
  }

  if (typeof data.message !== 'string') {
    return null;
  }

  if (!isTaskStatus(data.status)) {
    return null;
  }

  const createdAt = millisToDate(data.createdAt);
  if (!createdAt) {
    return null;
  }

  return {
    id: data.id,
    deviceId: data.deviceId,
    restroomName:
      typeof data.restroomName === 'string'
        ? data.restroomName
        : typeof data.deviceName === 'string'
          ? data.deviceName
          : null,
    triggerType: data.triggerType,
    message: data.message,
    assignedTo: typeof data.assignedTo === 'string' ? data.assignedTo : null,
    status: data.status,
    createdAt,
    acknowledgedAt: millisToDate(data.acknowledgedAt),
    completedAt: millisToDate(data.completedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const response = await apiFetch<TaskApiData[]>('/api/tasks');

  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error ?? 'Failed to fetch tasks.');
  }

  return response.data
    .map(parseTaskApiData)
    .filter((task): task is Task => task !== null)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function fetchTask(taskId: string): Promise<Task> {
  const response = await apiFetch<TaskApiData>(
    `/api/tasks/${encodeURIComponent(taskId)}`,
  );

  if (!response.success || !response.data) {
    throw new Error(response.error ?? 'Failed to fetch task.');
  }

  const task = parseTaskApiData(response.data);
  if (!task) {
    throw new Error('The server returned an invalid task.');
  }

  return task;
}

export async function acknowledgeTask(taskId: string): Promise<void> {
  const response = await apiFetch<{ taskId?: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/acknowledge`,
    { method: 'POST' },
  );

  if (!response.success) {
    throw new Error(response.error ?? 'Failed to acknowledge task.');
  }
}

export async function completeTask(taskId: string): Promise<void> {
  const response = await apiFetch<{ taskId?: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST' },
  );

  if (!response.success) {
    throw new Error(response.error ?? 'Failed to complete task.');
  }
}
