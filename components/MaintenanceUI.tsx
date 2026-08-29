import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { formatTaskComponent, formatTaskTrigger, isBroadcastTask, isHardwareFailureComponent } from '../lib/tasks';
import type { AutomationTrigger, Task, TaskTriggerType } from '../types';

export const INTER_FONT = Platform.select({
  ios: 'Inter',
  android: 'Inter',
  default: 'Inter',
});

/**
 * SDCA Mobile Foundation Design Tokens
 * Brand color palette and typography system
 */
export const SDCA_COLORS = {
  // Brand Primary: Red Palette (#B5121B / #8F0D16)
  primary: '#B5121B',
  primaryStrong: '#8F0D16',
  primaryDark: '#8F0D16',
  primaryLight: '#D32F2F',
  primarySoft: '#FEE2E2',
  primarySurface: '#FEF2F2',
  primaryBorder: '#FECACA',

  // Brand Gold Palette (#C9A227 / #FFFBEB / #FEF9E7)
  gold: '#C9A227',
  goldDark: '#A6821C',
  goldLight: '#E5C048',
  goldSurface: '#FEF9E7',
  goldSoft: '#FFFBEB',
  goldBorder: '#FDE68A',

  // Neutrals: Charcoal (#222222), Gray & Clean White (#FFFFFF) Hierarchy
  charcoal: '#222222',
  slate: '#333333',
  slateMuted: '#666666',
  slateLight: '#999999',
  slateBorder: '#E5E5E5',
  canvas: '#F3F3F3',
  cardSurface: '#FFFFFF',
  surfaceAlt: '#FAFAFA',

  // Semantic Status Colors
  success: '#16A34A',
  successText: '#15803D',
  warning: '#F59E0B',
  warningText: '#C2410C',
  danger: '#B5121B',
  dangerText: '#8F0D16',
  info: '#2563EB',
  infoText: '#1D4ED8',

  // Soft Semantic Backgrounds
  softGreen: '#DCFCE7',
  softBlue: '#DBEAFE',
  softYellow: '#FEF9E7',
  softOrange: '#FFEDD5',
  softRed: '#FEE2E2',
  softGray: '#F3F3F3',
  softGold: '#FFFBEB',
  softTeal: '#CCFBF1',

  // Backward-compatible UI_COLORS aliases
  background: '#F3F3F3',
  surface: '#FFFFFF',
  text: '#222222',
  muted: '#666666',
  border: '#E5E5E5',
  chipText: '#222222',
} as const;

export const KLIR_COLORS = SDCA_COLORS;
export const UI_COLORS = SDCA_COLORS;

/**
 * KLIR Mobile Foundation Spacing Tokens (4dp grid)
 */
export const KLIR_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const KLIR_TYPOGRAPHY = {
  h1: {
    fontFamily: INTER_FONT,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: INTER_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: INTER_FONT,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    color: KLIR_COLORS.charcoal,
  },
  title: {
    fontFamily: INTER_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: KLIR_COLORS.charcoal,
  },
  body: {
    fontFamily: INTER_FONT,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    color: KLIR_COLORS.slate,
  },
  bodyMuted: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    color: KLIR_COLORS.slateMuted,
  },
  caption: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    color: KLIR_COLORS.slateMuted,
  },
  labelUpper: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: KLIR_COLORS.charcoal,
  },
  badgeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: INTER_FONT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
} as const;

export const COMPONENT_ICONS: Record<
  string,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  pump: 'water-pump',
  water_leak: 'water-alert',
  leak: 'water-alert',
  sensor_ultrasonic: 'radar',
  ultrasonic: 'radar',
  servo_lid: 'robot-industrial',
  servo: 'robot-industrial',
  waterflow: 'water-sync',
  water_flow: 'water-sync',
  connectivity: 'wifi-alert',
  offline: 'wifi-alert',
  flush_valve: 'valve',
  valve: 'valve',
  faucet: 'faucet',
  toilet_bowl: 'toilet',
  pipe: 'pipe',
  soap_dispenser: 'hand-wash',
  urinal_sensor: 'radar',
  sanitary_bin: 'trash-can-outline',
  grab_bar_and_sink: 'hand-wash-outline',
  mirror: 'mirror',
  floor: 'broom',
  uv_light: 'lightbulb-on-outline',
  maintenance: 'wrench',
  cleaning: 'broom',
};

