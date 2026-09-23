/**
 * Utility for sanitizing authentication errors across Klir Mobile App.
 *
 * Prevents information disclosure (Firebase error codes like [auth/user-disabled],
 * backend endpoints like /api/auth/me, server stack traces, database details).
 * Transforms technical errors into user-friendly, non-technical instructions.
 */

export const AUTH_ERROR_MESSAGES = {
  USER_DISABLED:
    'Your account has been deactivated or disabled. Please contact your supervisor or facility administrator.',
  WRONG_PASSWORD: 'Incorrect password. Please try again.',
  USER_NOT_FOUND: 'No account was found for that email address.',
  INVALID_CREDENTIAL: 'The email or password you entered is invalid.',
  TOO_MANY_REQUESTS: 'Too many login attempts. Please try again later.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  RESET_INVALID_EMAIL:
    'Enter a valid email address before requesting a password reset.',
  RESET_USER_NOT_FOUND: 'No account was found for that email address.',
  NETWORK_ERROR:
    'Network connection failed. Please check your internet connection and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  ROLE_DENIED:
    'Access denied. This app is for maintenance and supervisor accounts only.',
  DEFAULT_AUTH_ERROR:
    'Unable to verify your account right now. Please try again later or contact your supervisor.',
  DEFAULT_LOGIN_ERROR: 'Unable to log in right now. Please try again.',
  DEFAULT_RESET_ERROR:
    'We could not send the reset email right now. Please try again.',
} as const;

/**
 * Safely extracts error message string from strings, Error instances, or plain error objects.
 */
export function extractRawErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    if (
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    if (
      'error' in error &&
      typeof (error as { error?: unknown }).error === 'string'
    ) {
      return (error as { error: string }).error;
    }
    if (
      'error' in error &&
      typeof (error as { error?: unknown }).error === 'object' &&
      (error as { error?: unknown }).error !== null &&
      'message' in (error as { error: { message?: unknown } }).error &&
      typeof (error as { error: { message?: unknown } }).error.message === 'string'
    ) {
      return (error as { error: { message: string } }).error.message;
    }
  }
  return '';
}

/**
 * Extracts error code string if present in code property or formatted in error message.
 */
