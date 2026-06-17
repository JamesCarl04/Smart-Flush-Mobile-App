import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Card,
  Chip,
  Divider,
  Text,
} from 'react-native-paper';

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

function getStatusChipStyle(status: Task['status']): object {
  if (status === 'completed') {
    return styles.completedChip;
  }

  if (status === 'acknowledged') {
    return styles.acknowledgedChip;
  }

  return styles.pendingChip;
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
      <Card mode="contained" style={styles.emptyCard}>
        <Card.Content style={styles.emptyContent}>
          <Text variant="titleLarge">No active task</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            New dashboard notes will appear here after they arrive in your
            notification inbox.
          </Text>
        </Card.Content>
      </Card>
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
            <Text variant="headlineSmall">Task Detail</Text>
            <Text variant="titleLarge">{getRestroomLabel(activeTask)}</Text>
            <Text variant="bodyMedium" style={styles.headerCopy}>
              This page shows the current task that needs your attention.
            </Text>
            <Chip compact style={getStatusChipStyle(activeTask.status)}>
              {formatTaskStatus(activeTask.status)}
            </Chip>
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.detailCard}>
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium">Cleaning instruction</Text>
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

        <Card mode="contained" style={styles.emptyCard}>
          <Card.Content>
            <Text variant="bodyMedium" style={styles.emptyText}>
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
    backgroundColor: '#f3faf8',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: '#f3faf8',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f3faf8',
  },
  emptyCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
  },
  emptyContent: {
    gap: 8,
  },
  emptyText: {
    color: '#5b6663',
  },
  headerCard: {
    borderRadius: 24,
    backgroundColor: '#dff4ef',
  },
  headerContent: {
    gap: 12,
  },
  headerCopy: {
    color: '#3a4c47',
  },
  detailCard: {
    borderRadius: 22,
  },
  sectionContent: {
    gap: 12,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#5b6764',
  },
  detailValue: {
    color: '#14211f',
  },
  noteText: {
    color: '#31403c',
    fontSize: 18,
    lineHeight: 27,
  },
  primaryActionContent: {
    minHeight: 54,
  },
  pendingChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffe2de',
  },
  acknowledgedChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#dce9ff',
  },
  completedChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#d8f2db',
  },
});
