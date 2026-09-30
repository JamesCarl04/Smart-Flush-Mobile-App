import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { fetchTasks } from '../lib/task-api';
import { isTransientAuthError } from '../lib/auth-errors';
import {
  isBroadcastTask,
  parseAreaPhotos,
  parseReassignmentHistory,
  parseSubmissions,
  parseTaskDocument,
  parseTimestampMap,
  toDate,
} from '../lib/tasks';
import type { Task, TaskSubmission, TasksContextValue } from '../types';
import {
  isOnlineAsync,
  readOfflineCompletions,
  type CompletionBundle,
} from '../lib/task-completion';

const TasksContext = createContext<TasksContextValue | undefined>(undefined);
const TASKS_CACHE_KEY_PREFIX = '@klir:tasks';

function applyOfflineBundleToTask(
  task: Task,
  bundle: CompletionBundle,
  currentUid?: string,
): Task {
  const uid = bundle.completedBy || currentUid || '';
  const completedAt = toDate(bundle.completedAt) ?? new Date();
  const isTeam = Array.isArray(task.assignedToIds) && task.assignedToIds.length > 1;

  const currentSubmissions = task.submissions ?? {};
  const additionalPhotos = bundle.additionalPhotos?.map((p) => ({
    id: p.id,
    areaTag: p.areaTag,
    photoUrl: p.localUri,
    capturedAt: toDate(p.capturedAt) ?? new Date(),
  }));

  const existingSubmission = currentSubmissions[uid];
  const submissionPhotos =
    existingSubmission?.additionalPhotos && existingSubmission.additionalPhotos.length > 0
      ? existingSubmission.additionalPhotos
      : additionalPhotos;

  const submission: TaskSubmission = {
    technicianUid: uid,
    technicianName: existingSubmission?.technicianName ?? 'You',
    checklist: bundle.checklist ?? existingSubmission?.checklist,
    beforePhotoUrl: bundle.beforePhotoLocalUri ?? existingSubmission?.beforePhotoUrl,
    afterPhotoUrl: bundle.afterPhotoLocalUri ?? existingSubmission?.afterPhotoUrl,
    additionalPhotos: submissionPhotos,
    remarks: bundle.remarks ?? existingSubmission?.remarks,
    workDuration: existingSubmission?.workDuration ?? null,
    completedAt,
    biometricVerified: bundle.biometricVerified ?? existingSubmission?.biometricVerified,
  };

  const nextSubmissions = {
    ...currentSubmissions,
    ...(uid ? { [uid]: submission } : {}),
  };

  let isFullyCompleted = true;
  if (isTeam) {
    const completedByMap = task.completedByMap ?? {};
    const completedCount = task.assignedToIds!.filter(
      (id) =>
        id === uid ||
        Boolean(nextSubmissions[id]) ||
        Boolean(completedByMap[id]) ||
        (typeof task.completedBy === 'object' && Boolean((task.completedBy as unknown as Record<string, any>)?.[id])),
    ).length;
    isFullyCompleted = completedCount >= task.assignedToIds!.length;
  }

  const taskPhotos =
    task.additionalPhotos && task.additionalPhotos.length > 0
      ? task.additionalPhotos
      : additionalPhotos;

  return {
    ...task,
    status: isFullyCompleted ? 'completed' : 'acknowledged',
    inspectionStatus: 'pending_review',
    completedAt: isFullyCompleted ? completedAt : task.completedAt,
    completedBy: isFullyCompleted ? (task.completedBy ?? uid) : task.completedBy,
    submissions: nextSubmissions,
    beforePhotoUrl: task.beforePhotoUrl ?? bundle.beforePhotoLocalUri,
    afterPhotoUrl: task.afterPhotoUrl ?? bundle.afterPhotoLocalUri,
    additionalPhotos: taskPhotos,
    checklist: task.checklist ?? bundle.checklist,
    remarks: task.remarks || bundle.remarks,
    biometricVerified: task.biometricVerified || bundle.biometricVerified,
    offlineSynced: false,
  };
}

