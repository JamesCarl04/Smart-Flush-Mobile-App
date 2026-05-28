import { Timestamp } from 'firebase/firestore';

import type { Task, TaskStatus, TaskTriggerType } from '../types';

type FirestoreDateValue = Date | Timestamp | null | undefined;

type TaskDocumentShape = {
  deviceId?: unknown;
  restroomName?: unknown;
  deviceName?: unknown;
  triggerType?: unknown;
  message?: unknown;
  status?: unknown;
  assignedTo?: unknown;
  createdAt?: FirestoreDateValue;
  acknowledgedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
  createdBy?: unknown;
};

function toDate(value: FirestoreDateValue): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  return null;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === 'pending' ||
    value === 'acknowledged' ||
    value === 'completed'
  );
}

export function isTaskTriggerType(value: unknown): value is TaskTriggerType {
  return (
    value === 'manual' ||
    value === 'uv_complete' ||
    value === 'flush_count' ||
    value === 'maintenance'
  );
}

export function formatTaskStatus(status: TaskStatus): string {
  if (status === 'pending') {
    return 'Pending';
  }

  if (status === 'acknowledged') {
    return 'Acknowledged';
  }

  return 'Completed';
}

export function formatTaskTrigger(triggerType: TaskTriggerType): string {
  if (triggerType === 'uv_complete') {
    return 'UV cycle complete';
  }

  if (triggerType === 'flush_count') {
    return 'Flush count';
  }

  if (triggerType === 'maintenance') {
    return 'Maintenance';
  }

  return 'Manual';
}

export function parseTaskDocument(
  id: string,
  data: TaskDocumentShape,
): Task | null {
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

  const createdAt = toDate(data.createdAt);

  if (!createdAt) {
    return null;
  }

  return {
    id,
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
    acknowledgedAt: toDate(data.acknowledgedAt),
    completedAt: toDate(data.completedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',
  };
}
