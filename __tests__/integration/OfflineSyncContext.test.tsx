import React from 'react';
import { Button, Text, View } from 'react-native';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as Network from 'expo-network';

import { OfflineSyncProvider } from '../../contexts/OfflineSyncContext';
import * as taskCompletion from '../../lib/task-completion';
import * as useAuthHook from '../../hooks/useAuth';

jest.mock('../../lib/task-completion');
jest.mock('../../hooks/useAuth');

function TestChildComponent(): React.JSX.Element {
  return (
    <View>
      <Text testID="app-content">Offline Sync App Ready</Text>
    </View>
  );
}

describe('OfflineSyncContext Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: {
        uid: 'user-tech-1',
        email: 'tech1@smartflush.com',
        role: 'maintenance',
        name: 'Alex Technician',
      },
      role: 'maintenance',
      loading: false,
      logout: jest.fn(),
    });
  });

  it('runs sync on mount and displays snackbar when offline tasks are uploaded', async () => {
    (taskCompletion.syncOfflineCompletions as jest.Mock).mockResolvedValue(2);

    render(
      <PaperProvider>
        <OfflineSyncProvider>
          <TestChildComponent />
        </OfflineSyncProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(taskCompletion.syncOfflineCompletions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Offline sync complete. 2 tasks uploaded.'),
      ).toBeTruthy();
    });
  });

  it('handles singular task count formatting in snackbar message', async () => {
    (taskCompletion.syncOfflineCompletions as jest.Mock).mockResolvedValue(1);

    render(
      <PaperProvider>
        <OfflineSyncProvider>
          <TestChildComponent />
        </OfflineSyncProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Offline sync complete. 1 task uploaded.'),
      ).toBeTruthy();
    });
  });

  it('does not display snackbar when no offline tasks need syncing (count is 0)', async () => {
    (taskCompletion.syncOfflineCompletions as jest.Mock).mockResolvedValue(0);

    render(
      <PaperProvider>
        <OfflineSyncProvider>
          <TestChildComponent />
        </OfflineSyncProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(taskCompletion.syncOfflineCompletions).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/Offline sync complete/)).toBeNull();
  });

  it('triggers sync when network state listener detects reconnection', async () => {
    let networkListenerCallback: ((state: any) => void) | null = null;

    (Network.addNetworkStateListener as jest.Mock).mockImplementation((cb) => {
      networkListenerCallback = cb;
      return { remove: jest.fn() };
    });

    (taskCompletion.syncOfflineCompletions as jest.Mock).mockResolvedValue(0);

    render(
      <PaperProvider>
        <OfflineSyncProvider>
          <TestChildComponent />
        </OfflineSyncProvider>
      </PaperProvider>,
    );

    // Wait for initial mount sync to finish
    await waitFor(() => {
      expect(taskCompletion.syncOfflineCompletions).toHaveBeenCalled();
    });

    // Ensure state has fully settled
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Prepare reconnect sync count
    (taskCompletion.syncOfflineCompletions as jest.Mock).mockResolvedValue(3);

    // Trigger reconnection event
    await act(async () => {
      if (networkListenerCallback) {
        networkListenerCallback({
          isConnected: true,
          isInternetReachable: true,
        });
      }
    });

    await waitFor(() => {
      expect(
        screen.getByText('Offline sync complete. 3 tasks uploaded.'),
      ).toBeTruthy();
    });
  });

  it('skips sync when user is not authenticated', async () => {
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: null,
      role: null,
      loading: false,
      logout: jest.fn(),
    });

    render(
      <PaperProvider>
        <OfflineSyncProvider>
          <TestChildComponent />
        </OfflineSyncProvider>
      </PaperProvider>,
    );

    expect(taskCompletion.syncOfflineCompletions).not.toHaveBeenCalled();
  });
});
