import { Timestamp } from 'firebase/firestore';

import type { Task, TaskStatus } from '../types';

type FirestoreDateValue = Date | Timestamp | null | undefined;

type TaskDocumentShape = {
  toiletId?: unknown;
  triggeredBy?: unknown;
  triggeredAt?: FirestoreDateValue;
  assignedTo?: unknown;
  status?: unknown;
  note?: unknown;
  acknowledgedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
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

export function formatTaskStatus(status: TaskStatus): string {
  if (status === 'pending') {
    return 'Pending';
  }

  if (status === 'acknowledged') {
    return 'Acknowledged';
  }

  return 'Completed';
}

export function parseTaskDocument(
  id: string,
  data: TaskDocumentShape,
): Task | null {
  if (typeof data.toiletId !== 'string') {
    return null;
  }

  if (data.triggeredBy !== 'admin') {
    return null;
  }

  if (typeof data.assignedTo !== 'string') {
    return null;
  }

  if (!isTaskStatus(data.status)) {
    return null;
  }

  const triggeredAt = toDate(data.triggeredAt);

  if (!triggeredAt) {
    return null;
  }

  return {
    id,
    toiletId: data.toiletId,
    triggeredBy: 'admin',
    triggeredAt,
    assignedTo: data.assignedTo,
    status: data.status,
    note: typeof data.note === 'string' ? data.note : undefined,
    acknowledgedAt: toDate(data.acknowledgedAt),
    completedAt: toDate(data.completedAt),
  };
}
