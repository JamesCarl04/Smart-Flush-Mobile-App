import { useContext } from 'react';

import { OfflineSyncContext } from '../contexts/OfflineSyncContext';

export function useOfflineSync(): { syncing: boolean } {
  const context = useContext(OfflineSyncContext);

  if (!context) {
    return { syncing: false };
  }

  return context;
}
