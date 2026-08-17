import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';
import { onAuthStateChanged, signOut } from '@react-native-firebase/auth';

import { getRequiredConfigValue, runtimeConfig } from '../lib/config';
import { auth } from '../lib/firebase';
import type { AuthContextValue, AuthUser, UserRole } from '../types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
interface ProfileResponse {
  success: boolean;
  data?: {
    id?: unknown;
    email?: unknown;
    displayName?: unknown;
    name?: unknown;
    role?: unknown;
    building?: unknown;
  };
  error?: string;
}

function buildApiUrl(path: string): string {
  const baseUrl = getRequiredConfigValue(
    'EXPO_PUBLIC_BACKEND_API_BASE_URL',
    runtimeConfig.backendApiBaseUrl,
  ).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function verifyUserProfile(
  firebaseUser: NonNullable<typeof auth.currentUser>,
): Promise<AuthUser> {
  const request = async (forceRefresh = false) => {
    const token = await firebaseUser.getIdToken(forceRefresh);
    return fetch(buildApiUrl('/api/auth/me'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

  let response = await request();

  if (response.status === 401) {
    response = await request(true);
  }

  const payload = (await response.json().catch(() => null)) as
    | ProfileResponse
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? 'Unable to verify your account.');
  }

  const roleString =
    typeof payload.data?.role === 'string'
      ? payload.data.role.trim().toLowerCase()
      : null;

  if (roleString !== 'maintenance' && roleString !== 'supervisor') {
    throw new Error('Access denied. This app is for maintenance and supervisor accounts only.');
  }

  return {
    uid: firebaseUser.uid,
    email:
      typeof payload.data?.email === 'string'
        ? payload.data.email
        : firebaseUser.email ?? '',
    role: roleString as UserRole,
    name:
      typeof payload.data?.name === 'string'
        ? payload.data.name
        : typeof payload.data?.displayName === 'string'
          ? payload.data.displayName
          : firebaseUser.displayName ?? firebaseUser.email ?? '',
    building:
      typeof payload.data?.building === 'string' ? payload.data.building : null,
  };
}

async function safeSignOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Failed to sign out', error);
  }
}

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AuthUser['role'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const verifiedUser = await verifyUserProfile(firebaseUser);
        setUser(verifiedUser);
        setRole(verifiedUser.role);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify your maintenance account.';

        setUser(null);
        setRole(null);
        Alert.alert('Authentication error', message);
        await safeSignOut();
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const logout = async (): Promise<void> => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
