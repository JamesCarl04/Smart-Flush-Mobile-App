import { apiFetch } from './api';
import { db } from './firebase';
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
  try {
    const snapshot = await db.collection('users').get();
    if (snapshot && !snapshot.empty) {
      const people = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const role = typeof data.role === 'string' ? data.role.toLowerCase() : '';
          if (role !== 'maintenance' && role !== 'technician' && role !== 'worker') {
            return null;
          }
          return {
            id: doc.id,
            displayName:
              typeof data.displayName === 'string' && data.displayName.trim()
                ? data.displayName.trim()
                : data.email ?? doc.id,
            email: typeof data.email === 'string' ? data.email : null,
            isAvailable: data.isAvailable !== false,
            currentTaskId: typeof data.currentTaskId === 'string' ? data.currentTaskId : null,
            shift: typeof data.shift === 'string' ? data.shift : '1st',
            building: typeof data.building === 'string' ? data.building : 'SDCA Annex Building',
            supervisorUid: typeof data.supervisorUid === 'string' ? data.supervisorUid : null,
          } as MaintenancePerson;
        })
        .filter((person): person is MaintenancePerson => person !== null);

      if (people.length > 0) {
        return people;
      }
    }
  } catch (error) {
    console.warn('[supervisor-api] Direct Firestore fetchMaintenancePersonnel failed, falling back to API:', error);
  }

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
