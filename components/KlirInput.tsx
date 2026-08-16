import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { KLIR_COLORS, KLIR_TYPOGRAPHY } from './MaintenanceUI';

export interface KlirInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  helperText?: string | null;
  leftIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function KlirInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  secureTextEntry,
  disabled = false,
  containerStyle,
  inputStyle,
  inputContainerStyle,
  testID = 'text-input-outlined',
  onFocus,
  onBlur,
  ...rest
}: KlirInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSecure = isPassword ? !showPassword : secureTextEntry;
  const hasError = Boolean(error);

  const getBorderColor = (): string => {
    if (hasError) return KLIR_COLORS.danger;
    if (isFocused) return KLIR_COLORS.charcoal;
    return KLIR_COLORS.slateBorder;
  };

  const getBackgroundColor = (): string => {
    if (disabled) return KLIR_COLORS.softGray;
    return KLIR_COLORS.cardSurface;
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              isFocused && styles.labelFocused,
              hasError && styles.labelError,
            ]}
          >
            {label}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            backgroundColor: getBackgroundColor(),
            borderWidth: isFocused || hasError ? 1.5 : 1,
          },
          disabled && styles.disabledInputContainer,
          inputContainerStyle,
        ]}
      >
        {leftIcon ? (
          <View style={styles.leftIconContainer}>
            <MaterialCommunityIcons
              name={leftIcon}
              size={20}
              color={
                hasError
                  ? KLIR_COLORS.danger
                  : isFocused
                    ? KLIR_COLORS.charcoal
                    : KLIR_COLORS.slateMuted
              }
            />
          </View>
        ) : null}

        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={KLIR_COLORS.slateLight}
          secureTextEntry={isSecure}
          editable={!disabled}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            isPassword || rightIcon ? styles.inputWithRightIcon : undefined,
            inputStyle,
          ]}
          {...rest}
        />

        {isPassword ? (
          <TouchableOpacity
            testID="right-icon-adornment"
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.rightIconContainer}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={KLIR_COLORS.slateMuted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            testID="right-icon-adornment"
            accessibilityRole="button"
            onPress={onRightIconPress}
            style={styles.rightIconContainer}
            disabled={!onRightIconPress || disabled}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={rightIcon}
              size={20}
              color={KLIR_COLORS.slateMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {hasError ? (
        <View style={styles.messageRow}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={14}
            color={KLIR_COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <View style={styles.messageRow}>
          <Text style={styles.helperText}>{helperText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginBottom: 4,
  },
  labelRow: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...KLIR_TYPOGRAPHY.labelUpper,
  },
  labelFocused: {
    color: KLIR_COLORS.charcoal,
  },
  labelError: {
    color: KLIR_COLORS.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    shadowColor: KLIR_COLORS.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  disabledInputContainer: {
    opacity: 0.65,
  },
  leftIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIconContainer: {
    marginLeft: 10,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: KLIR_COLORS.charcoal,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: KLIR_COLORS.danger,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    color: KLIR_COLORS.slateMuted,
  },
});
