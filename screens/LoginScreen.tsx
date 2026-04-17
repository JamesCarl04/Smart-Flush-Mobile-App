import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FirebaseError } from 'firebase/app';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  HelperText,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';

import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/wrong-password') {
      return 'Incorrect password. Please try again.';
    }

    if (error.code === 'auth/user-not-found') {
      return 'No account was found for that email address.';
    }

    if (error.code === 'auth/too-many-requests') {
      return 'Too many login attempts. Please try again later.';
    }

    if (error.code === 'auth/invalid-credential') {
      return 'The email or password you entered is invalid.';
    }
  }

  return 'Unable to sign in right now. Please try again.';
}

function getResetErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError && error.code === 'auth/invalid-email') {
    return 'Enter a valid email address before requesting a password reset.';
  }

  return 'We could not send the reset email right now. Please try again.';
}

export function LoginScreen(): React.JSX.Element {
  const { loading, role, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [awaitingRoleValidation, setAwaitingRoleValidation] = useState(false);

  useEffect(() => {
    if (!awaitingRoleValidation || loading) {
      return;
    }

    if (user && role === 'maintenance') {
      setSubmitting(false);
      setAwaitingRoleValidation(false);
      setErrorMessage(null);
      return;
    }

    if (!user) {
      setSubmitting(false);
      setAwaitingRoleValidation(false);
      setErrorMessage(
        'Access denied. This app is for maintenance personnel only.',
      );
    }
  }, [awaitingRoleValidation, loading, role, user]);

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password) {
      setErrorMessage('Enter both your email address and password.');
      return;
    }

    try {
      setErrorMessage(null);
      setSubmitting(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setAwaitingRoleValidation(true);
    } catch (error) {
      setSubmitting(false);
      setAwaitingRoleValidation(false);
      setErrorMessage(getLoginErrorMessage(error));
    }
  };

  const handleForgotPassword = async (): Promise<void> => {
    if (!email.trim()) {
      setErrorMessage(
        'Enter your email address first so we know where to send the reset link.',
      );
      return;
    }

    try {
      setErrorMessage(null);
      setResettingPassword(true);
      await sendPasswordResetEmail(auth, email.trim());
      setErrorMessage('Password reset email sent. Please check your inbox.');
    } catch (error) {
      setErrorMessage(getResetErrorMessage(error));
    } finally {
      setResettingPassword(false);
    }
  };

  const isBusy = submitting || (awaitingRoleValidation && loading);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Surface style={styles.heroBlock} elevation={0}>
          <Avatar.Icon
            size={72}
            icon="wrench-clock"
            style={styles.heroIcon}
          />
          <Text variant="headlineMedium" style={styles.heroTitle}>
            Klir Mobile
          </Text>
          <Text variant="bodyLarge" style={styles.heroSubtitle}>
            Smart Toilet maintenance personnel login
          </Text>
        </Surface>

        <Card mode="elevated" style={styles.formCard}>
          <Card.Content style={styles.formContent}>
            <View style={styles.headingBlock}>
              <Text variant="titleLarge">Sign in</Text>
              <Text variant="bodyMedium" style={styles.headingDescription}>
                Use your maintenance account to access live cleaning and repair
                tasks.
              </Text>
            </View>

            <TextInput
              label="Email"
              value={email}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={isBusy}
              onChangeText={setEmail}
            />

            <TextInput
              label="Password"
              value={password}
              mode="outlined"
              secureTextEntry
              disabled={isBusy}
              onChangeText={setPassword}
            />

            <HelperText type={errorMessage ? 'error' : 'info'} visible>
              {errorMessage ??
                'Only maintenance personnel accounts can continue beyond this screen.'}
            </HelperText>

            <Button
              mode="contained"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => {
                void handleLogin();
              }}
              contentStyle={styles.buttonContent}
            >
              Sign in
            </Button>

            <Button
              mode="text"
              disabled={resettingPassword}
              onPress={() => {
                void handleForgotPassword();
              }}
            >
              Forgot password
            </Button>

            {resettingPassword ? (
              <View style={styles.resetIndicator}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall">Sending reset email...</Text>
              </View>
            ) : null}
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
    paddingHorizontal: 20,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 24,
  },
  heroBlock: {
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  heroIcon: {
    backgroundColor: '#d5f1eb',
  },
  heroTitle: {
    color: '#0f1f1b',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#556561',
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 28,
  },
  formContent: {
    gap: 16,
    paddingVertical: 8,
  },
  headingBlock: {
    gap: 6,
  },
  headingDescription: {
    color: '#5d6a67',
  },
  buttonContent: {
    paddingVertical: 6,
  },
  resetIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
});
