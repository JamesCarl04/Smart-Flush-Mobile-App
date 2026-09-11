import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { fetchTasks } from '../lib/task-api';
import {
  isBroadcastTask,
  parseAreaPhotos,
  parseReassignmentHistory,
  parseSubmissions,
  parseTaskDocument,
  parseTimestampMap,
  toDate,
} from '../lib/tasks';
import type { Task, TasksContextValue } from '../types';

const TasksContext = createContext<TasksContextValue | undefined>(undefined);
const TASKS_CACHE_KEY_PREFIX = '@klir:tasks';

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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Instant 0ms cache hydration on initial mount
  useEffect(() => {
    let isMounted = true;
    if (!user) return () => { isMounted = false; };
    const cacheKey = `${TASKS_CACHE_KEY_PREFIX}:${role ?? 'unknown'}:${user.uid}`;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTasks(deduplicateTasks(parsed.map(hydrateCachedTask)));
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
      setTasks(deduped);
      saveCache(deduped);
      setErrorMessage(null);
    } catch (error) {
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
        const publishMergedResults = () => {
          const merged = deduplicateTasks(Array.from(queryResults.values()).flat());
          setTasks(merged);
          saveCache(merged);
          setLoading(false);
          if (merged.length > 0) {
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
                publishMergedResults();
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
        loading,
        errorMessage,
        refreshTasks,
        clearError: () => setErrorMessage(null),
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export { TasksContext };
