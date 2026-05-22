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
