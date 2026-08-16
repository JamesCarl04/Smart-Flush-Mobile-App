import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { auth, db, storage } from './firebase';
import type { TaskChecklist } from '../types';

const OFFLINE_TASKS_KEY = 'offline_tasks';

export interface CompletionBundle {
  taskId: string;
  completedAt: string;
  acknowledgedAt: string | null;
  checklist: TaskChecklist;
  remarks: string;
  beforePhotoLocalUri: string;
  afterPhotoLocalUri: string;
  biometricVerified: boolean;
  completedBy: string;
  offlineSynced: false;
}

export interface OnlineCompletionInput {
  taskId: string;
  acknowledgedAt: Date | null;
  createdAt: Date;
  checklist: TaskChecklist;
  remarks: string;
  beforePhotoLocalUri: string;
  beforePhotoCapturedAt: Date;
  afterPhotoLocalUri: string;
  afterPhotoCapturedAt: Date;
  biometricVerified: boolean;
  completedAt: Date;
  completedBy: string;
}

export function secondsBetween(start: Date | null, end: Date): number | null {
  if (!start) {
    return null;
  }

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function unknownTimestampToDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate();
  }

  return null;
}

export async function isOnlineAsync(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.response instanceof Blob) {
          resolve(xhr.response);
        } else {
          fetch(uri)
            .then((res) => res.blob())
            .then(resolve)
            .catch(reject);
        }
      };
      xhr.onerror = function () {
        fetch(uri)
          .then((res) => res.blob())
          .then(resolve)
          .catch(reject);
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    } catch {
      fetch(uri)
        .then((res) => res.blob())
        .then(resolve)
        .catch(reject);
    }
  });
}

export async function uploadTaskPhoto(
  taskId: string,
  uri: string,
  kind: 'before' | 'after',
  capturedAt: Date,
): Promise<string> {
  let blob: Blob | null = null;
  try {
    blob = await uriToBlob(uri);
    const timestamp = capturedAt.getTime();
    const photoRef = ref(storage, `tasks/${taskId}/${kind}_${timestamp}.jpg`);
    await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(photoRef);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = err?.code ?? 'storage/unknown';
    const message = err?.message ?? String(error);
    console.error(
      `[UploadTaskPhoto] Error uploading ${kind} photo for task ${taskId} (${code}):`,
      message,
    );
    throw new Error(`Photo upload failed (${code}): ${message}`);
  } finally {
    if (blob && typeof (blob as any).close === 'function') {
      try {
        (blob as any).close();
      } catch {
        // Safe ignore
      }
    }
  }
}

export async function completeTaskOnline(input: OnlineCompletionInput): Promise<void> {
  const [beforePhotoUrl, afterPhotoUrl] = await Promise.all([
    uploadTaskPhoto(
      input.taskId,
      input.beforePhotoLocalUri,
      'before',
      input.beforePhotoCapturedAt,
    ),
    uploadTaskPhoto(
      input.taskId,
      input.afterPhotoLocalUri,
      'after',
      input.afterPhotoCapturedAt,
    ),
  ]);
  const workDuration = secondsBetween(input.acknowledgedAt, input.completedAt);
  const totalTime = secondsBetween(input.createdAt, input.completedAt);

  try {
    await updateDoc(doc(db, 'tasks', input.taskId), {
      checklist: input.checklist,
      remarks: input.remarks,
      beforePhotoUrl,
      beforePhotoCapturedAt: Timestamp.fromDate(input.beforePhotoCapturedAt),
      afterPhotoUrl,
      afterPhotoCapturedAt: Timestamp.fromDate(input.afterPhotoCapturedAt),
      biometricVerified: input.biometricVerified,
      offlineSynced: false,
      status: 'completed',
      completedAt: Timestamp.fromDate(input.completedAt),
      completedBy: input.completedBy,
      workDuration,
      totalTime,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = err?.code ?? 'unknown';
    const message = err?.message ?? String(error);
    console.error(
      `[Firestore Task Update] Error: Failed to update task document ${input.taskId} (${code}):`,
      message,
    );
    throw new Error(`[Firestore Task Update] Error: ${message}`);
  }

  try {
    await updateDoc(doc(db, 'maintenancePersonnel', input.completedBy), {
      isAvailable: true,
      currentTaskId: null,
      lastTaskCompletedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = err?.code ?? 'unknown';
    const message = err?.message ?? String(error);
    console.error(
      `[Firestore Task Update] Error: Failed to update personnel document ${input.completedBy} (${code}):`,
      message,
    );
    throw new Error(`[Firestore Task Update] Error: ${message}`);
  }
}

export async function readOfflineCompletions(): Promise<CompletionBundle[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_TASKS_KEY);
  if (!raw) {
    return [];
  }

  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is CompletionBundle => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CompletionBundle).taskId === 'string'
        );
      })
    : [];
}

async function writeOfflineCompletions(items: CompletionBundle[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(items));
}

export async function queueOfflineCompletion(
  item: CompletionBundle,
): Promise<void> {
  const existing = await readOfflineCompletions();
  await writeOfflineCompletions([
    ...existing.filter((current) => current.taskId !== item.taskId),
    item,
  ]);
}

export async function syncOfflineCompletions(
  onProgress?: (remaining: number) => void,
): Promise<number> {
  const online = await isOnlineAsync();
  if (!online) {
    return 0;
  }

  const items = await readOfflineCompletions();
  let synced = 0;
  const nextItems: CompletionBundle[] = [];

  for (const item of items) {
    try {
      const completedAt = new Date(item.completedAt);
      const acknowledgedAt = item.acknowledgedAt
        ? new Date(item.acknowledgedAt)
        : null;
      const [beforePhotoUrl, afterPhotoUrl] = await Promise.all([
        uploadTaskPhoto(
          item.taskId,
          item.beforePhotoLocalUri,
          'before',
          completedAt,
        ),
        uploadTaskPhoto(
          item.taskId,
          item.afterPhotoLocalUri,
          'after',
          completedAt,
        ),
      ]);

      const taskRef = doc(db, 'tasks', item.taskId);
      const taskSnapshot = await getDoc(taskRef);
      const taskData = taskSnapshot.data() as Record<string, unknown> | undefined;
      const createdAt = unknownTimestampToDate(taskData?.createdAt);

      await updateDoc(taskRef, {
        checklist: item.checklist,
        remarks: item.remarks,
        beforePhotoUrl,
        beforePhotoCapturedAt: Timestamp.fromDate(completedAt),
        afterPhotoUrl,
        afterPhotoCapturedAt: Timestamp.fromDate(completedAt),
        biometricVerified: item.biometricVerified,
        offlineSynced: true,
        status: 'completed',
        completedAt: Timestamp.fromDate(completedAt),
        completedBy: item.completedBy,
        workDuration: secondsBetween(acknowledgedAt, completedAt),
        totalTime: secondsBetween(createdAt, completedAt),
      });

      await updateDoc(doc(db, 'maintenancePersonnel', item.completedBy), {
        isAvailable: true,
        currentTaskId: null,
        lastTaskCompletedAt: serverTimestamp(),
      });

      synced += 1;
      onProgress?.(items.length - synced);
    } catch {
      nextItems.push(item);
    }
  }

  await writeOfflineCompletions(nextItems);
  return synced;
}

export function currentUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('You must be signed in to complete this task.');
  }

  return uid;
}
