import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Card, Chip, Snackbar, Text, TextInput } from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { formatTaskStatus } from '../lib/tasks';
import type { HistoryStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryHome'>;
type HistoryRange = 'today' | 'week' | 'all';

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
  const { historyTasks, loading, errorMessage, clearError } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRange, setSelectedRange] = useState<HistoryRange>('week');
  const visibleHistory = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return historyTasks.filter((task) => {
      const completedAt = task.completedAt ?? task.createdAt;
      const matchesRange =
        selectedRange === 'all' ||
        (selectedRange === 'today' && completedAt >= startOfToday) ||
        (selectedRange === 'week' && completedAt >= sevenDaysAgo);
      const matchesSearch =
        !normalizedQuery ||
        task.deviceId.toLowerCase().includes(normalizedQuery) ||
        task.message.toLowerCase().includes(normalizedQuery);

      return matchesRange && matchesSearch;
    });
  }, [historyTasks, searchQuery, selectedRange]);
  const completedCount = visibleHistory.length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Cleaning history
            </Text>
            <Text variant="bodyMedium" style={styles.headerDescription}>
              Review completed jobs and search by restroom or instruction.
            </Text>
            <TextInput
              label="Search completed jobs"
              value={searchQuery}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
              onChangeText={setSearchQuery}
            />
            <View style={styles.filterRow}>
              <Chip
                selected={selectedRange === 'today'}
                onPress={() => setSelectedRange('today')}
              >
                Today
              </Chip>
              <Chip
                selected={selectedRange === 'week'}
                onPress={() => setSelectedRange('week')}
              >
                7 days
              </Chip>
              <Chip
                selected={selectedRange === 'all'}
                onPress={() => setSelectedRange('all')}
              >
                All
              </Chip>
            </View>
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
            onPress={() =>
              navigation.navigate('TaskDetail', { taskId: item.id })
            }
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.titleBlock}>
                  <Text variant="titleMedium">Restroom {item.deviceId}</Text>
                  <Text variant="bodySmall" style={styles.timeLabel}>
                    Completed {formatDate(item.completedAt ?? item.createdAt)}
                  </Text>
                </View>
                <Chip compact style={getStatusChipStyle(item.status)}>
                  {formatTaskStatus(item.status)}
                </Chip>
              </View>
              <Text variant="bodyMedium" style={styles.noteText}>
                {item.message}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
      <Snackbar visible={errorMessage !== null} onDismiss={clearError}>
        {errorMessage ?? ''}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    fontSize: 16,
    lineHeight: 23,
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
