import { apiFetch } from './api';
import { fetchTasks } from './task-api';
import type { Task } from '../types';

export interface MaintenancePerson {
  id: string;
  displayName: string;
  email: string | null;
  isAvailable: boolean;
  currentTaskId: string | null;
  shift: string | null;
  building: string | null;
  supervisorUid: string | null;
}

export async function fetchMaintenancePersonnel(): Promise<MaintenancePerson[]> {
  const response = await apiFetch<MaintenancePerson[]>('/api/maintenance-personnel');
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.error ?? 'Failed to fetch maintenance personnel.');
  }

  return response.data;
}

export async function fetchSupervisorTasks(): Promise<Task[]> {
  return fetchTasks();
}

export async function reassignTask(input: {
  taskId: string;
  newAssigneeUid: string;
  reason: string;
  supervisorUid: string;
}): Promise<void> {
  const response = await apiFetch<never>('/api/supervisor/reassign-task', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to reassign task.');
  }
}

export async function flagTask(input: {
  taskId: string;
  reason: string;
  supervisorUid: string;
}): Promise<void> {
  const response = await apiFetch<never>('/api/supervisor/flag-task', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to flag task.');
  }
}
