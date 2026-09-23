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
  lastSeen?: unknown;
  currentTaskId: string | null;
  shift: string | null;
  building: string | null;
  supervisorUid: string | null;
}

export const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

export function extractTimestampMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toMillis?: () => unknown }).toMillis === 'function') {
    const millis = (value as { toMillis: () => unknown }).toMillis();
    if (typeof millis === 'number' && Number.isFinite(millis)) return millis;
  }
  if (typeof (value as { _seconds?: unknown })._seconds === 'number') {
    const seconds = (value as { _seconds: number })._seconds;
    const nanoseconds = typeof (value as { _nanoseconds?: unknown })._nanoseconds === 'number'
      ? (value as { _nanoseconds: number })._nanoseconds
      : 0;
    return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
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
          const lastSeenMillis = extractTimestampMillis(data.lastSeen);
          const isExpired = lastSeenMillis !== null && Date.now() - lastSeenMillis > PRESENCE_TIMEOUT_MS;
          const isExplicitlyOffline =
            data.status === 'offline' ||
            data.status === 'inactive' ||
            data.isOnline === false ||
            data.isActive === false;
          const isOnline = !isExplicitlyOffline && !isExpired;
          return {
            id: doc.id,
            displayName:
              typeof data.displayName === 'string' && data.displayName.trim()
                ? data.displayName.trim()
                : data.email ?? doc.id,
            email: typeof data.email === 'string' ? data.email : null,
            isAvailable: isOnline,
            isOnline,
            status: typeof data.status === 'string' ? data.status : null,
            isActive: data.isActive !== false,
            lastSeen: data.lastSeen,
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

export interface ReassignTaskInput {
  taskId: string;
  newAssigneeUid?: string;
  newAssigneeUids?: string[];
  reason: string;
  supervisorUid: string;
  supervisorName?: string;
  assigneeNames?: Record<string, string>;
}

export async function reassignTask(input: ReassignTaskInput): Promise<void> {
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

export function isTaskActive(candidate: Task): boolean {
  if (candidate.status === 'completed') {
    return false;
  }
  if (candidate.completedAt != null) {
    return false;
  }
  return true;
}

export function getPersonOperationalStatus(
  person: MaintenancePerson,
  tasks: Task[],
): { status: 'available' | 'on_task' | 'offline'; activeTask: Task | null } {
  const personId = person.id ? person.id.trim() : '';
  const personEmail = person.email && person.email.trim() ? person.email.trim().toLowerCase() : null;
  const currentTaskId = person.currentTaskId && person.currentTaskId.trim() ? person.currentTaskId.trim() : null;

  let activeTask: Task | null = null;

  // 1. Check currentTaskId if assigned
  if (currentTaskId) {
    activeTask =
      tasks.find((candidate) => isTaskActive(candidate) && candidate.id === currentTaskId) ?? null;
  }

  // 2. If not matched or currentTaskId was completed/stale, search active tasks
  if (!activeTask) {
    activeTask =
      tasks.find((candidate) => {
        if (!isTaskActive(candidate)) {
          return false;
        }

        // Direct assignedTo (UID or case-insensitive email)
        if (typeof candidate.assignedTo === 'string' && candidate.assignedTo.trim()) {
          const assigned = candidate.assignedTo.trim();
          if (
            (personId && assigned === personId) ||
            (personEmail && assigned.toLowerCase() === personEmail)
          ) {
            return true;
          }
        }

        // Multi-assignee assignedToIds (UID or case-insensitive email)
        if (Array.isArray(candidate.assignedToIds)) {
          const matched = candidate.assignedToIds.some((item) => {
            if (typeof item !== 'string') return false;
            const trimmed = item.trim();
            return (
              (personId && trimmed === personId) ||
              (personEmail && trimmed.toLowerCase() === personEmail)
            );
          });
          if (matched) {
            return true;
          }
        }

        // Acknowledged by keys (UID or case-insensitive email)
        if (candidate.acknowledgedBy && typeof candidate.acknowledgedBy === 'object') {
          const matched = Object.keys(candidate.acknowledgedBy).some((key) => {
            const trimmed = key.trim();
            return (
              (personId && trimmed === personId) ||
              (personEmail && trimmed.toLowerCase() === personEmail)
            );
          });
          if (matched) {
            return true;
          }
        }

        // Rechecked by (UID or case-insensitive email)
        if (typeof candidate.recheckedBy === 'string' && candidate.recheckedBy.trim()) {
          const recheck = candidate.recheckedBy.trim();
          if (
            (personId && recheck === personId) ||
            (personEmail && recheck.toLowerCase() === personEmail)
          ) {
            return true;
          }
        }

        return false;
      }) ?? null;
  }

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

  // Check lastSeen freshness only when lastSeen timestamp is present
  const lastSeenMillis = extractTimestampMillis(person.lastSeen);
  if (lastSeenMillis !== null && Date.now() - lastSeenMillis > PRESENCE_TIMEOUT_MS) {
    return { status: 'offline', activeTask: null };
  }

  // Any active technician on duty with fresh heartbeat (or active status when lastSeen omitted) is Available
  return { status: 'available', activeTask: null };
}

