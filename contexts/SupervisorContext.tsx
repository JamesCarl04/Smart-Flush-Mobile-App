import AsyncStorage from '@react-native-async-storage/async-storage';
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
  extractTimestampMillis,
  PRESENCE_TIMEOUT_MS,
  type MaintenancePerson,
} from '../lib/supervisor-api';
import {
  parseSubmissions,
  parseTaskDocument,
  parseTimestampMap,
  toDate,
} from '../lib/tasks';
import type { Task } from '../types';

export interface SupervisorContextValue {
  tasks: Task[];
  people: MaintenancePerson[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const SUPERVISOR_TASKS_CACHE_KEY = '@klir:supervisor_tasks';
const SUPERVISOR_PEOPLE_CACHE_KEY = '@klir:supervisor_people';

function hydrateCachedTask(raw: any): Task {
  const isFlagged = raw.inspectionStatus === 'flagged' || raw.status === 'flagged';
  const isRechecking = raw.inspectionStatus === 'rechecking' || raw.status === 'rechecking';
  const resolvedStatus = isFlagged ? 'flagged' : isRechecking ? 'rechecking' : raw.status;

  return {
    ...raw,
    status: resolvedStatus,
    createdAt: toDate(raw.createdAt) ?? new Date(0),
    assignedAt: toDate(raw.assignedAt),
    acknowledgedAt: toDate(raw.acknowledgedAt),
    completedAt: toDate(raw.completedAt),
    beforePhotoCapturedAt: toDate(raw.beforePhotoCapturedAt),
    afterPhotoCapturedAt: toDate(raw.afterPhotoCapturedAt),
    inspectedAt: toDate(raw.inspectedAt),
    recheckedAt: toDate(raw.recheckedAt),
    flaggedAt: toDate(raw.flaggedAt),
    autoAssignmentEligibleAt: toDate(raw.autoAssignmentEligibleAt),
    submissions: parseSubmissions(raw.submissions),
    acknowledgedBy: parseTimestampMap(raw.acknowledgedBy),
    completedByMap: parseTimestampMap(raw.completedByMap ?? raw.completedBy),
    completedBy:
      typeof raw.completedBy === 'string' && raw.completedBy.trim()
        ? raw.completedBy.trim()
        : null,
  };
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

  // 1. Instant Cache Hydration on initial mount (0ms)
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const [cachedTasksStr, cachedPeopleStr] = await Promise.all([
          AsyncStorage.getItem(SUPERVISOR_TASKS_CACHE_KEY),
          AsyncStorage.getItem(SUPERVISOR_PEOPLE_CACHE_KEY),
        ]);

        if (!isMounted) return;

        if (cachedTasksStr) {
          const parsed = JSON.parse(cachedTasksStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTasks(parsed.map(hydrateCachedTask));
            setLoading(false);
          }
        }

        if (cachedPeopleStr) {
          const parsed = JSON.parse(cachedPeopleStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPeople(parsed);
          }
        }
      } catch (err) {
        console.warn('[SupervisorContext] Cache hydration warning:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const saveCache = useCallback((nextTasks: Task[], nextPeople: MaintenancePerson[]) => {
    try {
      void AsyncStorage.setItem(SUPERVISOR_TASKS_CACHE_KEY, JSON.stringify(nextTasks));
      void AsyncStorage.setItem(SUPERVISOR_PEOPLE_CACHE_KEY, JSON.stringify(nextPeople));
    } catch {
      // ignore cache write failures
    }
  }, []);

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
      saveCache(nextTasks, nextPeople);
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
  }, [role, saveCache, user]);

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
                void AsyncStorage.setItem(SUPERVISOR_TASKS_CACHE_KEY, JSON.stringify(parsed));
              } else if (snapshot && snapshot.empty) {
                setTasks([]);
                setLoading(false);
                void AsyncStorage.setItem(SUPERVISOR_TASKS_CACHE_KEY, JSON.stringify([]));
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
                      isAvailable: (() => {
                        const ls = extractTimestampMillis(data.lastSeen);
                        const isFresh = ls !== null && Date.now() - ls <= PRESENCE_TIMEOUT_MS;
                        return data.status !== 'offline' && data.isOnline !== false && isFresh;
                      })(),
                      isOnline: (() => {
                        const ls = extractTimestampMillis(data.lastSeen);
                        const isFresh = ls !== null && Date.now() - ls <= PRESENCE_TIMEOUT_MS;
                        return data.status !== 'offline' && data.isOnline !== false && isFresh;
                      })(),
                      status: typeof data.status === 'string' ? data.status : null,
                      isActive: data.isActive !== false,
                      lastSeen: data.lastSeen,
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
                void AsyncStorage.setItem(SUPERVISOR_PEOPLE_CACHE_KEY, JSON.stringify(mappedPeople));
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
