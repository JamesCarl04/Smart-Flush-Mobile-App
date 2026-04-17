import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { parseTaskDocument } from '../lib/tasks';
import type { Task, TasksContextValue } from '../types';

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', user.uid),
    );

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const nextTasks = snapshot.docs
          .map((documentSnapshot) =>
            parseTaskDocument(documentSnapshot.id, documentSnapshot.data()),
          )
          .filter((task): task is Task => task !== null)
          .sort(
            (left, right) =>
              right.triggeredAt.getTime() - left.triggeredAt.getTime(),
          );

        setTasks(nextTasks);
        setLoading(false);
      },
      (error) => {
        console.warn('Failed to subscribe to maintenance tasks', error);
        setTasks([]);
        setLoading(false);
      },
    );

    return unsubscribe;
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
      }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export { TasksContext };