export function extractAuthErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof (error as { code?: unknown }).code === 'string') {
      return (error as { code: string }).code.toLowerCase().trim();
    }
    if (
      'error' in error &&
      typeof (error as { error?: unknown }).error === 'object' &&
      (error as { error?: unknown }).error !== null &&
      'code' in (error as { error: { code?: unknown } }).error &&
      typeof (error as { error: { code?: unknown } }).error.code === 'string'
    ) {
      return (error as { error: { code: string } }).error.code.toLowerCase().trim();
    }
  }

  const rawString = extractRawErrorMessage(error);
  if (rawString) {
    const match = rawString.match(/\[?(auth\/[a-z0-9-]+)\]?/i);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

/**
 * Checks whether an error is specifically related to a disabled/deactivated user account.
 */
export function isUserDisabledError(error: unknown): boolean {
  const code = extractAuthErrorCode(error);
  if (code === 'auth/user-disabled') {
    return true;
  }

  const message = extractRawErrorMessage(error).toLowerCase();

  return (
    message.includes('user-disabled') ||
    message.includes('account has been disabled') ||
    message.includes('account has been deactivated') ||
    message.includes('user account is disabled') ||
    message.includes('user is disabled') ||
    message.includes('user disabled') ||
    message.includes('account disabled') ||
    message.includes('account deactivated')
  );
}

/**
 * Checks whether an error indicates a network or connectivity issue.
 */
export function isNetworkError(error: unknown): boolean {
  const code = extractAuthErrorCode(error);
  if (code === 'auth/network-request-failed') {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const message = extractRawErrorMessage(error).toLowerCase();

  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('connection refused') ||
    message.includes('econnrefused') ||
    message.includes('network error') ||
    message.includes('offline')
  );
}

/**
 * Checks whether an error contains server/backend details or code leaks that must be hidden.
 */
export function containsTechnicalDetails(error: unknown): boolean {
  const message = extractRawErrorMessage(error).toLowerCase();

  return (
    message.includes('/api/') ||
    message.includes('http://') ||
    message.includes('https://') ||
    message.includes('500') ||
    message.includes('backend') ||
    message.includes('server') ||
    message.includes('firestore') ||
    message.includes('firebase') ||
    message.includes('database') ||
    message.includes('sql') ||
    message.includes('internal') ||
    message.includes('stack') ||
    message.includes('[auth/')
  );
}

/**
 * Sanitizes auth error messages to prevent exposing backend architecture,
 * endpoints, or Firebase error codes while providing clear, friendly instructions.
 */
export function getSanitizedAuthErrorMessage(
  error: unknown,
  fallbackMessage: string = AUTH_ERROR_MESSAGES.DEFAULT_AUTH_ERROR,
): string {
  if (isUserDisabledError(error)) {
    return AUTH_ERROR_MESSAGES.USER_DISABLED;
  }

  const code = extractAuthErrorCode(error);

  if (code === 'auth/wrong-password') {
    return AUTH_ERROR_MESSAGES.WRONG_PASSWORD;
  }

  if (code === 'auth/user-not-found') {
    return AUTH_ERROR_MESSAGES.USER_NOT_FOUND;
  }

  if (code === 'auth/invalid-credential') {
    return AUTH_ERROR_MESSAGES.INVALID_CREDENTIAL;
  }

  if (code === 'auth/too-many-requests') {
    return AUTH_ERROR_MESSAGES.TOO_MANY_REQUESTS;
  }

  if (code === 'auth/invalid-email') {
    return AUTH_ERROR_MESSAGES.INVALID_EMAIL;
  }

  if (
    code === 'auth/requires-recent-login' ||
    code === 'auth/user-token-expired' ||
    code === 'auth/id-token-expired' ||
    code === 'auth/id-token-revoked'
  ) {
    return AUTH_ERROR_MESSAGES.SESSION_EXPIRED;
  }

  if (isNetworkError(error)) {
    return AUTH_ERROR_MESSAGES.NETWORK_ERROR;
  }

  const message = extractRawErrorMessage(error);

  // Preserve authorized role denial message
  if (
    message.includes('Access denied') ||
    message.includes('maintenance and supervisor accounts only')
  ) {
    return AUTH_ERROR_MESSAGES.ROLE_DENIED;
  }

  if (
    message.includes('session has expired') ||
    message.includes('token has expired')
  ) {
    return AUTH_ERROR_MESSAGES.SESSION_EXPIRED;
  }

  // Ensure fallback message does not leak technical details
  if (containsTechnicalDetails(fallbackMessage)) {
    return AUTH_ERROR_MESSAGES.DEFAULT_AUTH_ERROR;
  }

  // Any raw server message or technical error must not leak
  return fallbackMessage;
}

/**
 * Sanitizes password reset error messages.
 */
export function getSanitizedPasswordResetErrorMessage(error: unknown): string {
  if (isUserDisabledError(error)) {
    return AUTH_ERROR_MESSAGES.USER_DISABLED;
  }

  const code = extractAuthErrorCode(error);

  if (code === 'auth/invalid-email') {
    return AUTH_ERROR_MESSAGES.RESET_INVALID_EMAIL;
  }

  if (code === 'auth/user-not-found') {
    return AUTH_ERROR_MESSAGES.RESET_USER_NOT_FOUND;
  }

  if (isNetworkError(error)) {
    return AUTH_ERROR_MESSAGES.NETWORK_ERROR;
  }

  return AUTH_ERROR_MESSAGES.DEFAULT_RESET_ERROR;
}

/**
 * Checks whether an error is a transient auth initialization error
 * (e.g. session not yet restored from device keystore on cold boot).
 */
export function isTransientAuthError(error: unknown): boolean {
  const code = extractAuthErrorCode(error);
  if (code === 'auth/no-current-user') {
    return true;
  }
  const message = extractRawErrorMessage(error).toLowerCase();
  return (
    message.includes('must be signed in') ||
    message.includes('you must be signed in') ||
    message.includes('auth/no-current-user') ||
    message.includes('not authenticated')
  );
}
