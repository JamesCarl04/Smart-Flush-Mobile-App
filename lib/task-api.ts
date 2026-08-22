import { apiFetch } from './api';
import { db } from './firebase';
import {
  EMPTY_CHECKLIST,
  isTaskStatus,
  isTaskTriggerType,
  parseTaskDocument,
} from './tasks';
import type { Task, TaskChecklist } from '../types';

interface TaskApiData {
  id?: unknown;
  alertId?: unknown;
  deviceId?: unknown;
  restroomName?: unknown;
  deviceName?: unknown;
  type?: unknown;
  component?: unknown;
  location?: unknown;
  floor?: unknown;
  building?: unknown;
  shift?: unknown;
  triggerType?: unknown;
  message?: unknown;
  status?: unknown;
  assignedTo?: unknown;
  createdAt?: unknown;
  assignedAt?: unknown;
  acknowledgedAt?: unknown;
  completedAt?: unknown;
  responseTime?: unknown;
  workDuration?: unknown;
  totalTime?: unknown;
  checklist?: unknown;
  remarks?: unknown;
  beforePhotoUrl?: unknown;
  beforePhotoCapturedAt?: unknown;
  afterPhotoUrl?: unknown;
  afterPhotoCapturedAt?: unknown;
  biometricVerified?: unknown;
  offlineSynced?: unknown;
  completedBy?: unknown;
  reassignCount?: unknown;
  supervisorUid?: unknown;
  createdBy?: unknown;
}

function millisToDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractUserUid(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > 0 && typeof keys[0] === 'string' && keys[0].trim()) {
      return keys[0].trim();
    }
  }
  return null;
}

function extractAssignedTo(data: TaskApiData): string | null {
  if (typeof data.assignedTo === 'string' && data.assignedTo.trim()) {
    return data.assignedTo.trim();
  }
  const rawObj = data as Record<string, unknown>;
  if (Array.isArray(rawObj.assignedToIds)) {
    const ids = rawObj.assignedToIds;
    if (ids.length > 0 && typeof ids[0] === 'string' && ids[0].trim()) {
      return ids[0].trim();
    }
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseChecklist(value: unknown): TaskChecklist {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_CHECKLIST };
  }

  const record = value as Record<string, unknown>;
  const result: TaskChecklist = { ...EMPTY_CHECKLIST };
  for (const key of Object.keys(EMPTY_CHECKLIST) as Array<keyof TaskChecklist>) {
      const raw = record[key];
      result[key] =
        raw === true || raw === 'done'
          ? 'done'
          : raw === 'N/A' || raw === 'na'
            ? 'na'
            : 'unchecked';
  }
  return result;
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

  const createdAt = millisToDate(data.createdAt);
  if (!createdAt) {
    return null;
  }

  const completedAt = millisToDate(data.completedAt);
  const completedBy = extractUserUid(data.completedBy);
  const assignedTo = extractAssignedTo(data);
  const acknowledgedAt = millisToDate(data.acknowledgedAt);

  let rawStatus: unknown = data.status;
  if (rawStatus === 'pending') {
    rawStatus = assignedTo ? 'assigned' : 'unassigned';
  }

  let status = isTaskStatus(rawStatus) ? rawStatus : 'unassigned';
  if (completedAt || completedBy) {
    status = 'completed';
  } else if (acknowledgedAt && status !== 'completed') {
    status = 'acknowledged';
  }

  const rawObj = data as Record<string, unknown>;
  const assignedToIds: string[] = Array.isArray(rawObj.assignedToIds)
    ? rawObj.assignedToIds
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    : [];

  return {
    id: data.id,
    alertId: stringOrNull(data.alertId),
    deviceId: data.deviceId,
    restroomName:
      typeof data.restroomName === 'string'
        ? data.restroomName
        : typeof data.deviceName === 'string'
          ? data.deviceName
          : null,
    type: data.type === 'cleaning' ? 'cleaning' : 'maintenance',
    component: typeof data.component === 'string' ? data.component : 'maintenance',
    location:
      typeof data.location === 'string'
        ? data.location
        : typeof data.restroomName === 'string'
          ? data.restroomName
          : data.deviceId,
    floor: typeof data.floor === 'string' ? data.floor : 'Ground',
    building:
      typeof data.building === 'string' ? data.building : 'SDCA Annex Building',
    shift: data.shift === '2nd' ? '2nd' : '1st',
    triggerType: data.triggerType,
    message: data.message,
    assignedTo,
    assignedToIds,
    isBroadcast:
      rawObj.isBroadcast === true ||
      rawObj.assignmentType === 'broadcast' ||
      assignedTo === 'all' ||
      assignedTo === 'broadcast',
    assignmentType:
      rawObj.assignmentType === 'broadcast' || rawObj.isBroadcast === true
        ? 'broadcast'
        : rawObj.assignmentType === 'team'
          ? 'team'
          : 'individual',
    status,
    createdAt,
    assignedAt: millisToDate(data.assignedAt),
    acknowledgedAt,
    completedAt,
    responseTime: numberOrNull(data.responseTime),
    workDuration: numberOrNull(data.workDuration),
    totalTime: numberOrNull(data.totalTime),
    checklist: parseChecklist(data.checklist),
    remarks: typeof data.remarks === 'string' ? data.remarks : '',
    beforePhotoUrl: stringOrNull(data.beforePhotoUrl),
    beforePhotoCapturedAt: millisToDate(data.beforePhotoCapturedAt),
    afterPhotoUrl: stringOrNull(data.afterPhotoUrl),
    afterPhotoCapturedAt: millisToDate(data.afterPhotoCapturedAt),
    biometricVerified: data.biometricVerified === true,
    offlineSynced: data.offlineSynced === true,
    completedBy,
    reassignCount: numberOrNull(data.reassignCount) ?? 0,
    supervisorUid: stringOrNull(data.supervisorUid),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',
  };
}

export async function fetchTasks(): Promise<Task[]> {
  try {
    const snapshot = await db.collection('tasks').get();
    if (snapshot && !snapshot.empty) {
      const parsed = snapshot.docs
        .map((doc) => parseTaskDocument(doc.id, doc.data() as any))
        .filter((task): task is Task => task !== null)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('[task-api] Direct Firestore fetchTasks failed, falling back to API:', error);
  }

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
  try {
    const doc = await db.collection('tasks').doc(taskId).get();
    const exists =
      typeof (doc as any).exists === 'function'
        ? (doc as any).exists()
        : Boolean((doc as any).exists);
    if (exists) {
      const task = parseTaskDocument(doc.id, doc.data() as any);
      if (task) {
        return task;
      }
    }
  } catch (error) {
    console.warn('[task-api] Direct Firestore fetchTask failed, falling back to API:', error);
  }

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
