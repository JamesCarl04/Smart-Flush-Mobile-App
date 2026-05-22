import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Snackbar,
  Text,
} from 'react-native-paper';

import { auth, db } from '../lib/firebase';
import {
  formatTaskStatus,
  formatTaskTrigger,
  parseTaskDocument,
} from '../lib/tasks';
import { acknowledgeTask, completeTask, fetchTask } from '../lib/task-api';
import { useTasks } from '../hooks/useTasks';
import type {
  HistoryStackParamList,
  InboxStackParamList,
  Task,
} from '../types';

type Props =
  | NativeStackScreenProps<InboxStackParamList, 'TaskDetail'>
  | NativeStackScreenProps<HistoryStackParamList, 'TaskDetail'>;

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

export function TaskDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { refreshTasks } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<
    'acknowledge' | 'complete' | null
  >(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const taskId = route.params.taskId;

  const refreshTaskDetail = useCallback(async (): Promise<void> => {
    try {
      const apiTask = await fetchTask(taskId);
      setTask(apiTask);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Unable to refresh task details. Check your connection and try again.',
      );
    }
  }, [taskId]);

  useEffect(() => {
    void refreshTaskDetail();
    const intervalId = setInterval(() => {
      void refreshTaskDetail();
    }, 10000);

    const unsubscribe = onSnapshot(
      doc(db, 'tasks', taskId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setTask(null);
          setLoading(false);
          return;
        }

        setTask(parseTaskDocument(snapshot.id, snapshot.data()));
        setLoading(false);
      },
      (error) => {
        console.warn('Failed to load task details', error);
        setTask(null);
        setLoading(false);
        setSnackbarMessage(
          'Unable to refresh task details. Check your connection and try again.',
        );
      },
    );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [refreshTaskDetail, taskId]);

  const handleAcknowledge = async (): Promise<void> => {
    if (!task || actionInFlight) {
      return;
    }

    setActionInFlight('acknowledge');

    try {
      await acknowledgeTask(task.id);
      await refreshTasks();
      await refreshTaskDetail();
      setTask((currentTask) =>
        currentTask
          ? {
              ...currentTask,
              status: 'acknowledged',
              assignedTo: auth.currentUser?.uid ?? currentTask.assignedTo,
              acknowledgedAt: new Date(),
            }
          : currentTask,
      );
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
    if (!task || actionInFlight) {
      return;
    }

    setActionInFlight('complete');

    try {
      await completeTask(task.id);
      await refreshTasks();
      await refreshTaskDetail();
      setTask((currentTask) =>
        currentTask
          ? {
              ...currentTask,
              status: 'completed',
              completedAt: new Date(),
            }
          : currentTask,
      );
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
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge">Loading task details...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.loadingState}>
        <Text variant="titleMedium">Task not found</Text>
        <Text variant="bodyMedium" style={styles.missingCopy}>
          This task may have been removed or is no longer assigned to your
          account.
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card mode="contained" style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <Text variant="titleLarge">Restroom {task.deviceId}</Text>
            <Text variant="bodyMedium" style={styles.headerCopy}>
              Read the instruction, acknowledge when you are on the way, then
              mark it complete after cleaning.
            </Text>
            <Chip compact style={getStatusChipStyle(task.status)}>
              {formatTaskStatus(task.status)}
            </Chip>
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.detailCard}>
          <Card.Content style={styles.sectionContent}>
            <DetailRow label="Task ID" value={task.id} />
            <Divider />
            <DetailRow label="Assigned to" value={task.assignedTo ?? 'Unassigned'} />
            <Divider />
            <DetailRow
              label="Trigger"
              value={formatTaskTrigger(task.triggerType)}
            />
            <Divider />
            <DetailRow label="Created at" value={formatDate(task.createdAt)} />
            <Divider />
            <DetailRow
              label="Acknowledged at"
              value={formatDate(task.acknowledgedAt)}
            />
            <Divider />
            <DetailRow
              label="Completed at"
              value={formatDate(task.completedAt)}
            />
          </Card.Content>
        </Card>

        <Card mode="elevated" style={styles.detailCard}>
          <Card.Content style={styles.sectionContent}>
            <Text variant="titleMedium">Cleaning instruction</Text>
            <Text variant="bodyLarge" style={styles.noteText}>
              {task.message}
            </Text>
          </Card.Content>
        </Card>

        {task.status === 'pending' ? (
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

        {task.status === 'acknowledged' ? (
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

        {task.status === 'completed' ? (
          <Card mode="contained" style={styles.completedNotice}>
            <Card.Content>
              <Text variant="titleMedium">Completed</Text>
              <Text variant="bodyMedium" style={styles.completedNoticeText}>
                This job is saved in Cleaning History.
              </Text>
            </Card.Content>
          </Card>
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
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f3faf8',
  },
  missingCopy: {
    textAlign: 'center',
    color: '#586562',
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
  completedNotice: {
    borderRadius: 22,
    backgroundColor: '#d8f2db',
  },
  completedNoticeText: {
    marginTop: 4,
    color: '#3f4f49',
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
