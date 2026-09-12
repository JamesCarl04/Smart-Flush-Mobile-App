import React from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as FirebaseAuth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, USER_PROFILE_CACHE_KEY } from '../../contexts/AuthContext';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { mockAuthModule, mockMessagingModule, mockFirestoreDoc } from '../../jest.setup';

function TestAuthConsumer(): React.JSX.Element {
  const { user, role, loading, logout } = useAuth();

  return (
    <View>
      <Text testID="loading-state">{loading ? 'LOADING' : 'READY'}</Text>
      <Text testID="user-uid">{user?.uid ?? 'NO_USER'}</Text>
      <Text testID="user-email">{user?.email ?? 'NO_EMAIL'}</Text>
      <Text testID="user-role">{role ?? 'NO_ROLE'}</Text>
      <Text testID="user-name">{user?.name ?? 'NO_NAME'}</Text>
      <Text testID="user-building">{user?.building ?? 'NO_BUILDING'}</Text>
      <Button testID="logout-button" title="Log out" onPress={() => void logout()} />
    </View>
  );
}

describe('AuthContext Integration', () => {
  const originalFetch = global.fetch;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    alertSpy.mockRestore();
  });

  it('resolves authenticated state when user has "maintenance" role', async () => {
    const mockFirebaseUser = {
      uid: 'maint-user-1',
      email: 'tech@smartflush.com',
      displayName: 'Tech Tester',
      getIdToken: jest.fn().mockResolvedValue('token-maint'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'maint-user-1',
          email: 'tech@smartflush.com',
          name: 'Tech Tester',
          role: 'maintenance',
          building: 'Main Campus',
        },
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('maint-user-1');
    expect(screen.getByTestId('user-email').props.children).toBe('tech@smartflush.com');
    expect(screen.getByTestId('user-role').props.children).toBe('maintenance');
    expect(screen.getByTestId('user-name').props.children).toBe('Tech Tester');
    expect(screen.getByTestId('user-building').props.children).toBe('Main Campus');
  });

  it('resolves authenticated state when user has "supervisor" role', async () => {
    const mockFirebaseUser = {
      uid: 'sup-user-2',
      email: 'supervisor@smartflush.com',
      displayName: 'Super Visor',
      getIdToken: jest.fn().mockResolvedValue('token-sup'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'sup-user-2',
          email: 'supervisor@smartflush.com',
          displayName: 'Super Visor',
          role: 'supervisor',
          building: 'HQ Tower',
        },
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('sup-user-2');
    expect(screen.getByTestId('user-role').props.children).toBe('supervisor');
    expect(screen.getByTestId('user-name').props.children).toBe('Super Visor');
    expect(screen.getByTestId('user-building').props.children).toBe('HQ Tower');
  });

  it('handles unauthorized/invalid role by alerting error, nullifying user, and invoking signOut', async () => {
    const mockFirebaseUser = {
      uid: 'unauthorized-user',
      email: 'guest@smartflush.com',
      displayName: 'Guest User',
      getIdToken: jest.fn().mockResolvedValue('token-guest'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'unauthorized-user',
          email: 'guest@smartflush.com',
          role: 'guest',
        },
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('NO_USER');
    expect(screen.getByTestId('user-role').props.children).toBe('NO_ROLE');
    expect(alertSpy).toHaveBeenCalledWith(
      'Authentication error',
      'Access denied. This app is for maintenance and supervisor accounts only.',
    );
    expect(FirebaseAuth.signOut).toHaveBeenCalledWith(auth);
  });

  it('handles API verification failure by alerting error, nullifying user, and invoking signOut', async () => {
    const mockFirebaseUser = {
      uid: 'failing-user',
      email: 'fail@smartflush.com',
      displayName: 'Fail Tester',
      getIdToken: jest.fn().mockResolvedValue('token-fail'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Backend authentication service unavailable.',
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('NO_USER');
    expect(alertSpy).toHaveBeenCalledWith(
      'Authentication error',
      'Backend authentication service unavailable.',
    );
    expect(FirebaseAuth.signOut).toHaveBeenCalledWith(auth);
  });

  it('handles unauthenticated state when Firebase onAuthStateChanged receives null', async () => {
    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(null);
      return jest.fn();
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('NO_USER');
    expect(screen.getByTestId('user-role').props.children).toBe('NO_ROLE');
  });

  it('calls signOut(auth) when logout is triggered', async () => {
    const mockFirebaseUser = {
      uid: 'maint-user-1',
      email: 'tech@smartflush.com',
      displayName: 'Tech Tester',
      getIdToken: jest.fn().mockResolvedValue('token-maint'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'maint-user-1',
          email: 'tech@smartflush.com',
          role: 'maintenance',
        },
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(FirebaseAuth.signOut).toHaveBeenCalledWith(auth);
    });
    expect(mockMessagingModule.deleteToken).toHaveBeenCalled();
  });

  it('signs out of Firebase Auth even if unregisterPushNotificationsAsync encounters an error', async () => {
    const mockFirebaseUser = {
      uid: 'maint-user-error',
      email: 'tech-error@smartflush.com',
      displayName: 'Tech Error',
      getIdToken: jest.fn().mockResolvedValue('token-maint'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network offline during logout'));
    mockMessagingModule.deleteToken.mockRejectedValueOnce(new Error('FCM unregister failed'));

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    fireEvent.press(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(FirebaseAuth.signOut).toHaveBeenCalledWith(auth);
    });
  });

  it('hydrates user profile instantly from AsyncStorage cache for 0ms startup', async () => {
    const cachedProfile = {
      uid: 'cached-tech-1',
      email: 'cached@smartflush.com',
      role: 'maintenance',
      name: 'Cached Technician',
      building: 'Engineering Wing',
      shift: '1st',
    };

    await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cachedProfile));

    // Do not emit any Firebase onAuthStateChanged immediately
    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation(() => jest.fn());

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('cached-tech-1');
    expect(screen.getByTestId('user-role').props.children).toBe('maintenance');
    expect(screen.getByTestId('user-name').props.children).toBe('Cached Technician');
  });

  it('optimistically clears user and role state immediately upon logout', async () => {
    const mockFirebaseUser = {
      uid: 'maint-fast-logout',
      email: 'fast@smartflush.com',
      displayName: 'Fast Logout User',
      getIdToken: jest.fn().mockResolvedValue('token-fast'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'maint-fast-logout',
          email: 'fast@smartflush.com',
          role: 'maintenance',
          name: 'Fast Logout User',
        },
      }),
    });

    // Make signOut return a slow pending promise to verify optimistic reset
    let resolveSignOut: () => void;
    (FirebaseAuth.signOut as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { resolveSignOut = resolve; }),
    );

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    expect(screen.getByTestId('user-uid').props.children).toBe('maint-fast-logout');

    // Press logout
    fireEvent.press(screen.getByTestId('logout-button'));

    // Optimistic reset should immediately transition to NO_USER without waiting for signOut to resolve
    expect(screen.getByTestId('user-uid').props.children).toBe('NO_USER');
    expect(screen.getByTestId('user-role').props.children).toBe('NO_ROLE');

    // Resolve signOut to cleanup
    resolveSignOut!();
  });

  it('preserves cached profile and stays logged in when network fails during startup revalidation', async () => {
    const cachedProfile = {
      uid: 'offline-worker-1',
      email: 'offline@smartflush.com',
      role: 'maintenance',
      name: 'Offline Worker',
      building: 'South Wing',
      shift: '1st',
    };

    await AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(cachedProfile));

    const mockFirebaseUser = {
      uid: 'offline-worker-1',
      email: 'offline@smartflush.com',
      displayName: 'Offline Worker',
      getIdToken: jest.fn().mockResolvedValue('token-offline'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    // Simulate network failure when revalidating
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    // Should stay logged in with cached profile
    expect(screen.getByTestId('user-uid').props.children).toBe('offline-worker-1');
    expect(screen.getByTestId('user-role').props.children).toBe('maintenance');
    expect(screen.getByTestId('user-name').props.children).toBe('Offline Worker');

    // Should not have called signOut
    expect(FirebaseAuth.signOut).not.toHaveBeenCalled();
  });

  it('synchronizes online presence on login and transitions to offline on logout', async () => {
    const mockFirebaseUser = {
      uid: 'tech-presence-1',
      email: 'tech-presence@smartflush.com',
      displayName: 'Presence Tech',
      getIdToken: jest.fn().mockResolvedValue('token-presence'),
    };

    (FirebaseAuth.onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(mockFirebaseUser);
      return jest.fn();
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'tech-presence-1',
          email: 'tech-presence@smartflush.com',
          role: 'maintenance',
        },
      }),
    });

    render(
      <PaperProvider>
        <AuthProvider>
          <TestAuthConsumer />
        </AuthProvider>
      </PaperProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading-state').props.children).toBe('READY');
    });

    // Verify online presence update on login
    await waitFor(() => {
      expect(mockFirestoreDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: true,
          status: 'available',
        }),
      );
    });

    mockFirestoreDoc.update.mockClear();

    // Trigger logout
    fireEvent.press(screen.getByTestId('logout-button'));

    // Verify offline presence update and backend notification on logout
    await waitFor(() => {
      expect(mockFirestoreDoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isOnline: false,
          status: 'offline',
        }),
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });
});


