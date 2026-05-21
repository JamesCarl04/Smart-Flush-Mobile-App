import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  Button,
  Card,
  HelperText,
  Text,
  TextInput,
} from 'react-native-paper';

import { auth } from '../lib/firebase';
import type { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

function getResetErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code === 'auth/invalid-email') {
    return 'Enter a valid email address before requesting a password reset.';
  }

  return 'We could not send the reset email right now. Please try again.';
}

export function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendResetLink = async (): Promise<void> => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setIsError(true);
      setMessage('Email is required.');
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setMessage(null);
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (error) {
      setIsError(true);
      setMessage(getResetErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="headlineMedium" style={styles.title}>
              Reset Password
            </Text>
            <Text variant="bodyLarge" style={styles.description}>
              Enter your email and we'll send you instructions to reset your
              password.
            </Text>

            <TextInput
              label="Email"
              value={email}
              mode="outlined"
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={isLoading}
              onChangeText={setEmail}
              outlineStyle={styles.inputOutline}
              contentStyle={styles.inputContent}
            />

            <HelperText type={isError ? 'error' : 'info'} visible={!!message}>
              {message ?? ''}
            </HelperText>

            <Button
              mode="contained"
              loading={isLoading}
              disabled={isLoading}
              onPress={() => {
                void handleSendResetLink();
              }}
              contentStyle={styles.primaryButtonContent}
              style={styles.primaryButton}
            >
              Send Reset Link
            </Button>

            <Button
              mode="text"
              disabled={isLoading}
              onPress={() => navigation.goBack()}
              labelStyle={styles.backButtonLabel}
            >
              Back to Login
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef8f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 44,
    gap: 20,
  },
  title: {
    textAlign: 'center',
    color: '#0f1f1b',
    fontWeight: '800',
  },
  description: {
    textAlign: 'center',
    color: '#556561',
    lineHeight: 25,
    marginBottom: 8,
  },
  inputOutline: {
    borderRadius: 10,
  },
  inputContent: {
    minHeight: 58,
    fontSize: 18,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#127369',
  },
  primaryButtonContent: {
    minHeight: 60,
  },
  backButtonLabel: {
    color: '#127369',
    fontSize: 16,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