async function reconcileTasksWithOffline(
  taskList: Task[],
  currentUid?: string,
): Promise<Task[]> {
  try {
    const offlineBundles = await readOfflineCompletions();
    if (!offlineBundles || offlineBundles.length === 0) {
      return taskList;
    }
    const bundleMap = new Map<string, CompletionBundle[]>();
    for (const bundle of offlineBundles) {
      const list = bundleMap.get(bundle.taskId) ?? [];
      list.push(bundle);
      bundleMap.set(bundle.taskId, list);
    }
    return taskList.map((task) => {
      const bundles = bundleMap.get(task.id);
      if (!bundles || bundles.length === 0) {
        return task;
      }
      return bundles.reduce(
        (accTask, bundle) => applyOfflineBundleToTask(accTask, bundle, currentUid),
        task,
      );
    });
  } catch {
    return taskList;
  }
}

function deduplicateTasks(taskList: Task[]): Task[] {
  const map = new Map<string, Task>();
  for (const task of taskList) {
    if (task && task.id) {
      map.set(task.id, task);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  );
}

function hydrateCachedTask(raw: any): Task {
  return {
    ...raw,
    createdAt: toDate(raw.createdAt) ?? new Date(),
    assignedAt: toDate(raw.assignedAt),
    acknowledgedAt: toDate(raw.acknowledgedAt),
    completedAt: toDate(raw.completedAt),
    autoAssignmentEligibleAt: toDate(raw.autoAssignmentEligibleAt),
    inspectedAt: toDate(raw.inspectedAt),
    recheckedAt: toDate(raw.recheckedAt),
    beforePhotoCapturedAt: toDate(raw.beforePhotoCapturedAt),
    afterPhotoCapturedAt: toDate(raw.afterPhotoCapturedAt),
    acknowledgedBy: parseTimestampMap(raw.acknowledgedBy),
    completedByMap: parseTimestampMap(raw.completedByMap ?? raw.completedBy),
    completedBy:
      typeof raw.completedBy === 'string' && raw.completedBy.trim()
        ? raw.completedBy.trim()
        : null,
    submissions: parseSubmissions(raw.submissions),
    additionalPhotos: parseAreaPhotos(raw.additionalPhotos),
    reassignmentHistory: parseReassignmentHistory(raw.reassignmentHistory),
  };
}

export function TasksProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>(tasks);
  const [historyBadgeCount, setHistoryBadgeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const clearHistoryBadge = useCallback(() => {
    setHistoryBadgeCount(0);
  }, []);

  const incrementHistoryBadge = useCallback(() => {
    setHistoryBadgeCount((prev) => prev + 1);
  }, []);

  // 1. Instant 0ms cache hydration on initial mount
  useEffect(() => {
    let isMounted = true;
    if (!user) return () => { isMounted = false; };
    const cacheKey = `${TASKS_CACHE_KEY_PREFIX}:${role ?? 'unknown'}:${user.uid}`;
    void (async () => {
      try {
        const [cached, offlineBundles] = await Promise.all([
          AsyncStorage.getItem(cacheKey),
          readOfflineCompletions().catch(() => []),
        ]);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            let hydrated = parsed.map(hydrateCachedTask);
            if (offlineBundles && offlineBundles.length > 0) {
              const bundleMap = new Map<string, CompletionBundle[]>();
              for (const bundle of offlineBundles) {
                const list = bundleMap.get(bundle.taskId) ?? [];
                list.push(bundle);
                bundleMap.set(bundle.taskId, list);
              }
              hydrated = hydrated.map((t) => {
                const bundles = bundleMap.get(t.id);
                if (!bundles || bundles.length === 0) return t;
                return bundles.reduce(
                  (accTask, b) => applyOfflineBundleToTask(accTask, b, user.uid),
                  t,
                );
              });
            }
            setTasks(deduplicateTasks(hydrated));
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('[TasksContext] Cache hydration warning:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [role, user]);

  const saveCache = useCallback((nextTasks: Task[]) => {
    if (!user) return;
    try {
      const cacheKey = `${TASKS_CACHE_KEY_PREFIX}:${role ?? 'unknown'}:${user.uid}`;
      void AsyncStorage.setItem(cacheKey, JSON.stringify(nextTasks));
    } catch {
      // ignore cache write failures
    }
  }, [role, user]);

  const updateLocalTask = useCallback((updatedTask: Task) => {
    setHistoryBadgeCount((prev) => Math.max(1, prev + 1));
    setTasks((prevTasks) => {
      const exists = prevTasks.some((t) => t.id === updatedTask.id);
      const nextTasks = exists
        ? prevTasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
        : [updatedTask, ...prevTasks];
      const deduped = deduplicateTasks(nextTasks);
      tasksRef.current = deduped;
      saveCache(deduped);
      return deduped;
    });
  }, [saveCache]);

  const refreshTasks = useCallback(async (): Promise<void> => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    try {
      const apiTasks = await fetchTasks();
      const deduped = deduplicateTasks(apiTasks);
      const reconciled = await reconcileTasksWithOffline(deduped, user.uid);
      setTasks(reconciled);
      saveCache(reconciled);
      setErrorMessage(null);
    } catch (error) {
      if (isTransientAuthError(error)) {
        console.warn('[TasksContext] Transient auth error during refreshTasks, suppressing banner:', error);
        return;
      }
      const online = await isOnlineAsync().catch(() => true);
      if (!online) {
        console.warn('[TasksContext] Network offline during refreshTasks, suppressing error banner.');
        return;
      }
      const message =
        error instanceof Error
          ? `Unable to refresh maintenance tasks: ${error.message}`
          : 'Unable to refresh maintenance tasks.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [saveCache, user]);

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setTasks([]);
      setLoading(false);
      setErrorMessage(null);
      return undefined;
    }

    // Only set loading to true on cold boot with empty tasks to prevent screen flashing
    setTasks((prev) => {
      if (prev.length === 0) {
        setLoading(true);
      }
      return prev;
    });
    setErrorMessage(null);

    void refreshTasks();

    const unsubscribers: Array<() => void> = [];
    try {
      if (typeof db?.collection === 'function') {
        const collection = db.collection('tasks');
        const queryEntries: Array<{
          key: string;
          query: FirebaseFirestoreTypes.Query;
        }> = [];
        if (role === 'supervisor') {
          queryEntries.push({ key: 'supervisor-all', query: collection });
        } else if (typeof collection?.where === 'function') {
          queryEntries.push(
            { key: 'assigned-ids', query: collection.where('assignedToIds', 'array-contains', user.uid) },
            { key: 'assigned-uid', query: collection.where('assignedTo', '==', user.uid) },
            { key: 'broadcast', query: collection.where('isBroadcast', '==', true) },
            { key: 'rechecked-uid', query: collection.where('recheckedBy', '==', user.uid) },
          );
          if (user.email) {
            queryEntries.push({ key: 'assigned-email', query: collection.where('assignedTo', '==', user.email) });
          }
        }

        const queryResults = new Map<string, Task[]>();
        const publishMergedResults = async () => {
          const merged = deduplicateTasks(Array.from(queryResults.values()).flat());
          const reconciled = await reconcileTasksWithOffline(merged, user.uid);
          if (!isMounted) return;
          setTasks(reconciled);
          saveCache(reconciled);
          setLoading(false);
          if (reconciled.length > 0) {
            setErrorMessage(null);
          }
        };

        for (const { key, query } of queryEntries) {
          if (typeof query?.onSnapshot !== 'function') continue;
          const unsubscribe = query.onSnapshot(
            (snapshot: FirebaseFirestoreTypes.QuerySnapshot) => {
              if (snapshot) {
                const parsed = (snapshot.docs ?? [])
                  .map((doc) => parseTaskDocument(doc.id, doc.data() as any))
                  .filter((task): task is Task => task !== null);
                queryResults.set(key, parsed);
                void publishMergedResults();
              }
            },
            (error: Error) => {
              console.warn('[TasksContext] onSnapshot error, falling back to polling:', error);
            },
          );
          if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe);
        }
      }
    } catch (err) {
      console.warn('[TasksContext] Failed to bind onSnapshot listener:', err);
    }

    const intervalId = setInterval(() => {
      void refreshTasks();
    }, 10000);

    return () => {
      isMounted = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      clearInterval(intervalId);
    };
  }, [refreshTasks, role, saveCache, user]);

  const inboxTasks = tasks.filter((task) => {
    if (task.status === 'completed') {
      return false;
    }

    if (role === 'supervisor') {
      return true;
    }

    const isUserAssigned = Boolean(
      user?.uid && (
        task.assignedTo === user.uid ||
        task.assignedTo === user.email ||
        (task.assignedToIds && task.assignedToIds.includes(user.uid)) ||
        (task.status === 'rechecking' && task.recheckedBy === user.uid)
      )
    );

    // If flagged, strictly scope to the accountable worker (assigned tech or original submitter if unassigned)
    if (task.status === 'flagged') {
      const hasUserCompleted =
        task.completedBy === user?.uid ||
        Boolean(user?.uid && (task.submissions?.[user.uid] || task.completedByMap?.[user.uid]));
      const isAccountable =
        isUserAssigned ||
        (!task.assignedTo &&
          (!task.assignedToIds || task.assignedToIds.length === 0) &&
          hasUserCompleted);
      return isAccountable;
    }

    if (task.status === 'rechecking') {
      return isUserAssigned;
    }

    // For other active tasks, if the technician already submitted, hide it from inbox
    const hasPriorSubmission = Boolean(
      user?.uid &&
        ((task.submissions && task.submissions[user.uid]) ||
          (task.completedByMap && task.completedByMap[user.uid]) ||
          task.completedBy === user.uid ||
          (task.completedBy &&
            typeof task.completedBy === 'object' &&
            (task.completedBy as Record<string, any>)[user.uid])),
    );
    if (hasPriorSubmission) {
      return false;
    }

    return (
      (task.status === 'unassigned' && isBroadcastTask(task)) ||
      task.status === 'reassignment_needed' ||
      isBroadcastTask(task) ||
      ((task.status === 'assigned' || task.status === 'acknowledged') &&
        isUserAssigned)
    );
  });

  const activeTasks = inboxTasks.filter((task) => {
    if (
      task.status !== 'rechecking' &&
      user?.uid &&
      ((task.submissions && Boolean(task.submissions[user.uid])) ||
        (task.completedByMap && Boolean(task.completedByMap[user.uid])) ||
        task.completedBy === user.uid ||
        (task.completedBy &&
          typeof task.completedBy === 'object' &&
          Boolean((task.completedBy as Record<string, any>)[user.uid])))
    ) {
      return false;
    }

    const isTeam = Array.isArray(task.assignedToIds) && task.assignedToIds.length > 1;
    const isAcknowledgedForUser = isTeam
      ? Boolean(user?.uid && task.acknowledgedBy && task.acknowledgedBy[user.uid])
      : (task.status === 'acknowledged' ||
         Boolean(user?.uid && task.acknowledgedBy && task.acknowledgedBy[user.uid]));

    const isRecheckingForUser =
      task.status === 'rechecking' &&
      (!task.recheckedBy || task.recheckedBy === user?.uid || isTeam);

    if (!isAcknowledgedForUser && !isRecheckingForUser) {
      return false;
    }

    return (
      task.assignedTo === user?.uid ||
      task.assignedTo === user?.email ||
      (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
      isBroadcastTask(task) ||
      (task.acknowledgedBy && Boolean(task.acknowledgedBy[user?.uid ?? ''])) ||
      task.recheckedBy === user?.uid
    );
  });

  const activeTasksCount = activeTasks.length;

  const historyTasks = tasks
    .filter((task) => {
      if (
        task.status === 'flagged' ||
        task.status === 'rechecking' ||
        task.inspectionStatus === 'flagged'
      ) {
        return false;
      }

      const hasUserSubmitted = Boolean(
        user?.uid && (
          (task.submissions && task.submissions[user.uid]) ||
          (task.completedByMap && task.completedByMap[user.uid]) ||
          (task.completedBy && typeof task.completedBy === 'object' && (task.completedBy as Record<string, any>)[user.uid]) ||
          task.completedBy === user.uid
        )
      );

      const isCompleted = task.status === 'completed';

      if (!isCompleted && !hasUserSubmitted) {
        return false;
      }

      return (
        !task.completedBy ||
        task.completedBy === user?.uid ||
        task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
        (task.submissions && Boolean(task.submissions[user?.uid ?? ''])) ||
        hasUserSubmitted ||
        role === 'supervisor'
      );
    })
    .sort((a, b) => {
      const aTime = a.completedAt?.getTime() ?? a.createdAt.getTime();
      const bTime = b.completedAt?.getTime() ?? b.createdAt.getTime();
      return (
        bTime - aTime ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id)
      );
    });

  const pendingCount = inboxTasks.filter(
    (task) =>
      task.status === 'unassigned' ||
      task.status === 'assigned' ||
      task.status === 'reassignment_needed' ||
      task.status === 'flagged',
  ).length;

  return (
    <TasksContext.Provider
      value={{
        tasks,
        inboxTasks,
        activeTasks,
        activeTasksCount,
        historyTasks,
        pendingCount,
        historyBadgeCount,
        loading,
        errorMessage,
        refreshTasks,
        updateLocalTask,
        incrementHistoryBadge,
        clearHistoryBadge,
        clearError: () => setErrorMessage(null),
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export { TasksContext };
