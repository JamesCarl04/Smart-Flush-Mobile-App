import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import * as Network from 'expo-network';
import { Snackbar } from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import { syncOfflineCompletions } from '../lib/task-completion';

interface OfflineSyncContextValue {
  syncing: boolean;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | undefined>(
  undefined,
);

export function OfflineSyncProvider({
  children,
}: PropsWithChildren): React.JSX.Element {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!user || syncing) {
      return;
    }

    setSyncing(true);
    try {
      const count = await syncOfflineCompletions();
      if (count > 0) {
        setMessage(`Offline sync complete. ${count} task${count === 1 ? '' : 's'} uploaded.`);
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    void syncNow();
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncNow, user]);

  return (
    <OfflineSyncContext.Provider value={{ syncing }}>
      {children}
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)}>
        {message ?? ''}
      </Snackbar>
    </OfflineSyncContext.Provider>
  );
}

export { OfflineSyncContext };
