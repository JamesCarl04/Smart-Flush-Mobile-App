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

export async function apiFetch<TData>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponseEnvelope<TData>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to perform this action.');
  }

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
