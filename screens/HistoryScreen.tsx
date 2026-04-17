import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card, Chip, Text } from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { formatTaskStatus } from '../lib/tasks';
import type { HistoryStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryHome'>;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
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

function EmptyState(): React.JSX.Element {
  return (
    <Card mode="contained" style={styles.emptyCard}>
      <Card.Content>
        <Text variant="titleMedium">No completed tasks yet</Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          Completed maintenance work will appear here once tasks are closed out.
        </Text>
      </Card.Content>
    </Card>
  );
}

export function HistoryScreen({ navigation }: Props): React.JSX.Element {
  const { historyTasks, loading } = useTasks();
  const completedCount = historyTasks.length;

  return (
    <FlatList
      data={historyTasks}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.contentContainer}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Completed maintenance
          </Text>
          <Text variant="bodyMedium" style={styles.headerDescription}>
            Review the work your team has already resolved across the Smart
            Toilet network.
          </Text>
          <Card mode="contained" style={styles.summaryCard}>
            <Card.Content>
              <Text variant="labelLarge">Tasks completed</Text>
              <Text variant="displaySmall">{completedCount}</Text>
            </Card.Content>
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState /> : null}
      renderItem={({ item }) => (
        <Card
          mode="elevated"
          style={styles.taskCard}
          onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.titleBlock}>
                <Text variant="titleMedium">Toilet {item.toiletId}</Text>
                <Text variant="bodySmall" style={styles.timeLabel}>
                  Completed {formatDate(item.completedAt ?? item.triggeredAt)}
                </Text>
              </View>
              <Chip compact style={getStatusChipStyle(item.status)}>
                {formatTaskStatus(item.status)}
              </Chip>
            </View>
            <Text variant="bodyMedium" style={styles.noteText}>
              {item.note ?? 'No maintenance note was attached to this task.'}
            </Text>
          </Card.Content>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: '#f3faf8',
    flexGrow: 1,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#11201d',
  },
  headerDescription: {
    color: '#52605c',
  },
  summaryCard: {
    borderRadius: 24,
    backgroundColor: '#dff4ef',
  },
  taskCard: {
    borderRadius: 22,
  },
  cardContent: {
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  timeLabel: {
    color: '#65736f',
  },
  noteText: {
    color: '#31403c',
  },
  emptyCard: {
    marginTop: 12,
    borderRadius: 22,
    backgroundColor: '#ffffff',
  },
  emptyText: {
    marginTop: 8,
    color: '#5b6663',
  },
  pendingChip: {
    backgroundColor: '#f9d8d6',
  },
  acknowledgedChip: {
    backgroundColor: '#dce9ff',
  },
  completedChip: {
    backgroundColor: '#d8f2db',
  },
});
