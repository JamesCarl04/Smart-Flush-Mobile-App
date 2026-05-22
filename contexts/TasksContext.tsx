import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  type QuerySnapshot,
} from 'firebase/firestore';

import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { fetchTasks } from '../lib/task-api';
import { parseTaskDocument } from '../lib/tasks';
import type { Task, TasksContextValue } from '../types';

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshTasks = useCallback(async (): Promise<void> => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    try {
      const apiTasks = await fetchTasks();
      setTasks(apiTasks);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? `Unable to refresh maintenance tasks: ${error.message}`
          : 'Unable to refresh maintenance tasks. Check your connection and try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    void refreshTasks();
    const intervalId = setInterval(() => {
      void refreshTasks();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [refreshTasks, user]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      setErrorMessage(null);
      return undefined;
    }

    setLoading(true);
    setErrorMessage(null);
    let assignedTasks: Task[] = [];
    let unassignedPendingTasks: Task[] = [];
    let assignedReady = false;
    let pendingReady = false;

    const mapSnapshot = (snapshot: QuerySnapshot): Task[] =>
      snapshot.docs
        .map((documentSnapshot) =>
          parseTaskDocument(documentSnapshot.id, documentSnapshot.data()),
        )
        .filter((task): task is Task => task !== null);

    const publishTasks = (): void => {
      const taskMap = new Map<string, Task>();

      for (const task of assignedTasks) {
        taskMap.set(task.id, task);
      }

      for (const task of unassignedPendingTasks) {
        if (task.assignedTo === null && task.status === 'pending') {
          taskMap.set(task.id, task);
        }
      }

      const nextTasks = Array.from(taskMap.values()).sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );

      setTasks(nextTasks);
      setLoading(!(assignedReady && pendingReady));
    };

    const handleSnapshotError = (error: Error): void => {
      console.warn('Failed to subscribe to maintenance tasks', error);
      setErrorMessage(
        error.message
          ? `Unable to refresh maintenance tasks: ${error.message}`
          : 'Unable to refresh maintenance tasks. Check your connection and try again.',
      );
      setLoading(false);
    };

    const assignedTasksQuery = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', user.uid),
    );
    const unassignedPendingTasksQuery = query(
      collection(db, 'tasks'),
      where('status', '==', 'pending'),
    );

    const unsubscribeAssignedTasks = onSnapshot(
      assignedTasksQuery,
      (snapshot) => {
        assignedTasks = mapSnapshot(snapshot);
        assignedReady = true;
        publishTasks();
      },
      handleSnapshotError,
    );
    const unsubscribeUnassignedPendingTasks = onSnapshot(
      unassignedPendingTasksQuery,
      (snapshot) => {
        unassignedPendingTasks = mapSnapshot(snapshot);
        pendingReady = true;
        publishTasks();
      },
      handleSnapshotError,
    );

    return () => {
      unsubscribeAssignedTasks();
      unsubscribeUnassignedPendingTasks();
    };
  }, [user]);

  const inboxTasks = tasks.filter((task) => task.status !== 'completed');
  const historyTasks = tasks.filter((task) => task.status === 'completed');
  const pendingCount = tasks.filter((task) => task.status === 'pending').length;

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
