import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from '@react-native-firebase/auth';

import { LoginScreen } from '../../screens/LoginScreen';
import * as useAuthHook from '../../hooks/useAuth';

jest.mock('../../hooks/useAuth');
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

describe('LoginScreen Dual-Biometric Adaptive Detection', () => {
  const originalPlatformOS = Platform.OS;
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    key: 'Login',
    name: 'Login',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatformOS,
      configurable: true,
    });
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: null,
      role: null,
      loading: false,
      logout: jest.fn(),
    });
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      get: () => originalPlatformOS,
      configurable: true,
    });
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <LoginScreen navigation={mockNavigation} route={mockRoute} />
      </PaperProvider>,
    );
  };

  it('renders "Unlock with biometrics" with "shield-account" icon when both are enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
      expect(screen.getByTestId('icon-shield-account')).toBeTruthy();
    });
  });

  it('renders "Unlock with biometrics" on iOS with "face-recognition" icon when only face is enrolled', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
      expect(screen.getByTestId('icon-face-recognition')).toBeTruthy();
    });
  });

  it('renders "Unlock with biometrics" on Android with "face-recognition" icon when only face is enrolled', async () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
      expect(screen.getByTestId('icon-face-recognition')).toBeTruthy();
    });
  });

  it('renders "Unlock with biometrics" with "fingerprint" icon when only fingerprint is enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
      expect(screen.getByTestId('icon-fingerprint')).toBeTruthy();
    });
  });

  it('renders "Unlock with biometrics" when credentials are vault-cached', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(
      JSON.stringify({ email: 'tech@sdca.edu.ph', password: 'password123' }),
    );

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
      expect(screen.getByTestId('icon-shield-account')).toBeTruthy();
    });
  });

  it('hides biometric button when hardware exists but biometrics are not enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

    renderScreen();

    await waitFor(() => {
      expect(screen.queryByText('Unlock with biometrics')).toBeNull();
      expect(screen.queryByTestId('icon-shield-account')).toBeNull();
      expect(screen.queryByTestId('icon-fingerprint')).toBeNull();
    });
  });

  it('hides biometric button when hardware only supports unhandled types such as IRIS', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.IRIS,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.queryByText('Unlock with biometrics')).toBeNull();
      expect(screen.queryByTestId('icon-shield-account')).toBeNull();
      expect(screen.queryByTestId('icon-fingerprint')).toBeNull();
    });
  });

  it('hides biometric button when no biometric hardware or enrollment exists', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);

    renderScreen();

    await waitFor(() => {
      expect(screen.queryByText('Unlock with biometrics')).toBeNull();
      expect(screen.queryByTestId('icon-shield-account')).toBeNull();
      expect(screen.queryByTestId('icon-fingerprint')).toBeNull();
    });
  });

  it('authenticates and logs in with vault credentials upon clicking biometric button', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(
      JSON.stringify({ email: 'lead.tech@sdca.edu.ph', password: 'vaultPassword123' }),
    );

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: true,
    });
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: { uid: 'vault-uid' },
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Unlock with biometrics'));

    await waitFor(() => {
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          promptMessage: 'Verify identity to unlock Klir Facility Ops',
          fallbackLabel: 'Use Password',
        }),
      );
      expect(FirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'lead.tech@sdca.edu.ph',
        'vaultPassword123',
      );
    });
  });

  it('prompts user to log in manually if biometric button is tapped without saved vault credentials', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Unlock with biometrics'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Please log in with your email and password first to enable biometric login.',
        ),
      ).toBeTruthy();
    });
  });

  it('displays user-friendly sanitized error when account is disabled during biometric login', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(
      JSON.stringify({ email: 'disabled.tech@sdca.edu.ph', password: 'vaultPassword123' }),
    );

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: true,
    });
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
      new Error('[auth/user-disabled] The user account has been disabled by an administrator.'),
    );

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Unlock with biometrics'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Your account has been deactivated or disabled. Please contact your supervisor or facility administrator.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/auth\/user-disabled/)).toBeNull();
    });
  });

  it('displays lockout guidance when biometric scanner returns lockout error', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(
      JSON.stringify({ email: 'locked.tech@sdca.edu.ph', password: 'vaultPassword123' }),
    );

    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValue([
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ]);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'lockout',
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText('Unlock with biometrics')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Unlock with biometrics'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Too many failed biometric attempts. Please log in with your password.',
        ),
      ).toBeTruthy();
    });
  });
});
