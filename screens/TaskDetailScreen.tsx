import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Text,
} from 'react-native-paper';

import { db } from '../lib/firebase';
import { formatTaskStatus, parseTaskDocument } from '../lib/tasks';
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
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'tasks', route.params.taskId),
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
      },
    );

    return unsubscribe;
  }, [route.params.taskId]);

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
    <ScrollView contentContainerStyle={styles.contentContainer}>
      <Card mode="contained" style={styles.headerCard}>
        <Card.Content style={styles.headerContent}>
          <Text variant="titleLarge">Toilet {task.toiletId}</Text>
          <Text variant="bodyMedium" style={styles.headerCopy}>
            Review the alert timeline and assignment details before starting the
            maintenance job.
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
          <DetailRow label="Assigned to" value={task.assignedTo} />
          <Divider />
          <DetailRow label="Triggered by" value={task.triggeredBy} />
          <Divider />
          <DetailRow label="Triggered at" value={formatDate(task.triggeredAt)} />
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
          <Text variant="titleMedium">Maintenance note</Text>
          <Text variant="bodyLarge" style={styles.noteText}>
            {task.note ?? 'No note was attached to this task.'}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