export function getComponentMeta(component?: string | null): {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isHardware: boolean;
} {
  const normalized = (component ?? '').trim().toLowerCase();
  const label = formatTaskComponent(component);
  const icon = COMPONENT_ICONS[normalized] ?? 'wrench-outline';
  const isHardware = isHardwareFailureComponent(component);

  return { label, icon, isHardware };
}

export function taskTriggerTone(
  triggerType?: TaskTriggerType | null,
  automationTrigger?: AutomationTrigger,
): {
  label: string;
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (triggerType === 'hardware_failure') {
    return {
      label: 'Hardware Alert',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'alert-octagon',
    };
  }

  if (triggerType === 'maintenance') {
    return {
      label: formatTaskTrigger(triggerType, automationTrigger),
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'wrench-outline',
    };
  }

  if (triggerType === 'flush_count') {
    return {
      label: 'High Usage Check',
      backgroundColor: UI_COLORS.softGold,
      color: UI_COLORS.goldDark,
      icon: 'counter',
    };
  }

  if (triggerType === 'water_overuse') {
    return {
      label: 'High Water Usage',
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'water-alert',
    };
  }

  if (triggerType === 'water_no_flow') {
    return {
      label: 'No Water After Flush',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'water-off-outline',
    };
  }

  if (triggerType === 'uv_complete') {
    return {
      label: 'UV Cleaning Check',
      backgroundColor: UI_COLORS.softGold,
      color: UI_COLORS.goldDark,
      icon: 'lightbulb-alert-outline',
    };
  }

  if (triggerType === 'sensor_fault') {
    return {
      label: 'Occupancy Sensor Issue',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'radar',
    };
  }

  return {
    label: 'Manual Request',
    backgroundColor: UI_COLORS.softBlue,
    color: UI_COLORS.info,
    icon: 'account-wrench-outline',
  };
}

export function hardwareUrgencyTone(
  component?: string | null,
  status?: Task['status'],
): {
  label: string;
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  const meta = getComponentMeta(component);
  if (status === 'completed') {
    return {
      label: `${meta.label} Resolved`,
      backgroundColor: UI_COLORS.softGreen,
      color: UI_COLORS.success,
      icon: 'shield-check-outline',
    };
  }

  return {
    label: `${meta.label} Failure`,
    backgroundColor: UI_COLORS.softRed,
    color: UI_COLORS.danger,
    icon: meta.icon,
  };
}

export function statusTone(status: Task['status'] | 'broadcast' | 'Team Broadcast'): {
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (status === 'completed') {
    return {
      backgroundColor: '#2E7D32', // Rich solid forest green
      color: '#FFFFFF',
      icon: 'check-circle-outline',
    };
  }

  if (status === 'acknowledged') {
    return {
      backgroundColor: '#E05A36', // Solid terracotta / orange (On Task)
      color: '#FFFFFF',
      icon: 'progress-clock',
    };
  }

  if (status === 'flagged') {
    return {
      backgroundColor: '#DC2626', // Solid vibrant red (Flagged)
      color: '#FFFFFF',
      icon: 'flag-outline',
    };
  }

  if (status === 'rechecking') {
    return {
      backgroundColor: '#7E22CE', // Solid vibrant purple (Rechecking)
      color: '#FFFFFF',
      icon: 'sync',
    };
  }

  if (status === 'broadcast' || status === 'Team Broadcast') {
    return {
      backgroundColor: '#2563EB', // Solid vibrant blue
      color: '#FFFFFF',
      icon: 'bullhorn-outline',
    };
  }

  if (status === 'reassignment_needed' || status === 'unassigned') {
    return {
      backgroundColor: '#B91C1C', // Solid deep red
      color: '#FFFFFF',
      icon: 'alert-octagon-outline',
    };
  }

  return {
    backgroundColor: '#D97706', // Solid warm amber
    color: '#FFFFFF',
    icon: 'clock-alert-outline',
  };
}

