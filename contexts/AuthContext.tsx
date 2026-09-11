import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signOut } from '@react-native-firebase/auth';

import { getRequiredConfigValue, runtimeConfig } from '../lib/config';
import { auth } from '../lib/firebase';
import { unregisterPushNotificationsAsync } from '../lib/notifications';
import { logAuthAudit } from '../lib/audit-logger';
import type { AuthContextValue, AuthUser, UserRole } from '../types';

export const USER_PROFILE_CACHE_KEY = '@klir:cached_user_profile';

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
    shift?: unknown;
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

  if (roleString !== 'maintenance' && roleString !== 'technician' && roleString !== 'supervisor') {
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
    shift:
      typeof payload.data?.shift === 'string' ? payload.data.shift : null,
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
    let isMounted = true;

    // 1. Fast profile hydration from local storage for 0ms initial load
    (async () => {
      try {
        const cachedRaw = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
        if (cachedRaw && isMounted) {
          const cachedUser = JSON.parse(cachedRaw) as AuthUser;
          if (cachedUser?.uid && cachedUser?.role) {
            setUser((prev) => prev ?? cachedUser);
            setRole((prev) => prev ?? cachedUser.role);
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Error hydrating cached user profile:', err);
      }
    })();

    // 2. Stale-while-revalidate listener with Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        if (isMounted) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        void AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY).catch(() => {});
        return;
      }

      try {
        const verifiedUser = await verifyUserProfile(firebaseUser);
        if (isMounted) {
          setUser(verifiedUser);
          setRole(verifiedUser.role);
          setLoading(false);
        }
        void AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(verifiedUser)).catch((storageErr) => {
          console.warn('[AuthContext] Failed to cache user profile:', storageErr);
        });
        void logAuthAudit('AUTH_LOGIN', verifiedUser);
      } catch (error) {
        // If the error is network/offline related and we have a cached profile for this user, do not force logout
        let hasValidCachedUser = false;
        try {
          const cachedRaw = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw) as AuthUser;
            if (parsed?.uid === firebaseUser.uid && parsed?.role) {
              hasValidCachedUser = true;
              if (isMounted) {
                setUser((prev) => prev ?? parsed);
                setRole((prev) => prev ?? parsed.role);
                setLoading(false);
              }
            }
          }
        } catch {
          // ignore cache read error
        }

        const isNetworkError =
          error instanceof TypeError ||
          (error instanceof Error &&
            (error.message.includes('Network') ||
              error.message.includes('network') ||
              error.message.includes('Failed to fetch') ||
              error.message.includes('timeout')));

        if (hasValidCachedUser && isNetworkError) {
          console.warn('[AuthContext] Network offline/unavailable during revalidation; preserving cached profile.');
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to verify your maintenance account.';

        if (isMounted) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        void AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY).catch(() => {});
        Alert.alert('Authentication error', message);
        await safeSignOut();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const logout = async (): Promise<void> => {
    const prevUser = user;

    // 1. Optimistically reset user and role immediately for 0ms screen/navbar transition
    setUser(null);
    setRole(null);
    setLoading(false);

    // 2. Invalidate cached profile
    void AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY).catch((err) => {
      console.warn('[AuthContext] Error clearing user profile cache on logout:', err);
    });

    // 3. Log auth logout audit trail
    if (prevUser) {
      void logAuthAudit('AUTH_LOGOUT', prevUser);
    }

    // 4. Background push token unregistration with bounded 1500ms timeout
    const unregisterPushTask = Promise.race([
      unregisterPushNotificationsAsync(),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]).catch((error) => {
      console.warn('[AuthContext] Error or timeout unregistering push notifications on logout:', error);
    });

    // 5. Firebase signOut
    try {
      await Promise.allSettled([unregisterPushTask, signOut(auth)]);
    } catch (signOutError) {
      console.warn('[AuthContext] Failed to sign out:', signOutError);
    }
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
