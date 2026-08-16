import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../hooks/useAuth';
import { fetchTasks } from '../lib/task-api';
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
    const intervalId = setInterval(() => {
      void refreshTasks();
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [refreshTasks, user]);

  const inboxTasks = tasks.filter((task) => task.status !== 'completed');
  const historyTasks = tasks.filter(
    (task) => task.status === 'completed' && task.completedBy === user?.uid,
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
      message: '🚨 CRITICAL HARDWARE ALERT: Continuous water running detected in flush valve (Critical Flow Leak).',
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
