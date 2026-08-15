import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Card, Chip, Snackbar, Text } from 'react-native-paper';

import {
  EmptyOperationState,
  MetaPill,
  OperationBadge,
  UI_COLORS,
  sharedShadow,
  statusTone,
  urgencyTone,
} from '../components/MaintenanceUI';
import { useTasks } from '../hooks/useTasks';
import { getRestroomLabel } from '../lib/restrooms';
import { formatTaskStatus } from '../lib/tasks';
import type { InboxStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxHome'>;
type InboxFilter = 'all' | 'active' | 'acknowledged';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function EmptyState(): React.JSX.Element {
  return (
    <EmptyOperationState
      icon="shield-check-outline"
      title="No pending tasks"
      body="You are all caught up for now. New restroom alerts will appear here as soon as the IoT system assigns them to you."
    />
  );
}

function LoadingCards(): React.JSX.Element {
  return (
    <View style={styles.loadingList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.loadingCard}>
          <View style={styles.loadingLineShort} />
          <View style={styles.loadingLineWide} />
          <View style={styles.loadingLineMid} />
        </View>
      ))}
    </View>
  );
}

export function InboxScreen({ navigation }: Props): React.JSX.Element {
  const {
    inboxTasks,
    pendingCount,
    loading,
    errorMessage,
    refreshTasks,
    clearError,
  } = useTasks();
  const acknowledgedCount = inboxTasks.filter(
    (task) => task.status === 'acknowledged',
  ).length;
  const urgentTask =
    inboxTasks.find((task) => task.status === 'reassignment_needed') ??
    inboxTasks.find((task) => task.status === 'unassigned') ??
    inboxTasks.find((task) => task.status === 'assigned') ??
    null;
  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const visibleTasks = useMemo(
    () =>
      activeFilter === 'all'
        ? inboxTasks
        : activeFilter === 'active'
          ? inboxTasks.filter(
              (task) =>
                task.status === 'assigned' ||
                task.status === 'unassigned' ||
                task.status === 'reassignment_needed',
            )
          : inboxTasks.filter((task) => task.status === activeFilter),
    [activeFilter, inboxTasks],
  );

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  };

  const openTaskDetail = (taskId: string): void => {
    navigation.navigate('TaskDetail', { taskId });
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.commandHeader}>
              <View style={styles.onDutyPill}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>On Duty</Text>
              </View>
              <Text variant="headlineSmall" style={styles.headerTitle}>
                Today's Tasks
              </Text>
              <Text variant="bodyMedium" style={styles.headerDescription}>
                Review assigned restroom alerts and open the next task that needs action.
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Card mode="contained" style={styles.summaryCard}>
                <Card.Content style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Pending</Text>
                  <Text style={styles.summaryValue}>{pendingCount}</Text>
                </Card.Content>
              </Card>
              <Card mode="contained" style={styles.summaryCardAlt}>
                <Card.Content style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>In Progress</Text>
                  <Text style={styles.summaryValue}>{acknowledgedCount}</Text>
                </Card.Content>
              </Card>
            </View>
            {urgentTask ? (
              <Card mode="contained" style={styles.urgentCard}>
                <Card.Content style={styles.urgentContent}>
                  <OperationBadge
                    label={urgencyTone(urgentTask.status).label}
                    tone={urgencyTone(urgentTask.status)}
                  />
                  <Text variant="titleLarge" style={styles.urgentTitle}>
                    {getRestroomLabel(urgentTask)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.urgentMeta}>
                    {urgentTask.building} - {urgentTask.floor} - {urgentTask.location}
                  </Text>
                  <Text variant="bodyMedium" style={styles.urgentMessage}>
                    {urgentTask.message}
                  </Text>
                  <Button
                    mode="contained"
                    onPress={() => openTaskDetail(urgentTask.id)}
                    contentStyle={styles.actionButtonContent}
                    icon="arrow-right"
                  >
                    Open Priority Task
                  </Button>
                </Card.Content>
              </Card>
            ) : null}
            <View style={styles.filterRow}>
              <Chip
                selected={activeFilter === 'all'}
                style={styles.filterChip}
                onPress={() => setActiveFilter('all')}
              >
                All
              </Chip>
              <Chip
                selected={activeFilter === 'active'}
                style={styles.filterChip}
                onPress={() => setActiveFilter('active')}
              >
                Active
              </Chip>
              <Chip
                selected={activeFilter === 'acknowledged'}
                style={styles.filterChip}
                onPress={() => setActiveFilter('acknowledged')}
              >
                Acknowledged
              </Chip>
            </View>
          </View>
        }
        ListEmptyComponent={loading ? <LoadingCards /> : <EmptyState />}
        renderItem={({ item }) => (
          <Card mode="contained" style={styles.taskCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.titleBlock}>
                  <OperationBadge
                    label={urgencyTone(item.status).label}
                    tone={urgencyTone(item.status)}
                  />
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    {item.building}
                  </Text>
                  <Text variant="titleMedium" style={styles.locationText}>
                    {item.floor} - {item.location}
                  </Text>
                  <Text variant="bodySmall" style={styles.timeLabel}>
                    Reported {formatDate(item.createdAt)}
                  </Text>
                </View>
                <OperationBadge
                  label={formatTaskStatus(item.status)}
                  tone={statusTone(item.status)}
                />
              </View>
              <Text variant="bodyMedium" style={styles.noteText}>
                {item.message}
              </Text>
              <View style={styles.metaRow}>
                <MetaPill icon="toilet" label={getRestroomLabel(item)} />
                <MetaPill icon="clipboard-text-clock-outline" label={item.type} />
              </View>
            </Card.Content>
            <Card.Actions style={styles.cardActions}>
              <Button
                mode="contained"
                onPress={() => openTaskDetail(item.id)}
                contentStyle={styles.actionButtonContent}
                icon="clipboard-arrow-right-outline"
              >
                View Details
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
    backgroundColor: UI_COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 34,
    gap: 14,
    backgroundColor: UI_COLORS.background,
    flexGrow: 1,
  },
  headerBlock: {
    gap: 16,
    marginBottom: 8,
  },
  commandHeader: {
    gap: 8,
  },
  onDutyPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: UI_COLORS.softGreen,
  },
  onDutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI_COLORS.success,
  },
  onDutyText: {
    color: UI_COLORS.success,
    fontWeight: '800',
  },
  headerTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  headerDescription: {
    color: UI_COLORS.muted,
    lineHeight: 22,
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
  filterChip: {
    minHeight: 40,
    borderRadius: 999,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  summaryCardAlt: {
    flex: 1,
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
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  summaryValue: {
    color: UI_COLORS.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  urgentCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: '#FED7AA',
    ...sharedShadow,
  },
  urgentContent: {
    gap: 10,
  },
  urgentTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  urgentMeta: {
    color: UI_COLORS.primaryStrong,
    fontWeight: '800',
  },
  urgentMessage: {
    color: UI_COLORS.muted,
    lineHeight: 22,
  },
  taskCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  cardContent: {
    gap: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  locationText: {
    color: UI_COLORS.primaryStrong,
    fontWeight: '800',
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
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionButtonContent: {
    minHeight: 48,
  },
  loadingList: {
    gap: 12,
  },
  loadingCard: {
    height: 138,
    padding: 16,
    gap: 14,
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  loadingLineShort: {
    width: '34%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
  },
  loadingLineWide: {
    width: '80%',
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  loadingLineMid: {
    width: '56%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
  },
});
