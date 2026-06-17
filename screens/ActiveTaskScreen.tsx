import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Card,
  Divider,
  Text,
} from 'react-native-paper';

import {
  EmptyOperationState,
  MetaPill,
  OperationBadge,
  UI_COLORS,
  sharedShadow,
  statusTone,
  urgencyTone,
} from '../components/MaintenanceUI';
import { TaskDetailSkeleton } from '../components/SkeletonScreens';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { getRestroomLabel } from '../lib/restrooms';
import { formatTaskStatus } from '../lib/tasks';
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

export function ActiveTaskScreen({ route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, inboxTasks, loading } = useTasks();
  const selectedTaskId = route.params?.taskId;
  const activeTask = useMemo(() => {
    const selectedTask = selectedTaskId
      ? tasks.find((task) => task.id === selectedTaskId)
      : null;

    if (selectedTask) {
      return selectedTask;
    }

    return (
      inboxTasks.find((task) => task.status === 'assigned') ??
      inboxTasks.find((task) => task.status === 'unassigned') ??
      inboxTasks.find((task) => task.status === 'acknowledged') ??
      null
    );
  }, [inboxTasks, selectedTaskId, tasks]);

  if (loading) {
    return <TaskDetailSkeleton />;
  }

  if (!activeTask) {
    return <EmptyTaskPanel />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card mode="contained" style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <View style={styles.headerBadgeRow}>
              <OperationBadge
                label={urgencyTone(activeTask.status).label}
                tone={urgencyTone(activeTask.status)}
              />
              <OperationBadge
                label={formatTaskStatus(activeTask.status)}
                tone={statusTone(activeTask.status)}
              />
            </View>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Active Work Order
            </Text>
            <Text variant="titleLarge" style={styles.locationTitle}>
              {getRestroomLabel(activeTask)}
            </Text>
            <Text variant="bodyMedium" style={styles.headerCopy}>
              {activeTask.building} - {activeTask.floor} - {activeTask.location}
            </Text>
            <View style={styles.metaRow}>
              <MetaPill icon="toilet" label={activeTask.location} />
              <MetaPill icon="timer-outline" label={formatDate(activeTask.createdAt)} />
            </View>
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.detailCard}>
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Cleaning Instruction
            </Text>
            <Text variant="bodyLarge" style={styles.noteText}>
              {activeTask.message}
            </Text>
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.detailCard}>
          <Card.Content style={styles.sectionContent}>
            <DetailRow label="Task ID" value={activeTask.id} />
            <Divider />
            <DetailRow
              label="Assigned to"
              value={formatAssignee(activeTask.assignedTo, user?.uid ?? null)}
            />
            <Divider />
            <DetailRow
              label="Created at"
              value={formatDate(activeTask.createdAt)}
            />
            <Divider />
            <DetailRow
              label="Acknowledged at"
              value={formatDate(activeTask.acknowledgedAt)}
            />
            <Divider />
            <DetailRow
              label="Completed at"
              value={formatDate(activeTask.completedAt)}
            />
          </Card.Content>
        </Card>

        <Card mode="contained" style={styles.guidanceCard}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.guidanceText}>
              Open this task from the Inbox to acknowledge it, capture photos,
              complete the checklist, and submit completion.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
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
  headerCard: {
    borderRadius: 22,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  headerContent: {
    gap: 10,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  locationTitle: {
    color: UI_COLORS.primaryStrong,
    fontWeight: '900',
  },
  headerCopy: {
    color: UI_COLORS.muted,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    fontSize: 18,
    lineHeight: 27,
  },
  sectionTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  guidanceCard: {
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  guidanceText: {
    color: UI_COLORS.primaryStrong,
    lineHeight: 22,
    fontWeight: '700',
  },
});
