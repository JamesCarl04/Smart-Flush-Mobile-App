import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Card, Chip, Snackbar, Text } from 'react-native-paper';

import { useTasks } from '../hooks/useTasks';
import { formatTaskStatus, formatTaskTrigger } from '../lib/tasks';
import type { InboxStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxHome'>;
type InboxFilter = 'all' | 'pending' | 'acknowledged';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStatusChipStyle(status: Task['status']): object {
  if (status === 'acknowledged') {
    return styles.acknowledgedChip;
  }

  return styles.pendingChip;
}

function EmptyState(): React.JSX.Element {
  return (
    <Card mode="contained" style={styles.emptyCard}>
      <Card.Content>
        <Text variant="titleMedium">Inbox is clear</Text>
        <Text variant="bodyMedium" style={styles.emptyText}>
          New maintenance alerts will show up here as soon as the IoT system
          assigns them to you. The Task Detail screen opens from any inbox task.
        </Text>
      </Card.Content>
    </Card>
  );
}

export function InboxScreen({ navigation }: Props): React.JSX.Element {
  const {
    inboxTasks,
    pendingCount,
    loading,
    errorMessage,
    clearError,
  } = useTasks();
  const acknowledgedCount = inboxTasks.filter(
    (task) => task.status === 'acknowledged',
  ).length;
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const visibleTasks = useMemo(
    () =>
      activeFilter === 'all'
        ? inboxTasks
        : inboxTasks.filter((task) => task.status === activeFilter),
    [activeFilter, inboxTasks],
  );

  const handleRefresh = (): void => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Notification inbox
            </Text>
            <Text variant="bodyMedium" style={styles.headerDescription}>
              Dashboard notes and cleaning tasks arrive here in real time.
            </Text>
            <View style={styles.summaryRow}>
              <Card
                mode="contained"
                style={[styles.summaryCard, styles.summaryTeal]}
              >
                <Card.Content>
                  <Text variant="labelLarge">Pending</Text>
                  <Text variant="displaySmall">{pendingCount}</Text>
                </Card.Content>
              </Card>
              <Card
                mode="contained"
                style={[styles.summaryCard, styles.summaryBlue]}
              >
                <Card.Content>
                  <Text variant="labelLarge">Acknowledged</Text>
                  <Text variant="displaySmall">{acknowledgedCount}</Text>
                </Card.Content>
              </Card>
            </View>
            <View style={styles.filterRow}>
              <Chip
                selected={activeFilter === 'all'}
                onPress={() => setActiveFilter('all')}
              >
                All
              </Chip>
              <Chip
                selected={activeFilter === 'pending'}
                onPress={() => setActiveFilter('pending')}
              >
                Pending
              </Chip>
              <Chip
                selected={activeFilter === 'acknowledged'}
                onPress={() => setActiveFilter('acknowledged')}
              >
                Acknowledged
              </Chip>
            </View>
          </View>
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        renderItem={({ item }) => (
          <Card mode="elevated" style={styles.taskCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.titleBlock}>
                  <Text variant="titleMedium">Restroom {item.deviceId}</Text>
                  <Text variant="bodySmall" style={styles.timeLabel}>
                    Created {formatDate(item.createdAt)}
                  </Text>
                </View>
                <Chip compact style={getStatusChipStyle(item.status)}>
                  {formatTaskStatus(item.status)}
                </Chip>
              </View>
              <Text variant="labelMedium" style={styles.triggerLabel}>
                {formatTaskTrigger(item.triggerType)}
              </Text>
              <Text variant="bodyMedium" style={styles.noteText}>
                {item.message}
              </Text>
              <Text variant="labelSmall" style={styles.openHint}>
                Tap to view instructions and update status
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained-tonal"
                onPress={() =>
                  navigation.navigate('TaskDetail', { taskId: item.id })
                }
              >
                Open Task Detail
              </Button>
            </Card.Actions>
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 24,
  },
  summaryTeal: {
    backgroundColor: '#dff4ef',
  },
  summaryBlue: {
    backgroundColor: '#e0ebff',
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
  openHint: {
    color: '#5f6c68',
  },
  triggerLabel: {
    color: '#127369',
    fontWeight: '700',
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
    backgroundColor: '#ffe2de',
  },
  acknowledgedChip: {
    backgroundColor: '#dce9ff',
  },
});