export function getTaskDisplayTone(task: Task | null | undefined): {
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (!task) return statusTone('assigned');
  if (task.status === 'completed') return statusTone('completed');
  if (task.status === 'acknowledged') return statusTone('acknowledged');
  if (task.status === 'reassignment_needed') return statusTone('reassignment_needed');
  if (task.status === 'flagged') return statusTone('flagged');
  if (isBroadcastTask(task)) return statusTone('broadcast');
  return statusTone(task.status);
}

export type TaskPriorityLevel = 'standard' | 'high' | 'critical';

export function getTaskPriority(task: Task | null | undefined): TaskPriorityLevel {
  if (!task) return 'standard';

  if (
    task.triggerType === 'hardware_failure' ||
    task.triggerType === 'sensor_fault' ||
    task.triggerType === 'water_no_flow' ||
    task.triggerType === 'maintenance' ||
    task.status === 'reassignment_needed'
  ) {
    return 'critical';
  }

  if (
    task.triggerType === 'flush_count' ||
    task.triggerType === 'water_overuse' ||
    task.triggerType === 'uv_complete'
  ) {
    return 'high';
  }

  return 'standard';
}

export function taskPriorityTone(priority: TaskPriorityLevel): {
  label: string;
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (priority === 'critical') {
    return {
      label: 'Critical',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'alert-decagram',
    };
  }

  if (priority === 'high') {
    return {
      label: 'High Priority',
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'alert-circle-outline',
    };
  }

  return {
    label: 'Standard',
    backgroundColor: UI_COLORS.softBlue,
    color: UI_COLORS.info,
    icon: 'clipboard-text-outline',
  };
}

