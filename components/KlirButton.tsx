import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { KLIR_COLORS, KLIR_TYPOGRAPHY } from './MaintenanceUI';

export type KlirButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export type KlirButtonSize = 'small' | 'medium' | 'large';

export interface KlirButtonProps {
  children?: React.ReactNode;
  title?: string;
  variant?: KlirButtonVariant;
  size?: KlirButtonSize;
  onPress?: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function KlirButton({
  children,
  title,
  variant = 'primary',
  size = 'medium',
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  iconSize = 20,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: KlirButtonProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isInteractionDisabled = disabled || loading;
  const isStaticDisabled = disabled && !loading;
  const labelText = title ?? (typeof children === 'string' ? children : null);

  const handlePressIn = (): void => {
    if (isInteractionDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const getTextColor = (): string => {
    if (variant === 'primary' || variant === 'danger') {
      return '#FFFFFF';
    }
    if (variant === 'secondary') {
      return KLIR_COLORS.charcoal;
    }
    if (variant === 'outline' || variant === 'ghost') {
      return KLIR_COLORS.primary;
    }
    return '#FFFFFF';
  };

  const textColor = getTextColor();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? labelText ?? undefined}
        accessibilityState={{ disabled: isInteractionDisabled, busy: loading }}
        disabled={isInteractionDisabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          styles[`size_${size}`],
          pressed && !isInteractionDisabled && styles[`${variant}_pressed`],
          isStaticDisabled && styles.disabled,
          loading && styles.loadingBase,
          style,
        ]}
      >
      {loading ? (
        <View style={styles.contentRow}>
          <ActivityIndicator size="small" color={textColor} />
          {labelText ? (
            <Text
              style={[
                styles.text,
                { color: textColor },
                styles[`text_${size}`],
                textStyle,
              ]}
            >
              {labelText}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' ? (
            <MaterialCommunityIcons
              name={icon}
              size={iconSize}
              color={textColor}
              style={styles.leftIcon}
            />
          ) : null}

          {labelText ? (
            <Text
              style={[
                styles.text,
                { color: textColor },
                styles[`text_${size}`],
                textStyle,
              ]}
            >
              {labelText}
            </Text>
          ) : (
            children
          )}

          {icon && iconPosition === 'right' ? (
            <MaterialCommunityIcons
              name={icon}
              size={iconSize}
              color={textColor}
              style={styles.rightIcon}
            />
          ) : null}
        </View>
      )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    ...KLIR_TYPOGRAPHY.button,
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: 2,
  },
  rightIcon: {
    marginLeft: 2,
  },

  // Sizes (thumb-zone minHeight 52dp default)
  size_small: {
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  text_small: {
    fontSize: 13,
    lineHeight: 18,
  },
  size_medium: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  text_medium: {
    fontSize: 15,
    lineHeight: 20,
  },
  size_large: {
    minHeight: 58,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  text_large: {
    fontSize: 16,
    lineHeight: 22,
  },

  // Variants
  primary: {
    backgroundColor: KLIR_COLORS.primary,
    shadowColor: KLIR_COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primary_pressed: {
    backgroundColor: KLIR_COLORS.primaryStrong,
    opacity: 0.95,
  },

  secondary: {
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
  },
  secondary_pressed: {
    backgroundColor: '#F3F3F3',
  },

  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: KLIR_COLORS.primary,
  },
  outline_pressed: {
    backgroundColor: KLIR_COLORS.primarySurface,
  },

  ghost: {
    backgroundColor: 'transparent',
  },
  ghost_pressed: {
    backgroundColor: KLIR_COLORS.softGray,
  },

  danger: {
    backgroundColor: KLIR_COLORS.danger,
  },
  danger_pressed: {
    backgroundColor: KLIR_COLORS.primaryStrong,
  },

  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingBase: {
    opacity: 0.92,
  },
});
