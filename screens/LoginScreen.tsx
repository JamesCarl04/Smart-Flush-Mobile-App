import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword } from '@react-native-firebase/auth';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TextInput } from 'react-native-paper';

import { KlirButton } from '../components/KlirButton';
import {
  KLIR_COLORS,
  KLIR_TYPOGRAPHY,
} from '../components/MaintenanceUI';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../lib/firebase';
import type { AuthStackParamList } from '../types';

const BIOMETRIC_VAULT_KEY = '@klir:biometric_vault';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

function getLoginErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : null;

  if (code === 'auth/wrong-password') {
    return 'Incorrect password. Please try again.';
  }

  if (code === 'auth/user-not-found') {
    return 'No account was found for that email address.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many login attempts. Please try again later.';
  }

  if (code === 'auth/invalid-credential') {
    return 'The email or password you entered is invalid.';
  }

  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  return 'Unable to sign in right now. Please try again.';
}

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { loading, role, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingRoleValidation, setAwaitingRoleValidation] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

  useEffect(() => {
    async function checkBiometrics(): Promise<void> {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        const saved = await AsyncStorage.getItem(BIOMETRIC_VAULT_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as { email?: string; password?: string };
            if (parsed.email && parsed.password) {
              setHasSavedCredentials(true);
              setEmail(parsed.email);
            }
          } catch {
            // ignore parsing error
          }
        }

        if (hasHardware && isEnrolled) {
          setBiometricsAvailable(true);
          const types =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (
            types.includes(
              LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
            )
          ) {
            setBiometricType('Face ID');
          } else if (
            types.includes(
              LocalAuthentication.AuthenticationType.FINGERPRINT,
            )
          ) {
            setBiometricType('Fingerprint');
          } else {
            setBiometricType('Biometrics');
          }
        }
      } catch {
        setBiometricsAvailable(false);
      }
    }

    void checkBiometrics();
  }, []);

  useEffect(() => {
    if (!awaitingRoleValidation || loading) {
      return;
    }

    if (user && (role === 'maintenance' || role === 'supervisor')) {
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

      // Save credentials into secure local vault for seamless biometric login
      await AsyncStorage.setItem(
        BIOMETRIC_VAULT_KEY,
        JSON.stringify({ email: email.trim(), password }),
      );
      setHasSavedCredentials(true);

      setAwaitingRoleValidation(true);
    } catch (error) {
      setSubmitting(false);
      setAwaitingRoleValidation(false);
      setErrorMessage(getLoginErrorMessage(error));
    }
  };

  const handleBiometricQuickResume = async (): Promise<void> => {
    try {
      setErrorMessage(null);

      const saved = await AsyncStorage.getItem(BIOMETRIC_VAULT_KEY);
      if (!saved) {
        setErrorMessage(
          'Please sign in with your email and password first to enable biometric login.',
        );
        return;
      }

      let parsed: { email?: string; password?: string } | null = null;
      try {
        parsed = JSON.parse(saved) as { email?: string; password?: string };
      } catch {
        parsed = null;
      }

      if (!parsed?.email || !parsed?.password) {
        setErrorMessage(
          'Please sign in with your email and password first to enable biometric login.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Verify identity to unlock Klir Facility Ops`,
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        setSubmitting(true);
        await signInWithEmailAndPassword(auth, parsed.email, parsed.password);
        setAwaitingRoleValidation(true);
      }
    } catch {
      setSubmitting(false);
      setAwaitingRoleValidation(false);
      setErrorMessage('Biometric verification failed. Please sign in manually.');
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Top Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.brandBadge}>
              <MaterialCommunityIcons
                name="shield-check"
                size={34}
                color={KLIR_COLORS.primary}
              />
            </View>
            <Text style={styles.brandTitle}>KLIR</Text>
            <Text style={styles.brandSubtitle}>Facility Operations</Text>
          </View>

          {/* Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={18}
                color={KLIR_COLORS.danger}
              />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Seamless Form Container */}
          <View style={styles.formContainer}>
            {/* Input Fields */}
            <View style={styles.inputStack}>
              <TextInput
                testID="text-input-outlined"
                label="Email"
                value={email}
                mode="outlined"
                placeholder="tech@smartflush.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                disabled={isBusy}
                left={<TextInput.Icon icon="email-outline" />}
                onChangeText={setEmail}
                outlineColor="#E5E5E5"
                activeOutlineColor="#222222"
                textColor="#222222"
                style={styles.outlinedInput}
              />

              <TextInput
                testID="text-input-outlined"
                label="Password"
                value={password}
                mode="outlined"
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                disabled={isBusy}
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    testID="right-icon-adornment"
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setShowPassword((prev) => !prev)}
                  />
                }
                onChangeText={setPassword}
                outlineColor="#E5E5E5"
                activeOutlineColor="#222222"
                textColor="#222222"
                style={styles.outlinedInput}
              />
            </View>

            {/* Actions */}
            <View style={styles.actionStack}>
              <KlirButton
                title="Sign in"
                variant="primary"
                loading={isBusy}
                disabled={isBusy}
                onPress={() => {
                  void handleLogin();
                }}
              />

              {biometricsAvailable ? (
                <KlirButton
                  title={hasSavedCredentials ? `Unlock with ${biometricType}` : `Sign in with ${biometricType}`}
                  variant="secondary"
                  icon="fingerprint"
                  disabled={isBusy}
                  onPress={() => {
                    void handleBiometricQuickResume();
                  }}
                />
              ) : null}

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isBusy}
                style={styles.forgotPasswordButton}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Forgot password</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Security Footer */}
          <View style={styles.footer}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={13}
              color={KLIR_COLORS.slateLight}
              style={styles.footerIcon}
            />
            <Text style={styles.footerText}>
              Authorized personnel only. Encrypted dispatch connection.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: KLIR_COLORS.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
    gap: 28,
  },
  brandHeader: {
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: KLIR_COLORS.primarySurface,
    borderWidth: 1,
    borderColor: KLIR_COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    ...KLIR_TYPOGRAPHY.h1,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 1.5,
    color: KLIR_COLORS.charcoal,
  },
  brandSubtitle: {
    ...KLIR_TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 20,
    color: KLIR_COLORS.slateMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
    gap: 20,
  },
  inputStack: {
    gap: 16,
  },
  outlinedInput: {
    backgroundColor: '#FFFFFF',
  },
  actionStack: {
    gap: 12,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: KLIR_COLORS.softRed,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: KLIR_COLORS.danger,
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: KLIR_COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerIcon: {
    marginTop: 1,
  },
  footerText: {
    fontSize: 12,
    color: KLIR_COLORS.slateLight,
    textAlign: 'center',
    lineHeight: 18,
  },
});


