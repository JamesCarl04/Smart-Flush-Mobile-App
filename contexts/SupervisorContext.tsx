import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import {
  fetchMaintenancePersonnel,
  fetchSupervisorTasks,
  type MaintenancePerson,
} from '../lib/supervisor-api';
import { parseTaskDocument } from '../lib/tasks';
import type { Task } from '../types';

export interface SupervisorContextValue {
  tasks: Task[];
  people: MaintenancePerson[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const SupervisorContext = createContext<SupervisorContextValue | undefined>(
  undefined,
);

export function SupervisorProvider({
  children,
}: PropsWithChildren): React.JSX.Element {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<MaintenancePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!user || role !== 'supervisor') {
      setTasks([]);
      setPeople([]);
      setLoading(false);
      return;
    }

    try {
      const [nextTasks, nextPeople] = await Promise.all([
        fetchSupervisorTasks(),
        fetchMaintenancePersonnel(),
      ]);
      setTasks(nextTasks);
      setPeople(nextPeople);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load supervisor data.',
      );
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useEffect(() => {
    if (!user || role !== 'supervisor') {
      setTasks([]);
      setPeople([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    void refresh();

    let unsubTasks: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    try {
      if (typeof db?.collection === 'function') {
        const tasksQuery = db.collection('tasks');
        if (typeof tasksQuery?.onSnapshot === 'function') {
          unsubTasks = tasksQuery.onSnapshot(
            (snapshot) => {
              if (snapshot && !snapshot.empty) {
                const parsed = snapshot.docs
                  .map((doc) => parseTaskDocument(doc.id, doc.data() as any))
                  .filter((task): task is Task => task !== null)
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                setTasks(parsed);
                setLoading(false);
              } else if (snapshot && snapshot.empty) {
                setTasks([]);
                setLoading(false);
              }
            },
            (err) => {
              console.warn('[SupervisorContext] tasks onSnapshot error:', err);
            },
          );
        }

        const usersQuery = db.collection('users');
        if (typeof usersQuery?.onSnapshot === 'function') {
          unsubUsers = usersQuery.onSnapshot(
            (snapshot) => {
              if (snapshot && !snapshot.empty) {
                const mappedPeople = snapshot.docs
                  .map((doc) => {
                    const data = doc.data();
                    const userRole =
                      typeof data.role === 'string'
                        ? data.role.toLowerCase()
                        : '';
                    if (
                      userRole !== 'maintenance' &&
                      userRole !== 'technician' &&
                      userRole !== 'worker'
                    ) {
                      return null;
                    }
                    return {
                      id: doc.id,
                      displayName:
                        typeof data.displayName === 'string' &&
                        data.displayName.trim()
                          ? data.displayName.trim()
                          : data.email ?? doc.id,
                      email: typeof data.email === 'string' ? data.email : null,
                      isAvailable: data.isAvailable !== false,
                      currentTaskId:
                        typeof data.currentTaskId === 'string'
                          ? data.currentTaskId
                          : null,
                      shift: typeof data.shift === 'string' ? data.shift : '1st',
                      building:
                        typeof data.building === 'string'
                          ? data.building
                          : 'SDCA Annex Building',
                      supervisorUid:
                        typeof data.supervisorUid === 'string'
                          ? data.supervisorUid
                          : null,
                    } as MaintenancePerson;
                  })
                  .filter(
                    (person): person is MaintenancePerson => person !== null,
                  );
                setPeople(mappedPeople);
              }
            },
            (err) => {
              console.warn('[SupervisorContext] users onSnapshot error:', err);
            },
          );
        }
      }
    } catch (err) {
      console.warn(
        '[SupervisorContext] Failed to bind onSnapshot listeners:',
        err,
      );
    }

    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      if (typeof unsubTasks === 'function') {
        unsubTasks();
      }
      if (typeof unsubUsers === 'function') {
        unsubUsers();
      }
      clearInterval(timer);
    };
  }, [refresh, role, user]);

  return (
    <SupervisorContext.Provider
      value={{
        tasks,
        people,
        loading,
        error,
        refresh,
        clearError: () => setError(null),
      }}
    >
      {children}
    </SupervisorContext.Provider>
  );
}

export function useSupervisorContext(): SupervisorContextValue {
  const context = useContext(SupervisorContext);
  if (!context) {
    throw new Error(
      'useSupervisorContext must be used within a SupervisorProvider',
    );
  }
  return context;
}
