import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword } from '@react-native-firebase/auth';
import {
  Avatar,
  Button,
  Card,
  HelperText,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';

import { UI_COLORS, sharedShadow } from '../components/MaintenanceUI';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import type { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

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

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { loading, role, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingRoleValidation, setAwaitingRoleValidation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
        'Access denied. This app is for maintenance and supervisor accounts only.',
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
            Smart Flush Field
          </Text>
          <Text variant="bodyLarge" style={styles.heroSubtitle}>
            Sanitation maintenance work orders and proof-based completion
          </Text>
        </Surface>

        <Card mode="elevated" style={styles.formCard}>
          <Card.Content style={styles.formContent}>
            <View style={styles.headingBlock}>
              <Text variant="titleLarge" style={styles.formTitle}>
                Sign in
              </Text>
              <Text variant="bodyMedium" style={styles.headingDescription}>
                Use your maintenance or supervisor account to access task
                operations.
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
              secureTextEntry={!showPassword}
              disabled={isBusy}
              onChangeText={setPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword((current) => !current)}
                />
              }
            />

            <HelperText type={errorMessage ? 'error' : 'info'} visible>
              {errorMessage ??
                'Only maintenance and supervisor accounts can continue beyond this screen.'}
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
              disabled={isBusy}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              Forgot password
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
    backgroundColor: UI_COLORS.background,
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
    backgroundColor: '#CCFBF1',
  },
  heroTitle: {
    color: UI_COLORS.text,
    textAlign: 'center',
    fontWeight: '900',
  },
  heroSubtitle: {
    color: UI_COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  formCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 22,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  formContent: {
    gap: 16,
    paddingVertical: 8,
  },
  headingBlock: {
    gap: 6,
  },
  formTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  headingDescription: {
    color: UI_COLORS.muted,
    lineHeight: 22,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
