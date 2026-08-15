import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { Task } from '../types';

export const UI_COLORS = {
  background: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#ECFDF5',
  primary: '#0F766E',
  primaryStrong: '#115E59',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#2563EB',
  chipText: '#111827',
  softGreen: '#DCFCE7',
  softBlue: '#DBEAFE',
  softYellow: '#FEF3C7',
  softOrange: '#FFEDD5',
  softRed: '#FEE2E2',
  softGray: '#F3F4F6',
};

export function statusTone(status: Task['status']): {
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (status === 'completed') {
    return {
      backgroundColor: UI_COLORS.softGreen,
      color: UI_COLORS.success,
      icon: 'check-circle-outline',
    };
  }

  if (status === 'acknowledged') {
    return {
      backgroundColor: UI_COLORS.softBlue,
      color: UI_COLORS.info,
      icon: 'progress-clock',
    };
  }

  if (status === 'reassignment_needed' || status === 'unassigned') {
    return {
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'alert-octagon-outline',
    };
  }

  return {
    backgroundColor: UI_COLORS.softOrange,
    color: UI_COLORS.warning,
    icon: 'clock-alert-outline',
  };
}

export function urgencyTone(status: Task['status']): {
  label: string;
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (status === 'reassignment_needed' || status === 'unassigned') {
    return {
      label: 'Critical',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'alert-decagram',
    };
  }

  if (status === 'assigned') {
    return {
      label: 'High',
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'alert-circle-outline',
    };
  }

  if (status === 'acknowledged') {
    return {
      label: 'In Progress',
      backgroundColor: UI_COLORS.softBlue,
      color: UI_COLORS.info,
      icon: 'timer-sand',
    };
  }

  return {
    label: 'Completed',
    backgroundColor: UI_COLORS.softGreen,
    color: UI_COLORS.success,
    icon: 'shield-check-outline',
  };
}

export function OperationBadge({
  label,
  tone,
}: {
  label: string;
  tone: ReturnType<typeof statusTone> | ReturnType<typeof urgencyTone>;
}): React.JSX.Element {
  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
      <MaterialCommunityIcons name={tone.icon} size={15} color={tone.color} />
      <Text style={[styles.badgeText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

export function MetaPill({
  icon,
  label,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}): React.JSX.Element {
  return (
    <View style={styles.metaPill}>
      <MaterialCommunityIcons name={icon} size={16} color={UI_COLORS.muted} />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

export function EmptyOperationState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}): React.JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={30} color={UI_COLORS.primary} />
      </View>
      <Text variant="titleMedium" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text variant="bodyMedium" style={styles.emptyBody}>
        {body}
      </Text>
    </View>
  );
}

export const sharedShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

const styles = StyleSheet.create({
  badge: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaPill: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: UI_COLORS.softGray,
  },
  metaPillText: {
    color: UI_COLORS.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: 10,
    padding: 22,
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    backgroundColor: UI_COLORS.surface,
    alignItems: 'flex-start',
    ...sharedShadow,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI_COLORS.surfaceAlt,
  },
  emptyTitle: {
    color: UI_COLORS.text,
    fontWeight: '800',
  },
  emptyBody: {
    color: UI_COLORS.muted,
    lineHeight: 22,
  },
});
