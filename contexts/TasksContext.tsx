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
      setTasks([]);
      setLoading(false);
      setErrorMessage(null);
      return undefined;
    }

    setLoading(true);
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
                  .filter((task): task is Task => task !== null)
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                setTasks(parsed);
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
  }, [refreshTasks, user]);

  const inboxTasks = tasks.filter(
    (task) =>
      (task.status !== 'completed' || task.inspectionStatus === 'flagged') &&
      (task.status === 'unassigned' ||
        task.status === 'reassignment_needed' ||
        task.status === 'flagged' ||
        task.inspectionStatus === 'flagged' ||
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

  const simulateHardwareFailureAlert = useCallback((): Task => {
    const fakeAlertTask: Task = {
      id: `task-hw-${Date.now()}`,
      deviceId: 'toilet-01',
      restroomName: 'Restroom 2',
      location: 'Ground Floor Male Restroom',
      floor: 'Ground',
      building: 'GB3 Building',
      component: 'flush_valve',
      triggerType: 'hardware_failure',
      status: 'assigned',
      message: 'CRITICAL HARDWARE ALERT: Continuous water running detected in flush valve (Critical Flow Leak).',
      assignedTo: user?.uid ?? null,
      createdAt: new Date(),
      assignedAt: new Date(),
      acknowledgedAt: null,
      completedAt: null,
      completedBy: null,
      beforePhotoUrl: null,
      afterPhotoUrl: null,
      type: 'maintenance',
      shift: '1st',
      createdBy: 'system_iot',
    };

    setTasks((prev) => [fakeAlertTask, ...prev]);
    return fakeAlertTask;
  }, [user]);

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
        simulateHardwareFailureAlert,
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export { TasksContext };