export function urgencyTone(
  status: Task['status'],
  triggerType?: TaskTriggerType | null,
): {
  label: string;
  backgroundColor: string;
  color: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} {
  if (status === 'completed') {
    return {
      label: 'Completed',
      backgroundColor: UI_COLORS.softGreen,
      color: UI_COLORS.success,
      icon: 'shield-check-outline',
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

  if (
    status === 'reassignment_needed' ||
    status === 'unassigned' ||
    triggerType === 'hardware_failure' ||
    triggerType === 'sensor_fault' ||
    triggerType === 'water_no_flow' ||
    triggerType === 'maintenance'
  ) {
    return {
      label: 'Critical',
      backgroundColor: UI_COLORS.softRed,
      color: UI_COLORS.danger,
      icon: 'alert-decagram',
    };
  }

  if (
    status === 'assigned' ||
    triggerType === 'flush_count' ||
    triggerType === 'water_overuse' ||
    triggerType === 'uv_complete'
  ) {
    return {
      label: 'High',
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'alert-circle-outline',
    };
  }

  return {
    label: 'Standard',
    backgroundColor: UI_COLORS.softBlue,
    color: UI_COLORS.info,
    icon: 'clipboard-text-outline',
  };
}

export const KLIR_RADII = {
  xs: 2,
  sm: 4,
  tag: 6,
  chip: 8,
  input: 10,
  card: 14,
  sheet: 20,
} as const;

export function OperationBadge({
  label,
  tone,
}: {
  label: string;
  tone: {
    backgroundColor: string;
    color: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    borderColor?: string;
  };
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor ?? 'transparent',
          borderWidth: tone.borderColor ? 1 : 0,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={tone.icon}
        size={12}
        color={tone.color}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
      <Text style={[styles.badgeText, { color: tone.color }]}>{label}</Text>
    </View>
  );
}

export const OperationTag = OperationBadge;

export function MetaPill({
  icon,
  label,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}): React.JSX.Element {
  return (
    <View style={styles.metaPill}>
      <MaterialCommunityIcons
        name={icon}
        size={13}
        color={KLIR_COLORS.slateMuted}
        accessibilityElementsHidden={true}
        importantForAccessibility="no"
      />
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

export const MetaTag = MetaPill;

export function SquadCapacityPillBar({
  available,
  onTask,
  offline,
  loading = false,
}: {
  available: number;
  onTask: number;
  offline: number;
  loading?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.capacityBarContainer}>
      <View style={[styles.capacitySegment, styles.capacitySegmentAvailable]}>
        <Text style={styles.capacitySegmentText}>
          {loading ? '—' : available} Available
        </Text>
      </View>
      <View style={styles.capacityDivider} />
      <View style={[styles.capacitySegment, styles.capacitySegmentOnTask]}>
        <Text style={styles.capacitySegmentText}>
          {loading ? '—' : onTask} On Task
        </Text>
      </View>
      <View style={styles.capacityDivider} />
      <View style={[styles.capacitySegment, styles.capacitySegmentOffline]}>
        <Text style={styles.capacitySegmentText}>
          {loading ? '—' : offline} Offline
        </Text>
      </View>
    </View>
  );
}

export interface SegmentedFilterItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export function SegmentedFilterControl<T extends string>({
  items,
  activeKey,
  onChange,
  style,
}: {
  items: Array<SegmentedFilterItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
  style?: object;
}): React.JSX.Element {
  return (
    <View style={[styles.segmentedTrack, style]}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <View
            key={item.key}
            style={[styles.segmentedItem, isActive && styles.segmentedItemActive]}
          >
            <Text
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${item.label}${typeof item.count === 'number' ? ` (${item.count})` : ''}`}
              style={[
                styles.segmentedItemText,
                isActive ? styles.segmentedItemTextActive : styles.segmentedItemTextInactive,
              ]}
            >
              {item.label}
              {typeof item.count === 'number' ? ` (${item.count})` : ''}
            </Text>
          </View>
        );
      })}
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
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={KLIR_COLORS.primary}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
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
  shadowColor: KLIR_COLORS.charcoal,
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

export const cardElevation = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  badge: {
    minHeight: 24,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...KLIR_TYPOGRAPHY.badgeText,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  metaPill: {
    minHeight: 26,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaPillText: {
    color: '#334155',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  capacityBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
    minHeight: 36,
    width: '100%',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#64748B',
  },
  capacitySegment: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  capacitySegmentAvailable: {
    backgroundColor: '#2E7D32',
  },
  capacitySegmentOnTask: {
    backgroundColor: '#E05A36',
  },
  capacitySegmentOffline: {
    backgroundColor: '#788896',
  },
  capacityDivider: {
    width: 1.5,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  capacitySegmentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: '#EBECEF',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 34,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmentedItemActive: {
    backgroundColor: KLIR_COLORS.primary,
    ...sharedShadow,
  },
  segmentedItemText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentedItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  segmentedItemTextInactive: {
    color: KLIR_COLORS.slateMuted,
  },
  emptyCard: {
    marginTop: 10,
    padding: 22,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
    backgroundColor: KLIR_COLORS.cardSurface,
    alignItems: 'flex-start',
    ...sharedShadow,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KLIR_COLORS.primarySurface,
    borderWidth: 1,
    borderColor: KLIR_COLORS.primaryBorder,
  },
  emptyTitle: {
    color: KLIR_COLORS.charcoal,
    fontWeight: '700',
  },
  emptyBody: {
    color: KLIR_COLORS.slateMuted,
    lineHeight: 22,
  },
  // Assignee Avatar Cluster Styles
  avatarClusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  avatarPillPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  avatarPillAck: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  avatarPillSubmitted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  avatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KLIR_COLORS.primarySoft,
  },
  avatarCircleAck: {
    backgroundColor: '#2563EB',
  },
  avatarCircleSubmitted: {
    backgroundColor: '#16A34A',
  },
  avatarCirclePending: {
    backgroundColor: '#94A3B8',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: KLIR_COLORS.primaryDark,
  },
  avatarTextAck: {
    color: '#FFFFFF',
  },
  avatarTextSubmitted: {
    color: '#FFFFFF',
  },
  avatarTextPending: {
    color: '#FFFFFF',
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
  },
  avatarLabelSubmitted: {
    color: '#14532D',
  },
  avatarLabelAck: {
    color: '#1E40AF',
  },
  avatarLabelPending: {
    color: '#475569',
  },
  statusPillSubmitted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  statusPillTextSubmitted: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  statusPillAck: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  checkBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 13,
    height: 13,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  broadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: KLIR_RADII.chip,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  broadcastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  mobilizationContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: KLIR_RADII.chip,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 6,
  },
  mobilizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobilizationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mobilizationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mobilizationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  responderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: KLIR_RADII.tag,
    borderWidth: 1,
  },
  responderChipAck: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  responderChipDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  responderAvatar: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responderAvatarAck: {
    backgroundColor: '#DBEAFE',
  },
  responderAvatarDone: {
    backgroundColor: '#DCFCE7',
  },
  responderAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  responderAvatarTextAck: {
    color: '#1D4ED8',
  },
  responderAvatarTextDone: {
    color: '#15803D',
  },
  responderName: {
    fontSize: 12,
    fontWeight: '600',
    color: KLIR_COLORS.charcoal,
  },
  pendingSelfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: KLIR_RADII.tag,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pendingSelfAvatar: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingSelfAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  pendingSelfText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});

export interface AssigneeAvatarClusterProps {
  task: Task;
  people?: Array<{ id: string; displayName?: string; email?: string | null }>;
  showNames?: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
}

export function cleanPersonName(name?: string | null): string {
  if (!name) return '';
  const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (cleaned.includes('@')) {
    const emailPrefix = cleaned.split('@')[0];
    const parts = emailPrefix.split(/[._-]/).filter(Boolean);
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }
  return cleaned;
}

export function getInitials(name?: string | null): string {
  if (!name) return 'OP';
  // Remove parenthetical annotations like (Tech), (Supervisor), (Admin), (Lead), etc.
  const stripped = name.replace(/\([^)]*\)/g, '').trim();
  if (!stripped) return 'OP';

  if (stripped.includes('@')) {
    const emailUser = stripped.split('@')[0];
    const emailParts = emailUser.split(/[._-]/).filter(Boolean);
    if (emailParts.length > 1) {
      return (emailParts[0][0] + emailParts[emailParts.length - 1][0]).toUpperCase();
    }
    return emailUser.substring(0, 2).toUpperCase();
  }

  // Split by whitespace and strip any remaining non-alphanumeric punctuation
  const words = stripped
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);

  if (words.length === 0) return 'OP';
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AssigneeAvatarCluster({
  task,
  people = [],
  showNames = true,
  currentUserId,
  currentUserName,
}: AssigneeAvatarClusterProps): React.JSX.Element | null {
  const assignedIds =
    task.assignedToIds && task.assignedToIds.length > 0
      ? task.assignedToIds
      : task.assignedTo
        ? [task.assignedTo]
        : [];

  const isBroadcast =
    task.isBroadcast ||
    assignedIds.length === 0 ||
    task.assignmentType === 'broadcast';

  // Gather all unique contributor IDs who worked on or were assigned to this task
  const allWorkerIds = Array.from(
    new Set([
      ...assignedIds,
      ...(task.completedBy ? [task.completedBy] : []),
      ...Object.keys(task.completedByMap ?? {}),
      ...Object.keys(task.submissions ?? {}),
      ...Object.keys(task.acknowledgedBy ?? {}),
    ]),
  );

  const resolveWorkerName = (
    uid: string,
  ): { displayName: string; firstName: string } => {
    // 1. Check if it matches current user
    if (currentUserId && (uid === currentUserId || uid === 'current-user')) {
      const full = cleanPersonName(currentUserName) || 'You';
      return { displayName: full, firstName: full.split(' ')[0] };
    }

    // 2. Check task submissions
    const submissionName = task.submissions?.[uid]?.technicianName;
    if (submissionName) {
      const cleaned = cleanPersonName(submissionName);
      return { displayName: cleaned, firstName: cleaned.split(' ')[0] };
    }

    // 3. Check people roster
    const person = people.find((p) => p.id === uid || p.email === uid);
    if (person?.displayName) {
      const cleaned = cleanPersonName(person.displayName);
      return { displayName: cleaned, firstName: cleaned.split(' ')[0] };
    }
    if (person?.email) {
      const cleaned = cleanPersonName(person.email);
      return { displayName: cleaned, firstName: cleaned.split(' ')[0] };
    }

    // 4. Format UID if it looks like an email or known ID
    if (uid.includes('@')) {
      const cleaned = cleanPersonName(uid);
      return { displayName: cleaned, firstName: cleaned.split(' ')[0] };
    }

    if (
      uid === task.assignedTo &&
      currentUserName &&
      (currentUserId == null || currentUserId === uid)
    ) {
      const cleaned = cleanPersonName(currentUserName);
      return { displayName: cleaned, firstName: cleaned.split(' ')[0] };
    }

    if (uid === task.assignedTo) {
      return { displayName: 'Assigned Tech', firstName: 'Assigned' };
    }

    return { displayName: 'Technician', firstName: 'Tech' };
  };

  if (isBroadcast) {
    const responderUids = Array.from(
      new Set([
        ...Object.keys(task.acknowledgedBy ?? {}),
        ...Object.keys(task.submissions ?? {}),
        ...Object.keys(task.completedByMap ?? {}),
        ...(task.assignedTo &&
        (task.status === 'acknowledged' || task.status === 'completed')
          ? [task.assignedTo]
          : []),
      ]),
    );
    const responderCount = responderUids.length;
    const isSelfAck = currentUserId
      ? Boolean(
          task.acknowledgedBy?.[currentUserId] ||
            task.submissions?.[currentUserId] ||
            task.completedByMap?.[currentUserId] ||
            (task.assignedTo === currentUserId &&
              (task.status === 'acknowledged' || task.status === 'completed')),
        )
      : false;

    return (
      <View style={styles.mobilizationContainer}>
        {/* Roster Header Banner */}
        <View style={styles.mobilizationHeader}>
          <View style={styles.mobilizationTitleRow}>
            <MaterialCommunityIcons
              name="bullhorn-outline"
              size={14}
              color="#1D4ED8"
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Text style={styles.mobilizationTitle}>
              {responderCount > 0
                ? `All-Team Incident • ${responderCount} Responded`
                : 'All-Team Broadcast • Awaiting Responders'}
            </Text>
          </View>
        </View>

        {/* Responders Row */}
        <View style={styles.mobilizationChipsRow}>
          {responderUids.map((uid) => {
            const { displayName, firstName } = resolveWorkerName(uid);
            const initials = getInitials(
              displayName === 'You' && currentUserName
                ? currentUserName
                : displayName,
            );
            const isDone = Boolean(
              task.submissions?.[uid] ||
                task.completedByMap?.[uid] ||
                (task.status === 'completed' && task.completedBy === uid),
            );

            return (
              <View
                key={uid}
                style={[
                  styles.responderChip,
                  isDone ? styles.responderChipDone : styles.responderChipAck,
                ]}
                accessible={true}
                accessibilityRole="summary"
                accessibilityLabel={`${displayName}: ${isDone ? 'Completed' : 'Acknowledged & Responding'}`}
              >
                <View
                  style={[
                    styles.responderAvatar,
                    isDone
                      ? styles.responderAvatarDone
                      : styles.responderAvatarAck,
                  ]}
                >
                  <Text
                    style={[
                      styles.responderAvatarText,
                      isDone
                        ? styles.responderAvatarTextDone
                        : styles.responderAvatarTextAck,
                    ]}
                  >
                    {initials}
                  </Text>
                </View>
                <Text style={styles.responderName} numberOfLines={1}>
                  {firstName}
                </Text>
                <MaterialCommunityIcons
                  name={isDone ? 'check-all' : 'check'}
                  size={11}
                  color={isDone ? '#15803D' : '#1D4ED8'}
                  style={{ marginLeft: 2 }}
                />
              </View>
            );
          })}

          {/* Self pending indicator if current user is not yet in responder list and task is not completed */}
          {!isSelfAck && task.status !== 'completed' && (
            <View style={styles.pendingSelfChip}>
              <View style={styles.pendingSelfAvatar}>
                <Text style={styles.pendingSelfAvatarText}>ME</Text>
              </View>
              <Text style={styles.pendingSelfText}>You (Pending)</Text>
              <MaterialCommunityIcons
                name="clock-outline"
                size={11}
                color="#64748B"
                style={{ marginLeft: 2 }}
              />
            </View>
          )}
        </View>
      </View>
    );
  }

  // Multi-assignee or standard assigned task
  const targetIds = allWorkerIds.length > 0 ? allWorkerIds : assignedIds;

  return (
    <View style={styles.avatarClusterRow}>
      {targetIds.map((uid) => {
        const { displayName } = resolveWorkerName(uid);
        const initials = getInitials(
          displayName === 'You' && currentUserName
            ? currentUserName
            : displayName,
        );

        const hasAcknowledged = Boolean(
          task.acknowledgedBy?.[uid] ||
            (task.status === 'acknowledged' && task.assignedTo === uid) ||
            task.completedByMap?.[uid] ||
            task.submissions?.[uid],
        );

        const hasSubmitted = Boolean(
          task.submissions?.[uid] ||
            task.completedByMap?.[uid] ||
            (task.status === 'completed' &&
              (task.completedBy === uid ||
                (task.completedBy == null && task.assignedTo === uid))),
        );

        const statusLabel = hasSubmitted
          ? 'Submitted'
          : hasAcknowledged
            ? 'Acknowledged'
            : 'Pending';

        return (
          <View
            key={uid}
            style={[
              styles.avatarPill,
              hasSubmitted
                ? styles.avatarPillSubmitted
                : hasAcknowledged
                  ? styles.avatarPillAck
                  : styles.avatarPillPending,
            ]}
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={`${displayName}: ${statusLabel}`}
          >
            <View
              style={[
                styles.avatarCircle,
                hasSubmitted
                  ? styles.avatarCircleSubmitted
                  : hasAcknowledged
                    ? styles.avatarCircleAck
                    : styles.avatarCirclePending,
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  hasSubmitted
                    ? styles.avatarTextSubmitted
                    : hasAcknowledged
                      ? styles.avatarTextAck
                      : styles.avatarTextPending,
                ]}
              >
                {initials}
              </Text>
            </View>

            {showNames && (
              <Text
                style={[
                  styles.avatarLabel,
                  hasSubmitted
                    ? styles.avatarLabelSubmitted
                    : hasAcknowledged
                      ? styles.avatarLabelAck
                      : styles.avatarLabelPending,
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            )}

            {hasSubmitted ? (
              <View style={styles.statusPillSubmitted}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={12}
                  color="#15803D"
                />
                <Text style={styles.statusPillTextSubmitted}>Done</Text>
              </View>
            ) : hasAcknowledged ? (
              <View style={styles.statusPillAck}>
                <MaterialCommunityIcons
                  name="progress-clock"
                  size={12}
                  color="#2563EB"
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
