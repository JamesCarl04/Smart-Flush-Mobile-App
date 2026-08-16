import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Divider, Snackbar, Text } from 'react-native-paper';

import {
  EmptyOperationState,
  MetaPill,
  OperationBadge,
  UI_COLORS,
  getComponentMeta,
  sharedShadow,
  statusTone,
} from '../components/MaintenanceUI';
import { TaskDetailSkeleton } from '../components/SkeletonScreens';
import { TaskExecutionModal } from '../components/TaskExecutionModal';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { acknowledgeTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { formatTaskComponent, formatTaskStatus, formatTaskTrigger } from '../lib/tasks';
import type { Task, TaskStackParamList } from '../types';

type Props = NativeStackScreenProps<TaskStackParamList, 'ActiveTask'>;

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}



function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text variant="labelLarge" style={styles.detailLabel}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function formatAssignee(
  assignedTo: string | null,
  currentUserId: string | null,
): string {
  if (!assignedTo) {
    return 'All maintenance team';
  }

  return assignedTo === currentUserId ? 'You' : 'Maintenance staff';
}

function EmptyTaskPanel(): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <EmptyOperationState
        icon="clipboard-text-search-outline"
        title="No active task"
        body="No restroom work order needs your attention right now. New assigned tasks will appear in your Inbox."
      />
    </View>
  );
}

export function ActiveTaskScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, inboxTasks, loading, refreshTasks } = useTasks();
  const selectedTaskId = route.params?.taskId;

  const activeTask = useMemo(() => {
    const selectedTask = selectedTaskId
      ? tasks.find((task) => task.id === selectedTaskId)
      : null;

    if (selectedTask) {
      return selectedTask;
    }

    return (
      inboxTasks.find((task) => task.status === 'acknowledged') ??
      inboxTasks.find((task) => task.status === 'assigned') ??
      inboxTasks.find((task) => task.status === 'unassigned') ??
      inboxTasks.find((task) => task.status === 'reassignment_needed') ??
      null
    );
  }, [inboxTasks, selectedTaskId, tasks]);

  const [executionModalVisible, setExecutionModalVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  const handleAction = async (): Promise<void> => {
    if (!activeTask) return;
    if (activeTask.status !== 'acknowledged') {
      setActionInFlight(true);
      try {
        await acknowledgeTask(activeTask.id);
        await refreshTasks();
        setExecutionModalVisible(true);
      } catch (error) {
        setSnackbarMessage(
          error instanceof Error ? error.message : 'Failed to start task.',
        );
      } finally {
        setActionInFlight(false);
      }
    } else {
      setExecutionModalVisible(true);
    }
  };

  const handleOpenTask = (taskId: string): void => {
    navigation.navigate('TaskDetail', { taskId });
  };

  if (loading) {
    return <TaskDetailSkeleton />;
  }

  if (!activeTask) {
    return <EmptyTaskPanel />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Unified Hero Action Card - Everything at a single glance */}
        <Card mode="elevated" style={styles.heroCard}>
          <Card.Content style={styles.heroContent}>
            {/* Top Row: Single Status Badge + Shift Pill */}
            <View style={styles.headerTopRow}>
              <OperationBadge
                label={formatTaskStatus(activeTask.status)}
                tone={statusTone(activeTask.status)}
              />
              <View style={styles.shiftPill}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={13}
                  color={UI_COLORS.muted}
                />
                <Text style={styles.shiftPillText}>
                  {`${activeTask.shift} Shift`}
                </Text>
              </View>
            </View>

            {/* Primary Restroom Headline */}
            <Text style={styles.locationHeadline}>
              {getRestroomLabel(activeTask)}
            </Text>

            {/* Single Breadcrumb Subtitle */}
            <Text style={styles.locationBreadcrumb}>
              {`${activeTask.floor} • ${activeTask.location} • ${activeTask.building}`}
            </Text>

            {/* Instruction Callout Box */}
            {activeTask.message ? (
              <View style={styles.instructionCallout}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={18}
                  color={UI_COLORS.primary}
                  style={styles.instructionIcon}
                />
                <View style={styles.instructionTextWrapper}>
                  <Text style={styles.instructionLabel}>INSTRUCTION</Text>
                  <Text style={styles.instructionText}>
                    {activeTask.message}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Meta Tags */}
            <View style={styles.metaRow}>
              <MetaPill
                icon={getComponentMeta(activeTask.component).icon}
                label={getComponentMeta(activeTask.component).label}
              />
              {activeTask.type === 'cleaning' ? (
                <MetaPill icon="broom" label="Cleaning" />
              ) : null}
              <MetaPill
                icon="calendar-clock"
                label={formatDate(activeTask.createdAt)}
              />
            </View>

            {/* Direct Action Button (Launches Slide-Up Execution Modal) */}
            <Button
              mode="contained"
              loading={actionInFlight}
              disabled={actionInFlight}
              onPress={() => void handleAction()}
              contentStyle={styles.actionButtonContent}
              style={styles.actionButton}
              textColor="#FFFFFF"
              labelStyle={styles.actionButtonLabel}
              theme={{
                colors: {
                  primary: '#B5121B',
                  onPrimary: '#FFFFFF',
                  surfaceDisabled: '#B5121B',
                  onSurfaceDisabled: '#FFFFFF',
                },
              }}
              icon={
                activeTask.status === 'acknowledged'
                  ? 'camera-outline'
                  : 'clipboard-check-outline'
              }
            >
              {activeTask.status === 'acknowledged'
                ? 'Resume Task & Open Camera'
                : 'Acknowledge & Start Task'}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Slide-Up Task Execution Modal */}
      <TaskExecutionModal
        visible={executionModalVisible}
        task={activeTask}
        onDismiss={() => setExecutionModalVisible(false)}
        onTaskCompleted={() => {
          setSnackbarMessage('Task completed successfully.');
          void refreshTasks();
        }}
      />

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: UI_COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: UI_COLORS.background,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: UI_COLORS.background,
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  heroContent: {
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: UI_COLORS.softGray,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: UI_COLORS.muted,
  },
  locationHeadline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: UI_COLORS.text,
    letterSpacing: -0.3,
  },
  locationBreadcrumb: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: UI_COLORS.muted,
  },
  instructionCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  instructionIcon: {
    marginTop: 2,
  },
  instructionTextWrapper: {
    flex: 1,
    gap: 2,
  },
  instructionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_COLORS.text,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    borderRadius: 14,
    backgroundColor: '#B5121B',
    marginTop: 4,
  },
  actionButtonContent: {
    minHeight: 52,
  },
  actionButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  detailCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  sectionContent: {
    gap: 12,
  },
  sectionTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: UI_COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: UI_COLORS.text,
    fontWeight: '700',
  },
  noteText: {
    color: UI_COLORS.text,
    fontSize: 17,
    lineHeight: 25,
  },
});
