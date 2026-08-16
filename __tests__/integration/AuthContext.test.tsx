import React from 'react';
import { Alert, Button, Text, View } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as FirebaseAuth from '@react-native-firebase/auth';

import { AuthProvider } from '../../contexts/AuthContext';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebase';
import { mockAuthModule } from '../../jest.setup';

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

    expect(FirebaseAuth.signOut).toHaveBeenCalledWith(auth);
  });
});
