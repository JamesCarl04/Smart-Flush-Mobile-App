import { onAuthStateChanged } from '@react-native-firebase/auth';
import { auth } from './firebase';
import { getRequiredConfigValue, runtimeConfig } from './config';

interface ApiResponseEnvelope<TData> {
  success: boolean;
  data?: TData;
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

function getResponseError(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }
  }

  return fallback;
}

let pendingAuthResolution: Promise<NonNullable<typeof auth.currentUser>> | null = null;

export async function resolveAuthenticatedUser(
  timeoutMs = 2000,
): Promise<NonNullable<typeof auth.currentUser>> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (timeoutMs === 2000 && pendingAuthResolution) {
    return pendingAuthResolution;
  }

  const promise = new Promise<NonNullable<typeof auth.currentUser>>(
    (resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (unsubscribe) {
          try {
            unsubscribe();
          } catch {
            // ignore unsubscribe failure
          }
          unsubscribe = null;
        }
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        if (auth.currentUser) {
          resolve(auth.currentUser);
        } else {
          reject(new Error('You must be signed in to perform this action.'));
        }
      }, timeoutMs);

      try {
        const listener = (user: any) => {
          if (settled) return;
          if (user) {
            settled = true;
            cleanup();
            resolve(user);
          } else {
            settled = true;
            cleanup();
            reject(new Error('You must be signed in to perform this action.'));
          }
        };

        if (typeof (auth as any)?.onAuthStateChanged === 'function') {
          unsubscribe = (auth as any).onAuthStateChanged(listener);
        } else {
          unsubscribe = onAuthStateChanged(auth, listener);
        }
      } catch {
        if (!settled) {
          settled = true;
          cleanup();
          if (auth.currentUser) {
            resolve(auth.currentUser);
          } else {
            reject(new Error('You must be signed in to perform this action.'));
          }
        }
      }
    },
  );

  if (timeoutMs === 2000) {
    pendingAuthResolution = promise;
  }

  promise
    .catch(() => {})
    .finally(() => {
      if (pendingAuthResolution === promise) {
        pendingAuthResolution = null;
      }
    });

  return promise;
}

export function _resetPendingAuthResolutionForTesting(): void {
  pendingAuthResolution = null;
}

export const waitForAuthUser = resolveAuthenticatedUser;

export async function apiFetch<TData>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponseEnvelope<TData>> {
  const currentUser = await resolveAuthenticatedUser();

  const request = async (forceRefresh = false) => {
    const idToken = await currentUser.getIdToken(forceRefresh);
    return fetch(buildApiUrl(path), {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });
  };

  let response = await request();

  if (response.status === 401) {
    response = await request(true);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getResponseError(payload, `Request failed with status ${response.status}`),
    );
  }

  if (typeof payload !== 'object' || payload === null) {
    throw new Error('The server returned an invalid response.');
  }

  return payload as ApiResponseEnvelope<TData>;
}
