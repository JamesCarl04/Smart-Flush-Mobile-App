import AsyncStorage from '@react-native-async-storage/async-storage';
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
const TASKS_CACHE_KEY = '@klir:technician_tasks';

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
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Instant 0ms cache hydration on initial mount
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(TASKS_CACHE_KEY);
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
  }, []);

  const saveCache = useCallback((nextTasks: Task[]) => {
    try {
      void AsyncStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(nextTasks));
    } catch {
      // ignore cache write failures
    }
  }, []);

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

    let unsubscribe: (() => void) | undefined;
    try {
      if (typeof db?.collection === 'function') {
        const query = db.collection('tasks');
        if (typeof query?.onSnapshot === 'function') {
          unsubscribe = query.onSnapshot(
            (snapshot) => {
              if (snapshot && !snapshot.empty) {
                const parsed = snapshot.docs
                  .map((doc) => parseTaskDocument(doc.id, doc.data() as any))
                  .filter((task): task is Task => task !== null);
                const deduped = deduplicateTasks(parsed);
                setTasks(deduped);
                saveCache(deduped);
                setLoading(false);
                setErrorMessage(null);
              } else if (snapshot && snapshot.empty) {
                setTasks([]);
                setLoading(false);
              }
            },
            (error) => {
              console.warn('[TasksContext] onSnapshot error, falling back to polling:', error);
            },
          );
        }
      }
    } catch (err) {
      console.warn('[TasksContext] Failed to bind onSnapshot listener:', err);
    }

    const intervalId = setInterval(() => {
      void refreshTasks();
    }, 10000);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      clearInterval(intervalId);
    };
  }, [refreshTasks, saveCache, user]);

  const inboxTasks = tasks.filter(
    (task) =>
      task.status !== 'completed' &&
      (task.status === 'unassigned' ||
        task.status === 'reassignment_needed' ||
        task.status === 'flagged' ||
        task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (task.assignedToIds && task.assignedToIds.includes(user?.uid ?? '')) ||
        isBroadcastTask(task) ||
        task.completedBy === user?.uid ||
        (task.submissions && Boolean(task.submissions[user?.uid ?? '']))),
  );

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

  const pendingCount = tasks.filter(
    (task) =>
      task.status === 'unassigned' ||
      task.status === 'assigned' ||
      task.status === 'reassignment_needed',
  ).length;

  return (
    <TasksContext.Provider
      value={{
        tasks,
        inboxTasks,
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
