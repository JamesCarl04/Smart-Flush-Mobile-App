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
import { isBroadcastTask, parseTaskDocument } from '../lib/tasks';
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
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

function hydrateCachedTask(raw: any): Task {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    assignedAt: raw.assignedAt ? new Date(raw.assignedAt) : null,
    acknowledgedAt: raw.acknowledgedAt ? new Date(raw.acknowledgedAt) : null,
    completedAt: raw.completedAt ? new Date(raw.completedAt) : null,
    beforePhotoCapturedAt: raw.beforePhotoCapturedAt
      ? new Date(raw.beforePhotoCapturedAt)
      : null,
    afterPhotoCapturedAt: raw.afterPhotoCapturedAt
      ? new Date(raw.afterPhotoCapturedAt)
      : null,
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
          setErrorMessage(null);
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

  const inboxTasks = tasks.filter(
    (task) =>
      task.status !== 'completed' &&
      ((task.status === 'unassigned' && isBroadcastTask(task)) ||
        task.status === 'assigned' ||
        task.status === 'reassignment_needed' ||
        task.status === 'flagged' ||
        task.status === 'acknowledged' ||
        task.status === 'rechecking' ||
        task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
        isBroadcastTask(task) ||
        task.completedBy === user?.uid ||
        (task.submissions && Boolean(task.submissions[user?.uid ?? '']))),
  );

  const activeTasks = inboxTasks.filter(
    (task) =>
      (task.status === 'acknowledged' || task.status === 'rechecking') &&
      (task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
        isBroadcastTask(task) ||
        (task.acknowledgedBy && Boolean(task.acknowledgedBy[user?.uid ?? ''])) ||
        task.recheckedBy === user?.uid),
  );

  const activeTasksCount = activeTasks.length;

  const historyTasks = tasks.filter(
    (task) =>
      (task.status === 'completed' || Boolean(task.completedAt)) &&
      (!task.completedBy ||
        task.completedBy === user?.uid ||
        task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
        (task.submissions && Boolean(task.submissions[user?.uid ?? '']))),
  );

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
