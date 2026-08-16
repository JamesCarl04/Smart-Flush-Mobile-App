import { useState } from 'react';
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
import { FirebaseError } from 'firebase/app';
import { sendPasswordResetEmail } from '@react-native-firebase/auth';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { TextInput } from 'react-native-paper';

import { KlirButton } from '../components/KlirButton';
import {
  KLIR_COLORS,
  KLIR_TYPOGRAPHY,
} from '../components/MaintenanceUI';
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name="lock-reset"
                size={34}
                color={KLIR_COLORS.primary}
              />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered email address to receive reset instructions.
            </Text>
          </View>

          {/* Status Message Banner */}
          {message ? (
            <View
              style={[
                styles.statusBanner,
                isError ? styles.errorBanner : styles.successBanner,
              ]}
            >
              <MaterialCommunityIcons
                name={isError ? 'alert-circle-outline' : 'check-circle-outline'}
                size={18}
                color={isError ? KLIR_COLORS.danger : KLIR_COLORS.success}
              />
              <Text
                style={[
                  styles.statusText,
                  isError ? styles.errorText : styles.successText,
                ]}
              >
                {message}
              </Text>
            </View>
          ) : null}

          {/* Seamless Form Container */}
          <View style={styles.formContainer}>
            <TextInput
              testID="text-input-outlined"
              label="Email"
              value={email}
              mode="outlined"
              placeholder="tech@smartflush.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              disabled={isLoading}
              left={<TextInput.Icon icon="email-outline" />}
              onChangeText={setEmail}
              outlineColor="#E5E5E5"
              activeOutlineColor="#222222"
              textColor="#222222"
              style={styles.outlinedInput}
            />

            <View style={styles.actionStack}>
              <KlirButton
                title="Send Reset Link"
                variant="primary"
                loading={isLoading}
                disabled={isLoading}
                onPress={() => {
                  void handleSendResetLink();
                }}
              />

              <TouchableOpacity
                onPress={() => navigation.goBack()}
                disabled={isLoading}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={16}
                  color={KLIR_COLORS.primary}
                />
                <Text style={styles.backButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Need assistance? Contact your facility supervisor.
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
  header: {
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
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
  title: {
    ...KLIR_TYPOGRAPHY.h2,
    fontSize: 24,
    lineHeight: 30,
    color: KLIR_COLORS.charcoal,
    textAlign: 'center',
  },
  subtitle: {
    ...KLIR_TYPOGRAPHY.bodyMuted,
    fontSize: 14,
    lineHeight: 20,
    color: KLIR_COLORS.slateMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  formContainer: {
    width: '100%',
    gap: 20,
  },
  outlinedInput: {
    backgroundColor: '#FFFFFF',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorBanner: {
    backgroundColor: KLIR_COLORS.softRed,
    borderColor: '#FECACA',
  },
  successBanner: {
    backgroundColor: KLIR_COLORS.softGreen,
    borderColor: '#BBF7D0',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorText: {
    color: KLIR_COLORS.danger,
  },
  successText: {
    color: KLIR_COLORS.successText,
  },
  actionStack: {
    gap: 12,
    marginTop: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KLIR_COLORS.primary,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: KLIR_COLORS.slateLight,
    textAlign: 'center',
    lineHeight: 18,
  },
});


