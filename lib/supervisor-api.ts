import { apiFetch } from './api';
import { db } from './firebase';
import { fetchTasks } from './task-api';
import type { Task } from '../types';

export interface MaintenancePerson {
  id: string;
  displayName: string;
  email: string | null;
  isAvailable: boolean;
  isOnline?: boolean | null;
  status?: string | null;
  isActive?: boolean | null;
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
            isAvailable: data.status !== 'offline' && data.isOnline !== false,
            isOnline: data.isOnline !== false,
            status: typeof data.status === 'string' ? data.status : null,
            isActive: data.isActive !== false,
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
  supervisorName?: string;
  flagPhotoUrls?: string[];
}): Promise<void> {
  const response = await apiFetch<never>('/api/supervisor/flag-task', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to flag task.');
  }
}

export async function approveTask(input: {
  taskId: string;
  supervisorUid: string;
  supervisorName?: string;
}): Promise<void> {
  const response = await apiFetch<never>('/api/supervisor/approve-task', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to approve task.');
  }
}

export function normalizeBuildingName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(facility|building|bldg)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function isPersonMatchingBuilding(
  personBuilding?: string | null,
  supervisorBuilding?: string | null,
): boolean {
  if (!supervisorBuilding || !supervisorBuilding.trim()) {
    return true; // Campus-wide supervisor sees everyone
  }
  if (!personBuilding || !personBuilding.trim()) {
    return true; // General unassigned facility personnel are visible
  }
  const normPerson = normalizeBuildingName(personBuilding);
  const normSup = normalizeBuildingName(supervisorBuilding);
  if (!normPerson || !normSup) {
    return true;
  }
  return (
    normPerson === normSup ||
    normPerson.includes(normSup) ||
    normSup.includes(normPerson)
  );
}

export function getPersonOperationalStatus(
  person: MaintenancePerson,
  tasks: Task[],
): { status: 'available' | 'on_task' | 'offline'; activeTask: Task | null } {
  const activeTask =
    tasks.find(
      (candidate) =>
        candidate.status !== 'completed' &&
        (candidate.id === person.currentTaskId ||
          candidate.assignedTo === person.id ||
          candidate.assignedTo === person.email ||
          (candidate.assignedToIds &&
            (candidate.assignedToIds.includes(person.id) ||
              (person.email && candidate.assignedToIds.includes(person.email)))) ||
          (candidate.acknowledgedBy &&
            (person.id in candidate.acknowledgedBy ||
              (person.email && person.email in candidate.acknowledgedBy))) ||
          candidate.recheckedBy === person.id ||
          candidate.recheckedBy === person.email),
    ) ?? null;

  if (activeTask !== null) {
    return { status: 'on_task', activeTask };
  }

  // If the technician is explicitly marked off-duty/inactive/offline
  if (
    person.isOnline === false ||
    person.status === 'offline' ||
    person.status === 'inactive' ||
    person.isActive === false
  ) {
    return { status: 'offline', activeTask: null };
  }

  // Any active technician on duty with no current work order is Available
  return { status: 'available', activeTask: null };
}

