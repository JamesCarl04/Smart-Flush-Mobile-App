import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import * as FirebaseAuth from '@react-native-firebase/auth';
import { FirebaseError } from 'firebase/app';

import { ForgotPasswordScreen } from '../../../screens/ForgotPasswordScreen';

describe('ForgotPasswordScreen', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute: any = {
    key: 'ForgotPassword',
    name: 'ForgotPassword',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderScreen = () => {
    return render(
      <PaperProvider>
        <ForgotPasswordScreen navigation={mockNavigation} route={mockRoute} />
      </PaperProvider>,
    );
  };

  it('validates empty email before submitting', async () => {
    renderScreen();

    const sendButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required.')).toBeTruthy();
    });
  });

  it('displays sanitized message for disabled accounts without leaking error code', async () => {
    const disabledError = new FirebaseError(
      'auth/user-disabled',
      '[auth/user-disabled] The user account has been disabled by an administrator.',
    );
    (FirebaseAuth.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
      disabledError,
    );

    renderScreen();

    const input = screen.getByPlaceholderText('tech@smartflush.com');
    fireEvent.changeText(input, 'disabled@smartflush.com');

    const sendButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Your account has been deactivated or disabled. Please contact your supervisor or facility administrator.',
        ),
      ).toBeTruthy();
    });
  });

  it('displays user-friendly message for invalid email', async () => {
    const invalidEmailError = new FirebaseError(
      'auth/invalid-email',
      'Firebase: Error (auth/invalid-email).',
    );
    (FirebaseAuth.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
      invalidEmailError,
    );

    renderScreen();

    const input = screen.getByPlaceholderText('tech@smartflush.com');
    fireEvent.changeText(input, 'invalid-email');

    const sendButton = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.press(sendButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Enter a valid email address before requesting a password reset.',
        ),
      ).toBeTruthy();
    });
  });
});
