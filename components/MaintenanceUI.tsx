import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { formatTaskComponent, isHardwareFailureComponent } from '../lib/tasks';
import type { Task, TaskTriggerType } from '../types';

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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    color: KLIR_COLORS.charcoal,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: KLIR_COLORS.charcoal,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    color: KLIR_COLORS.slate,
  },
  bodyMuted: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    color: KLIR_COLORS.slateMuted,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
    color: KLIR_COLORS.slateMuted,
  },
  labelUpper: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: KLIR_COLORS.charcoal,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  button: {
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

export function taskTriggerTone(triggerType?: TaskTriggerType | null): {
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
      label: 'Maintenance',
      backgroundColor: UI_COLORS.softOrange,
      color: '#C2410C',
      icon: 'wrench-outline',
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

export type TaskPriorityLevel = 'standard' | 'high' | 'critical';

export function getTaskPriority(task: Task | null | undefined): TaskPriorityLevel {
  if (!task) return 'standard';

  if (
    task.triggerType === 'hardware_failure' ||
    task.triggerType === 'maintenance' ||
    task.status === 'reassignment_needed'
  ) {
    return 'critical';
  }

  if (task.triggerType === 'flush_count' || task.triggerType === 'uv_complete') {
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

export function OperationBadge({
  label,
  tone,
}: {
  label: string;
  tone: {
    backgroundColor: string;
    color: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  };
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: `${tone.color}25`,
        },
      ]}
    >
      <MaterialCommunityIcons name={tone.icon} size={14} color={tone.color} />
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
      <MaterialCommunityIcons
        name={icon}
        size={14}
        color={KLIR_COLORS.slateMuted}
      />
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
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={KLIR_COLORS.primary}
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

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  badgeText: {
    ...KLIR_TYPOGRAPHY.badgeText,
  },
  metaPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: KLIR_COLORS.softGray,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
  },
  metaPillText: {
    color: KLIR_COLORS.slate,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 10,
    padding: 22,
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
    backgroundColor: KLIR_COLORS.cardSurface,
    alignItems: 'flex-start',
    ...sharedShadow,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  avatarPillPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  avatarPillAck: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  avatarPillSubmitted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  avatarCircleWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KLIR_COLORS.primarySoft,
  },
  avatarCircleAck: {
    backgroundColor: '#DCFCE7',
  },
  avatarCircleSubmitted: {
    backgroundColor: '#16A34A',
  },
  avatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: KLIR_COLORS.primaryDark,
  },
  avatarTextAck: {
    color: '#15803D',
  },
  avatarTextSubmitted: {
    color: '#FFFFFF',
  },
  checkBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: KLIR_COLORS.charcoal,
  },
  broadcastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  broadcastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});

export interface AssigneeAvatarClusterProps {
  task: Task;
  people?: Array<{ id: string; displayName?: string; email?: string | null }>;
  showNames?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AssigneeAvatarCluster({
  task,
  people = [],
  showNames = true,
}: AssigneeAvatarClusterProps): React.JSX.Element | null {
  const assignedIds =
    task.assignedToIds && task.assignedToIds.length > 0
      ? task.assignedToIds
      : task.assignedTo
        ? [task.assignedTo]
        : [];

  const isBroadcast = assignedIds.length === 0;

  if (isBroadcast) {
    const ackCount = task.acknowledgedBy ? Object.keys(task.acknowledgedBy).length : 0;
    return (
      <View
        style={styles.broadcastPill}
        accessible={true}
        accessibilityRole="summary"
        accessibilityLabel={`Broadcast to all team. ${ackCount} acknowledged`}
      >
        <MaterialCommunityIcons name="bullhorn-outline" size={14} color="#1D4ED8" />
        <Text style={styles.broadcastText}>
          {ackCount > 0 ? `Team Broadcast (${ackCount} Acknowledged)` : 'All Team (Broadcast)'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.avatarClusterRow}>
      {assignedIds.map((uid) => {
        const person = people.find((p) => p.id === uid || p.email === uid);
        const displayName = person?.displayName || person?.email || (uid === task.assignedTo ? 'Assigned Tech' : uid);
        const initials = getInitials(displayName);

        const hasAcknowledged = Boolean(
          task.acknowledgedBy?.[uid] ||
          (task.status === 'acknowledged' && task.assignedTo === uid) ||
          task.completedByMap?.[uid] ||
          task.submissions?.[uid]
        );

        const hasSubmitted = Boolean(
          task.submissions?.[uid] ||
          task.completedByMap?.[uid] ||
          (task.status === 'completed' && (task.completedBy === uid || task.assignedTo === uid))
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
            <View style={styles.avatarCircleWrapper}>
              <View
                style={[
                  styles.avatarCircle,
                  hasSubmitted
                    ? styles.avatarCircleSubmitted
                    : hasAcknowledged
                      ? styles.avatarCircleAck
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    hasSubmitted
                      ? styles.avatarTextSubmitted
                      : hasAcknowledged
                        ? styles.avatarTextAck
                        : null,
                  ]}
                >
                  {initials}
                </Text>
              </View>
              {hasAcknowledged && (
                <View style={styles.checkBadge}>
                  <MaterialCommunityIcons
                    name={hasSubmitted ? 'check-all' : 'check'}
                    size={9}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>

            {showNames && (
              <Text style={styles.avatarLabel} numberOfLines={1}>
                {displayName.split(' ')[0]}
                {hasSubmitted ? ' (Done)' : hasAcknowledged ? ' (Ack)' : ''}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

