import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import firestore from '@react-native-firebase/firestore';
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

export interface AreaPhotoInput {
  id: string;
  areaTag: string;
  localUri: string;
  capturedAt: Date;
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
  additionalPhotos?: AreaPhotoInput[];
  biometricVerified: boolean;
  completedAt: Date;
  completedBy: string;
  isRecheck?: boolean;
  recheckCount?: number;
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

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
}

export async function isOnlineAsync(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function uploadTaskPhoto(
  taskId: string,
  uri: string,
  kind: 'before' | 'after',
  capturedAt: Date,
): Promise<string> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  try {
    const timestamp = capturedAt.getTime();
    const photoRef = storage.ref(`tasks/${taskId}/${kind}_${timestamp}.jpg`);
    const cleanUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    await photoRef.putFile(cleanUri);
    return await photoRef.getDownloadURL();
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const code = err?.code ?? 'storage/unknown';
    const message = err?.message ?? String(error);
    console.error(
      `[UploadTaskPhoto] Error uploading ${kind} photo for task ${taskId} (${code}):`,
      message,
    );
    throw new Error(`Photo upload failed (${code}): ${message}`);
  }
}

export async function completeTaskOnline(input: OnlineCompletionInput): Promise<void> {
  const [beforePhotoUrl, afterPhotoUrl, additionalUploadedPhotos] = await Promise.all([
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
    Promise.all(
      (input.additionalPhotos || []).map(async (photo) => {
        const photoUrl = await uploadTaskPhoto(
          input.taskId,
          photo.localUri,
          `area_${photo.id}` as any,
          photo.capturedAt,
        );
        return {
          id: photo.id,
          areaTag: photo.areaTag,
          photoUrl,
          capturedAt: firestore.Timestamp.fromDate(photo.capturedAt),
        };
      }),
    ),
  ]);
  const workDuration = secondsBetween(input.acknowledgedAt, input.completedAt);
  const totalTime = secondsBetween(input.createdAt, input.completedAt);
  const nextRecheckCount = input.isRecheck
    ? (input.recheckCount ?? 0) + 1
    : input.recheckCount ?? 0;

  try {
    const submissionPayload: Record<string, unknown> = {
      technicianUid: input.completedBy,
      technicianName: auth.currentUser?.displayName ?? input.completedBy,
      checklist: input.checklist,
      beforePhotoUrl,
      beforePhotoCapturedAt: firestore.Timestamp.fromDate(input.beforePhotoCapturedAt),
      afterPhotoUrl,
      afterPhotoCapturedAt: firestore.Timestamp.fromDate(input.afterPhotoCapturedAt),
      additionalPhotos: additionalUploadedPhotos,
      remarks: input.remarks,
      workDuration,
      completedAt: firestore.Timestamp.fromDate(input.completedAt),
      biometricVerified: input.biometricVerified,
      recheckCount: nextRecheckCount,
      recheckedAt: input.isRecheck
        ? firestore.Timestamp.fromDate(input.completedAt)
        : null,
    };

    let isFullyCompleted = true;
    try {
      const currentTaskDoc = await db.collection('tasks').doc(input.taskId).get();
      const exists =
        typeof (currentTaskDoc as any).exists === 'function'
          ? (currentTaskDoc as any).exists()
          : Boolean((currentTaskDoc as any).exists);
      if (exists) {
        const currentData = (currentTaskDoc.data() as Record<string, any>) || {};
        const assignedToIds = Array.isArray(currentData.assignedToIds) ? currentData.assignedToIds : [];
        if (assignedToIds.length > 1) {
          const completedByMap = currentData.completedBy && typeof currentData.completedBy === 'object'
            ? currentData.completedBy
            : {};
          const completedCount = assignedToIds.filter(
            (id: string) => id === input.completedBy || Boolean(completedByMap[id]),
          ).length;
          isFullyCompleted = completedCount >= assignedToIds.length;
        }
      }
    } catch {
      isFullyCompleted = true;
    }

    const updatePayload: Record<string, unknown> = {
      checklist: input.checklist,
      remarks: input.remarks,
      beforePhotoUrl,
      beforePhotoCapturedAt: firestore.Timestamp.fromDate(input.beforePhotoCapturedAt),
      afterPhotoUrl,
      afterPhotoCapturedAt: firestore.Timestamp.fromDate(input.afterPhotoCapturedAt),
      additionalPhotos: additionalUploadedPhotos,
      biometricVerified: input.biometricVerified,
      offlineSynced: false,
      status: isFullyCompleted ? 'completed' : 'acknowledged',
      ...(isFullyCompleted
        ? {
            inspectionStatus: 'pending_review',
            completedAt: firestore.Timestamp.fromDate(input.completedAt),
            completedBy: input.completedBy,
          }
        : {}),
      [`completedBy.${input.completedBy}`]: firestore.Timestamp.fromDate(input.completedAt),
      [`submissions.${input.completedBy}`]: submissionPayload,
      assignedTo: input.completedBy,
      workDuration,
      totalTime,
    };

    if (input.isRecheck) {
      updatePayload.recheckCount = nextRecheckCount;
      updatePayload.recheckedBy = input.completedBy;
      updatePayload.recheckedAt = firestore.Timestamp.fromDate(input.completedAt);
    }

    await db.collection('tasks').doc(input.taskId).update(updatePayload);
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
    await db.collection('users').doc(input.completedBy).set(
      {
        isAvailable: true,
        currentTaskId: null,
        lastTaskCompletedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
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

      const taskDocRef = db.collection('tasks').doc(item.taskId);
      const taskSnapshot = await taskDocRef.get();
      const taskData = taskSnapshot.data() as Record<string, unknown> | undefined;
      const createdAt = unknownTimestampToDate(taskData?.createdAt);

      await taskDocRef.update({
        checklist: item.checklist,
        remarks: item.remarks,
        beforePhotoUrl,
        beforePhotoCapturedAt: firestore.Timestamp.fromDate(completedAt),
        afterPhotoUrl,
        afterPhotoCapturedAt: firestore.Timestamp.fromDate(completedAt),
        biometricVerified: item.biometricVerified,
        offlineSynced: true,
        status: 'completed',
        completedAt: firestore.Timestamp.fromDate(completedAt),
        completedBy: item.completedBy,
        [`completedBy.${item.completedBy}`]: firestore.Timestamp.fromDate(completedAt),
        assignedTo: item.completedBy,
        workDuration: secondsBetween(acknowledgedAt, completedAt),
        totalTime: secondsBetween(createdAt, completedAt),
      });

      await db.collection('users').doc(item.completedBy).update({
        isAvailable: true,
        currentTaskId: null,
        lastTaskCompletedAt: firestore.FieldValue.serverTimestamp(),
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

export async function clearAllTasksInFirestore(): Promise<number> {
  const snapshot = await db.collection('tasks').get();
  let count = 0;
  if (snapshot && !snapshot.empty) {
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      count += 1;
    }
    await batch.commit();
  }

  try {
    const userSnap = await db.collection('users').get();
    if (userSnap && !userSnap.empty) {
      for (const doc of userSnap.docs) {
        await doc.ref.update({
          isAvailable: true,
          currentTaskId: null,
        });
      }
    }
  } catch (err) {
    console.warn('[clearAllTasksInFirestore] Failed to reset user availability:', err);
  }

  return count;
}
