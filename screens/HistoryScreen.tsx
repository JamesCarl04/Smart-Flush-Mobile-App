import { FlatList, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Card, Chip, Snackbar, Text, TextInput } from 'react-native-paper';

import {
  EmptyOperationState,
  MetaPill,
  OperationBadge,
  UI_COLORS,
  sharedShadow,
  statusTone,
} from '../components/MaintenanceUI';
import { useTasks } from '../hooks/useTasks';
import { getRestroomLabel } from '../lib/restrooms';
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

function formatDuration(seconds?: number | null): string {
  if (!seconds) {
    return 'N/A';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} sec`;
}

function EmptyState(): React.JSX.Element {
  return (
    <EmptyOperationState
      icon="clipboard-check-multiple-outline"
      title="No completed tasks yet"
      body="Completed restroom work will appear here after proof photos and checklist submissions are closed out."
    />
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
        getRestroomLabel(task).toLowerCase().includes(normalizedQuery) ||
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
              Completed Work
            </Text>
            <Text variant="bodyMedium" style={styles.headerDescription}>
              Search verified restroom jobs and review submitted proof.
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
              <Card.Content style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Tasks Completed</Text>
                <Text style={styles.summaryValue}>{completedCount}</Text>
              </Card.Content>
            </Card>
          </View>
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        renderItem={({ item }) => (
          <Card
            mode="contained"
            style={styles.taskCard}
            onPress={() =>
              navigation.navigate('TaskDetail', { taskId: item.id })
            }
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.titleBlock}>
                  <OperationBadge
                    label={formatTaskStatus(item.status)}
                    tone={statusTone(item.status)}
                  />
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    {getRestroomLabel(item)}
                  </Text>
                  <Text variant="bodySmall" style={styles.timeLabel}>
                    Finished {formatDate(item.completedAt ?? item.createdAt)}
                  </Text>
                </View>
                <MetaPill
                  icon="timer-check-outline"
                  label={formatDuration(item.workDuration)}
                />
              </View>
              <Text variant="bodyMedium" style={styles.noteText}>
                {item.type} - {item.component} - {item.location}, {item.floor}, {item.building}
              </Text>
              <View style={styles.metaRow}>
                <MetaPill icon="image-check-outline" label="Proof submitted" />
                {item.offlineSynced ? (
                  <MetaPill icon="cloud-check-outline" label="Offline synced" />
                ) : null}
              </View>
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
    backgroundColor: UI_COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: UI_COLORS.background,
    flexGrow: 1,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 8,
  },
  headerTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  headerDescription: {
    color: UI_COLORS.muted,
    lineHeight: 22,
  },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  summaryContent: {
    gap: 6,
  },
  summaryLabel: {
    color: UI_COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: UI_COLORS.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taskCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  cardContent: {
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  timeLabel: {
    color: UI_COLORS.muted,
  },
  noteText: {
    color: UI_COLORS.text,
    fontSize: 16,
    lineHeight: 23,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
