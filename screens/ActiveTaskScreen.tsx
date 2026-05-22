import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Snackbar,
  Text,
} from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { acknowledgeTask, completeTask } from '../lib/task-api';
import { formatTaskStatus, formatTaskTrigger } from '../lib/tasks';
import type { MainTabParamList, Task } from '../types';

type Props = BottomTabScreenProps<MainTabParamList, 'TaskTab'>;

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
  const { tasks, inboxTasks, loading, refreshTasks } = useTasks();
  const [actionInFlight, setActionInFlight] = useState<
    'acknowledge' | 'complete' | null
  >(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const selectedTaskId = route.params?.taskId;
  const activeTask = useMemo(() => {
    const selectedTask = selectedTaskId
      ? tasks.find((task) => task.id === selectedTaskId)
      : null;

    if (selectedTask) {
      return selectedTask;
    }

    return (
      inboxTasks.find((task) => task.status === 'pending') ??
      inboxTasks.find((task) => task.status === 'acknowledged') ??
      null
    );
  }, [inboxTasks, selectedTaskId, tasks]);

  const handleAcknowledge = async (): Promise<void> => {
    if (!activeTask || actionInFlight) {
      return;
    }

    setActionInFlight('acknowledge');

    try {
      await acknowledgeTask(activeTask.id);
      await refreshTasks();
      setSnackbarMessage('Task acknowledged.');
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Failed to acknowledge task. Please try again.',
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!activeTask || actionInFlight) {
      return;
    }

    setActionInFlight('complete');

    try {
      await completeTask(activeTask.id);
      await refreshTasks();
      setSnackbarMessage('Task marked complete.');
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Failed to complete task. Please try again.',
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const confirmComplete = (): void => {
    Alert.alert(
      'Mark task complete?',
      'Only complete this task after the restroom has been cleaned and checked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            void handleComplete();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge">Loading active task...</Text>
      </View>
    );
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
            <Text variant="titleLarge">Restroom {activeTask.deviceId}</Text>
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
              value={activeTask.assignedTo ?? 'All maintenance staff'}
            />
            <Divider />
            <DetailRow
              label="Trigger"
              value={formatTaskTrigger(activeTask.triggerType)}
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

        {activeTask.status === 'pending' ? (
          <Button
            mode="contained"
            loading={actionInFlight === 'acknowledge'}
            disabled={actionInFlight !== null}
            onPress={() => {
              void handleAcknowledge();
            }}
            contentStyle={styles.primaryActionContent}
          >
            Acknowledge Task
          </Button>
        ) : null}

        {activeTask.status === 'acknowledged' ? (
          <Button
            mode="contained"
            loading={actionInFlight === 'complete'}
            disabled={actionInFlight !== null}
            onPress={confirmComplete}
            contentStyle={styles.primaryActionContent}
          >
            Mark as Completed
          </Button>
        ) : null}
      </ScrollView>
      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
      >
        {snackbarMessage ?? ''}
      </Snackbar>
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
