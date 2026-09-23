import {
  AUTH_ERROR_MESSAGES,
  containsTechnicalDetails,
  extractAuthErrorCode,
  getSanitizedAuthErrorMessage,
  getSanitizedPasswordResetErrorMessage,
  isNetworkError,
  isUserDisabledError,
} from '../../../lib/auth-errors';

describe('auth-errors utility', () => {
  describe('extractAuthErrorCode', () => {
    it('extracts code from Firebase error object', () => {
      expect(extractAuthErrorCode({ code: 'auth/user-disabled' })).toBe(
        'auth/user-disabled',
      );
      expect(extractAuthErrorCode({ code: 'AUTH/WRONG-PASSWORD ' })).toBe(
        'auth/wrong-password',
      );
    });

    it('extracts code from formatted bracketed strings', () => {
      expect(
        extractAuthErrorCode(
          '[auth/user-disabled] The user account has been disabled by an administrator.',
        ),
      ).toBe('auth/user-disabled');
      expect(
        extractAuthErrorCode('Firebase: Error (auth/invalid-credential).'),
      ).toBe('auth/invalid-credential');
    });

    it('extracts code from Error instance', () => {
      const err = new Error(
        '[auth/too-many-requests] Access to this account has been temporarily disabled.',
      );
      expect(extractAuthErrorCode(err)).toBe('auth/too-many-requests');
    });

    it('returns null for non-code inputs', () => {
      expect(extractAuthErrorCode(null)).toBeNull();
      expect(extractAuthErrorCode(undefined)).toBeNull();
      expect(extractAuthErrorCode('Internal server failure')).toBeNull();
      expect(extractAuthErrorCode({})).toBeNull();
    });
  });

  describe('isUserDisabledError', () => {
    it('detects user-disabled from code or message patterns', () => {
      expect(isUserDisabledError({ code: 'auth/user-disabled' })).toBe(true);
      expect(
        isUserDisabledError(
          '[auth/user-disabled] The user account has been disabled by an administrator.',
        ),
      ).toBe(true);
      expect(
        isUserDisabledError(
          new Error('The user account has been disabled by an administrator.'),
        ),
      ).toBe(true);
      expect(
        isUserDisabledError(new Error('This account has been deactivated.')),
      ).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isUserDisabledError({ code: 'auth/wrong-password' })).toBe(false);
      expect(isUserDisabledError('Network offline')).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('detects network errors from code, instance, or message', () => {
      expect(isNetworkError({ code: 'auth/network-request-failed' })).toBe(
        true,
      );
      expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('Failed to fetch profile'))).toBe(true);
      expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('returns false for non-network errors', () => {
      expect(isNetworkError({ code: 'auth/user-not-found' })).toBe(false);
    });
  });

  describe('containsTechnicalDetails', () => {
    it('flags internal server URLs and error codes', () => {
      expect(
        containsTechnicalDetails('Failed to load /api/auth/me from server'),
      ).toBe(true);
      expect(
        containsTechnicalDetails('HTTP 500 Internal Server Error'),
      ).toBe(true);
      expect(containsTechnicalDetails('[auth/user-disabled]')).toBe(true);
      expect(containsTechnicalDetails('Firestore permission-denied')).toBe(
        true,
      );
    });
  });

  describe('getSanitizedAuthErrorMessage', () => {
    it('sanitizes auth/user-disabled into clear, non-technical guidance without server codes', () => {
      const rawError = new Error(
        '[auth/user-disabled] The user account has been disabled by an administrator.',
      );
      const sanitized = getSanitizedAuthErrorMessage(rawError);

      expect(sanitized).toBe(AUTH_ERROR_MESSAGES.USER_DISABLED);
      expect(sanitized).not.toContain('auth/user-disabled');
      expect(sanitized).not.toContain('[');
      expect(sanitized).toContain('supervisor or facility administrator');
    });

    it('sanitizes invalid credentials and wrong password', () => {
      expect(
        getSanitizedAuthErrorMessage({ code: 'auth/wrong-password' }),
      ).toBe(AUTH_ERROR_MESSAGES.WRONG_PASSWORD);
      expect(
        getSanitizedAuthErrorMessage({ code: 'auth/user-not-found' }),
      ).toBe(AUTH_ERROR_MESSAGES.USER_NOT_FOUND);
      expect(
        getSanitizedAuthErrorMessage({ code: 'auth/invalid-credential' }),
      ).toBe(AUTH_ERROR_MESSAGES.INVALID_CREDENTIAL);
      expect(
        getSanitizedAuthErrorMessage({ code: 'auth/too-many-requests' }),
      ).toBe(AUTH_ERROR_MESSAGES.TOO_MANY_REQUESTS);
    });

    it('sanitizes network connectivity issues', () => {
      expect(
        getSanitizedAuthErrorMessage({ code: 'auth/network-request-failed' }),
      ).toBe(AUTH_ERROR_MESSAGES.NETWORK_ERROR);
      expect(
        getSanitizedAuthErrorMessage(new TypeError('Failed to fetch')),
      ).toBe(AUTH_ERROR_MESSAGES.NETWORK_ERROR);
    });

    it('preserves access denied messages for unauthorized roles', () => {
      const err = new Error(
        'Access denied. This app is for maintenance and supervisor accounts only.',
      );
      expect(getSanitizedAuthErrorMessage(err)).toBe(
        'Access denied. This app is for maintenance and supervisor accounts only.',
      );
    });

    it('shields technical backend internal errors and 500s', () => {
      const backendError = new Error(
        'Backend authentication service unavailable at /api/auth/me (status 500)',
      );
      const sanitized = getSanitizedAuthErrorMessage(backendError);

      expect(sanitized).toBe(AUTH_ERROR_MESSAGES.DEFAULT_AUTH_ERROR);
      expect(sanitized).not.toContain('/api/');
      expect(sanitized).not.toContain('500');
      expect(sanitized).not.toContain('Backend');
    });

    it('uses custom fallback message if provided for login screen', () => {
      const unknownError = new Error('Some random client error');
      expect(
        getSanitizedAuthErrorMessage(
          unknownError,
          'Unable to log in right now. Please try again.',
        ),
      ).toBe('Unable to log in right now. Please try again.');
    });

    it('sanitizes plain object errors without Error instances', () => {
      const plainObj = {
        message: 'The user account has been disabled by an administrator.',
      };
      expect(getSanitizedAuthErrorMessage(plainObj)).toBe(
        AUTH_ERROR_MESSAGES.USER_DISABLED,
      );

      const plainObjWithNestedCode = {
        error: { code: 'auth/invalid-credential', message: 'Bad credentials' },
      };
      expect(getSanitizedAuthErrorMessage(plainObjWithNestedCode)).toBe(
        AUTH_ERROR_MESSAGES.INVALID_CREDENTIAL,
      );
    });

    it('sanitizes fallback message if fallback itself contains technical details', () => {
      const error = new Error('Something happened');
      expect(
        getSanitizedAuthErrorMessage(
          error,
          'Failed at /api/auth/me 500 server error',
        ),
      ).toBe(AUTH_ERROR_MESSAGES.DEFAULT_AUTH_ERROR);
    });
  });

  describe('getSanitizedPasswordResetErrorMessage', () => {
    it('handles user-disabled during password reset', () => {
      expect(
        getSanitizedPasswordResetErrorMessage({ code: 'auth/user-disabled' }),
      ).toBe(AUTH_ERROR_MESSAGES.USER_DISABLED);
    });

    it('handles invalid email and user not found', () => {
      expect(
        getSanitizedPasswordResetErrorMessage({ code: 'auth/invalid-email' }),
      ).toBe(AUTH_ERROR_MESSAGES.RESET_INVALID_EMAIL);
      expect(
        getSanitizedPasswordResetErrorMessage({ code: 'auth/user-not-found' }),
      ).toBe(AUTH_ERROR_MESSAGES.RESET_USER_NOT_FOUND);
    });

    it('returns default safe message for unknown error', () => {
      expect(
        getSanitizedPasswordResetErrorMessage(new Error('Internal error')),
      ).toBe(AUTH_ERROR_MESSAGES.DEFAULT_RESET_ERROR);
    });
  });

  describe('isTransientAuthError', () => {
    const { isTransientAuthError } = require('../../../lib/auth-errors');

    it('identifies unauthenticated and signed-in messages as transient auth errors', () => {
      expect(
        isTransientAuthError(
          new Error('You must be signed in to perform this action.'),
        ),
      ).toBe(true);
      expect(
        isTransientAuthError(
          new Error('You must be signed in to complete this task.'),
        ),
      ).toBe(true);
      expect(
        isTransientAuthError({ message: 'User must be signed in' }),
      ).toBe(true);
      expect(
        isTransientAuthError({ code: 'auth/no-current-user' }),
      ).toBe(true);
      expect(
        isTransientAuthError('[auth/no-current-user] Not authenticated'),
      ).toBe(true);
    });

    it('returns false for non-auth errors', () => {
      expect(isTransientAuthError(new Error('Network connection failed'))).toBe(false);
      expect(isTransientAuthError(new Error('Internal server error'))).toBe(false);
      expect(isTransientAuthError(null)).toBe(false);
      expect(isTransientAuthError(undefined)).toBe(false);
    });
  });
});
