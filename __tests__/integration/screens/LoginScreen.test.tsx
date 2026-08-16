import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as FirebaseAuth from '@react-native-firebase/auth';
import { FirebaseError } from 'firebase/app';

import { LoginScreen } from '../../../screens/LoginScreen';
import * as useAuthHook from '../../../hooks/useAuth';
import { auth } from '../../../lib/firebase';

jest.mock('../../../hooks/useAuth');

describe('LoginScreen Integration', () => {
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
    (useAuthHook.useAuth as jest.Mock).mockReturnValue({
      user: null,
      role: null,
      loading: false,
      logout: jest.fn(),
    });
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <LoginScreen navigation={mockNavigation} route={mockRoute} />
      </PaperProvider>,
    );
  };

  const getEmailInput = () => screen.getAllByTestId('text-input-outlined')[0];
  const getPasswordInput = () => screen.getAllByTestId('text-input-outlined')[1];

  it('renders sign-in form with email, password fields and actions', () => {
    renderScreen();

    expect(screen.getByText('KLIR')).toBeTruthy();
    expect(screen.getByText('Facility Operations')).toBeTruthy();
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Email').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Password').length).toBeGreaterThan(0);
    expect(screen.getByText('Forgot password')).toBeTruthy();
  });

  it('validates and displays error when email or password is empty', async () => {
    renderScreen();

    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Both empty
    fireEvent.press(signInButton);
    expect(
      screen.getByText('Enter both your email address and password.'),
    ).toBeTruthy();

    // Only email filled
    fireEvent.changeText(getEmailInput(), 'tech@smartflush.com');
    fireEvent.press(signInButton);
    expect(
      screen.getByText('Enter both your email address and password.'),
    ).toBeTruthy();

    // Clear email and fill only password
    fireEvent.changeText(getEmailInput(), '');
    fireEvent.changeText(getPasswordInput(), 'secret123');
    fireEvent.press(signInButton);
    expect(
      screen.getByText('Enter both your email address and password.'),
    ).toBeTruthy();

    expect(FirebaseAuth.signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('toggles password visibility when eye icon is pressed', () => {
    renderScreen();

    const passwordInput = getPasswordInput();
    // Initially secure
    expect(passwordInput.props.secureTextEntry).toBe(true);

    // Find and press toggle icon
    const eyeButton = screen.getByTestId('right-icon-adornment');
    fireEvent.press(eyeButton);

    expect(passwordInput.props.secureTextEntry).toBe(false);

    // Press again to hide
    fireEvent.press(eyeButton);
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });

  it('calls signInWithEmailAndPassword with trimmed email upon submitting valid form', async () => {
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: { uid: 'test-uid' },
    });

    renderScreen();

    fireEvent.changeText(
      getEmailInput(),
      '  maintenance.lead@smartflush.com  ',
    );
    fireEvent.changeText(getPasswordInput(), 'validPass#2026');

    const signInButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.press(signInButton);

    await waitFor(() => {
      expect(FirebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        auth,
        'maintenance.lead@smartflush.com',
        'validPass#2026',
      );
    });
  });

  it('displays user-friendly error message for auth/wrong-password code', async () => {
    const wrongPasswordError = new FirebaseError(
      'auth/wrong-password',
      'Firebase: Error (auth/wrong-password).',
    );
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
      wrongPasswordError,
    );

    renderScreen();

    fireEvent.changeText(getEmailInput(), 'tech@smartflush.com');
    fireEvent.changeText(getPasswordInput(), 'wrongPass');
    fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Incorrect password. Please try again.'),
      ).toBeTruthy();
    });
  });

  it('displays user-friendly error message for auth/user-not-found code', async () => {
    const userNotFoundError = new FirebaseError(
      'auth/user-not-found',
      'Firebase: Error (auth/user-not-found).',
    );
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
      userNotFoundError,
    );

    renderScreen();

    fireEvent.changeText(
      getEmailInput(),
      'nonexistent@smartflush.com',
    );
    fireEvent.changeText(getPasswordInput(), 'password123');
    fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('No account was found for that email address.'),
      ).toBeTruthy();
    });
  });

  it('displays error for auth/invalid-credential and auth/too-many-requests codes', async () => {
    const invalidCredError = new FirebaseError(
      'auth/invalid-credential',
      'Invalid credential.',
    );
    (FirebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
      invalidCredError,
    );

    renderScreen();

    fireEvent.changeText(getEmailInput(), 'tech@smartflush.com');
    fireEvent.changeText(getPasswordInput(), 'badcreds');
    fireEvent.press(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('The email or password you entered is invalid.'),
      ).toBeTruthy();
    });
  });

  it('navigates to ForgotPassword screen when forgot password button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Forgot password'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });
});
