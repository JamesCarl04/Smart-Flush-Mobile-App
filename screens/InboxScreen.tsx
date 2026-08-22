import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useContext, useMemo, useState } from 'react';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import {
  AssigneeAvatarCluster,
  EmptyOperationState,
  KLIR_RADII,
  MetaPill,
  OperationBadge,
  SegmentedFilterControl,
  UI_COLORS,
  getComponentMeta,
  getTaskDisplayTone,
  getTaskPriority,
  sharedShadow,
  statusTone,
  taskPriorityTone,
  taskTriggerTone,
  urgencyTone,
} from '../components/MaintenanceUI';
import { TaskExecutionModal } from '../components/TaskExecutionModal';
import { AuthContext } from '../contexts/AuthContext';
import { useTasks } from '../hooks/useTasks';
import { acknowledgeTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { formatTaskStatus, getTaskDisplayStatus } from '../lib/tasks';
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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
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
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
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

  const priorityTask =
    inboxTasks.find((task) => getTaskPriority(task) === 'critical') ??
    inboxTasks.find((task) => getTaskPriority(task) === 'high') ??
    null;

  const [activeFilter, setActiveFilter] = useState<InboxFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const visibleTasks = useMemo(() => {
    const baseTasks =
      activeFilter === 'all'
        ? inboxTasks
        : activeFilter === 'active'
          ? inboxTasks.filter(
              (task) =>
                task.status === 'assigned' ||
                task.status === 'unassigned' ||
                task.status === 'reassignment_needed',
            )
          : inboxTasks.filter((task) => task.status === activeFilter);

    if (priorityTask && activeFilter !== 'acknowledged') {
      return baseTasks.filter((task) => task.id !== priorityTask.id);
    }

    return baseTasks;
  }, [activeFilter, inboxTasks, priorityTask]);

  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);

  const handleStartTask = async (task: Task): Promise<void> => {
    if (task.status === 'acknowledged') {
      setExecutingTask(task);
      return;
    }

    setActionInFlightId(task.id);
    try {
      await acknowledgeTask(task.id);
      await refreshTasks();
      setExecutingTask({
        ...task,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      });
    } catch {
      // Handled by refresh error
    } finally {
      setActionInFlightId(null);
    }
  };

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
            {/* Duty Status Row */}
            <View style={styles.dutyHeaderRow}>
              <View style={styles.onDutyPill}>
                <View style={styles.onDutyDot} />
                <Text style={styles.onDutyText}>On Duty</Text>
              </View>
              <View style={styles.shiftPill}>
                <MaterialCommunityIcons
                  name="clock-time-four-outline"
                  size={12}
                  color={UI_COLORS.muted}
                  accessibilityElementsHidden={true}
                  importantForAccessibility="no"
                />
                <Text style={styles.shiftLabel}>
                  {user?.shift ?? '1st Shift'}
                </Text>
              </View>
            </View>

            {/* Context Headline & Subtitle */}
            <View style={styles.titleWrapper}>
              <Text variant="headlineSmall" style={styles.headerTitle}>
                Today's Tasks
              </Text>
              <Text variant="bodyMedium" style={styles.headerDescription}>
                Review assigned tasks and open the next job that needs action.
              </Text>
            </View>

            {/* Summary Metrics */}
            <View style={styles.summaryRow}>
              <Card mode="contained" style={styles.summaryCard}>
                <Card.Content style={styles.summaryContent}>
                  <View style={styles.summaryHeader}>
                    <MaterialCommunityIcons
                      name="clipboard-alert-outline"
                      size={18}
                      color="#B5121B"
                      accessibilityElementsHidden={true}
                      importantForAccessibility="no"
                    />
                    <Text style={styles.summaryLabel}>Pending</Text>
                  </View>
                  <Text style={styles.summaryValue}>{pendingCount}</Text>
                </Card.Content>
              </Card>

              <Card mode="contained" style={styles.summaryCardAlt}>
                <Card.Content style={styles.summaryContent}>
                  <View style={styles.summaryHeader}>
                    <MaterialCommunityIcons
                      name="progress-clock"
                      size={18}
                      color="#C9A227"
                      accessibilityElementsHidden={true}
                      importantForAccessibility="no"
                    />
                    <Text style={styles.summaryLabel}>In Progress</Text>
                  </View>
                  <Text style={styles.summaryValue}>{acknowledgedCount}</Text>
                </Card.Content>
              </Card>
            </View>

            {/* Priority Alert Callout */}
            {priorityTask && activeFilter !== 'acknowledged' ? (
              <Card
                mode="contained"
                style={styles.urgentCard}
                onPress={() => openTaskDetail(priorityTask.id)}
              >
                <Card.Content style={styles.urgentContent}>
                  <View style={styles.urgentHeaderRow}>
                    <View style={styles.badgeRow}>
                      <OperationBadge
                        label={taskPriorityTone(getTaskPriority(priorityTask)).label}
                        tone={taskPriorityTone(getTaskPriority(priorityTask))}
                      />
                      <View style={styles.shiftPill}>
                        <MaterialCommunityIcons
                          name="clock-time-four-outline"
                          size={12}
                          color="#666666"
                          accessibilityElementsHidden={true}
                          importantForAccessibility="no"
                        />
                        <Text style={styles.shiftPillText}>
                          {`${priorityTask.shift ?? '1st'} Shift`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priorityAlertTag}>
                      <MaterialCommunityIcons
                        name="alert-decagram"
                        size={13}
                        color="#B5121B"
                        accessibilityElementsHidden={true}
                        importantForAccessibility="no"
                      />
                      <Text style={styles.priorityAlertTagText}>
                        {getTaskPriority(priorityTask) === 'critical' ? 'CRITICAL' : 'HIGH PRIORITY'}
                      </Text>
                    </View>
                  </View>

                  <Text variant="titleLarge" style={styles.urgentTitle}>
                    {getRestroomLabel(priorityTask)}
                  </Text>
                  <Text variant="bodyMedium" style={styles.urgentLocationBreadcrumb}>
                    {`${priorityTask.floor} • ${priorityTask.location} • ${priorityTask.building}`}
                  </Text>
                  <Text variant="bodyMedium" style={styles.urgentMessage}>
                    {priorityTask.message}
                  </Text>

                  <View style={styles.metaRow}>
                    <MetaPill
                      icon={getComponentMeta(priorityTask.component).icon}
                      label={getComponentMeta(priorityTask.component).label}
                    />
                    <MetaPill
                      icon="clock-outline"
                      label={formatRelativeTime(priorityTask.createdAt)}
                    />
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <AssigneeAvatarCluster task={priorityTask} />
                  </View>

                  <Button
                    mode="contained"
                    onPress={() => openTaskDetail(priorityTask.id)}
                    contentStyle={styles.actionButtonContent}
                    style={styles.urgentActionButton}
                    icon="arrow-right"
                  >
                    Open Priority Task
                  </Button>
                </Card.Content>
              </Card>
            ) : null}

            {/* Segmented Filter Control */}
            <SegmentedFilterControl<InboxFilter>
              items={[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'acknowledged', label: 'Acknowledged' },
              ]}
              activeKey={activeFilter}
              onChange={setActiveFilter}
            />
          </View>
        }
        ListEmptyComponent={loading ? <LoadingCards /> : <EmptyState />}
        renderItem={({ item }) => (
          <Card
            mode="elevated"
            style={styles.taskCard}
            onPress={() => openTaskDetail(item.id)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${getRestroomLabel(item)}, ${item.floor} ${item.location}. Status: ${item.status}. ${
              item.triggerType === 'hardware_failure' ? 'Urgent hardware failure alert.' : ''
            }`}
            accessibilityHint="Double tap to view details or start task"
          >
            <Card.Content style={styles.cardContent}>
              {/* Status & SLA Header Row */}
              <View style={styles.cardStatusRow}>
                <View style={styles.badgeRow}>
                  <OperationBadge
                    label={getTaskDisplayStatus(item)}
                    tone={getTaskDisplayTone(item)}
                  />
                  {item.triggerType === 'hardware_failure' ? (
                    <OperationBadge
                      label="Hardware Alert"
                      tone={taskTriggerTone('hardware_failure')}
                    />
                  ) : null}
                </View>
                <View style={styles.relativeTimeBadge}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={12}
                    color={UI_COLORS.muted}
                  />
                  <Text style={styles.relativeTimeText}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Primary Headline & Location Subtitle Breadcrumb */}
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardHeadline}>
                  {getRestroomLabel(item)}
                </Text>
                <Text style={styles.locationBreadcrumb}>
                  {`${item.floor} • ${item.location} • ${item.building}`}
                </Text>
              </View>

              {/* Task Issue Message */}
              <Text variant="bodyMedium" style={styles.noteText}>
                {item.message}
              </Text>

              {/* Non-redundant Specific Tags Row */}
              <View style={styles.metaRow}>
                <MetaPill
                  icon={getComponentMeta(item.component).icon}
                  label={getComponentMeta(item.component).label}
                />
                {item.type === 'cleaning' ? (
                  <MetaPill icon="broom" label="Cleaning" />
                ) : null}
              </View>

              <View style={{ marginTop: 10 }}>
                <AssigneeAvatarCluster task={item} currentUserId={user?.uid} />
              </View>
            </Card.Content>

            {/* Tactile Full-width View Details Action */}
            <Card.Actions style={styles.cardActions}>
              <Button
                mode="contained"
                loading={actionInFlightId === item.id}
                disabled={actionInFlightId === item.id}
                onPress={() => void handleStartTask(item)}
                contentStyle={styles.actionButtonContent}
                style={styles.taskActionButton}
                textColor="#FFFFFF"
                labelStyle={styles.taskActionLabel}
                theme={{
                  colors: {
                    primary: '#B5121B',
                    onPrimary: '#FFFFFF',
                    surfaceDisabled: '#B5121B',
                    onSurfaceDisabled: '#FFFFFF',
                  },
                }}
                icon={
                  item.status === 'acknowledged' ||
                  (user?.uid && Boolean(item.acknowledgedBy?.[user.uid]))
                    ? 'camera-outline'
                    : 'clipboard-check-outline'
                }
              >
                {item.status === 'acknowledged' ||
                (user?.uid && Boolean(item.acknowledgedBy?.[user.uid]))
                  ? 'Resume Task & Open Camera'
                  : 'Acknowledge & Start'}
              </Button>
            </Card.Actions>
          </Card>
        )}
      />

      {/* Slide-Up Task Execution Modal */}
      <TaskExecutionModal
        visible={executingTask !== null}
        task={executingTask}
        onDismiss={() => setExecutingTask(null)}
        onTaskCompleted={() => {
          void refreshTasks();
        }}
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
  dutyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onDutyPill: {
    minHeight: 26,
    borderRadius: KLIR_RADII.tag,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  onDutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UI_COLORS.success,
  },
  onDutyText: {
    color: UI_COLORS.successText,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  shiftLabel: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 11,
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
  summaryCard: {
    flex: 1,
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  summaryCardAlt: {
    flex: 1,
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  summaryContent: {
    gap: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  urgentCard: {
    borderRadius: KLIR_RADII.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: UI_COLORS.danger,
    ...sharedShadow,
  },
  urgentContent: {
    gap: 10,
  },
  urgentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityAlertTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: KLIR_RADII.sm,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  priorityAlertTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B5121B',
    letterSpacing: 0.5,
  },
  urgentTitle: {
    color: UI_COLORS.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  urgentLocationBreadcrumb: {
    color: UI_COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  urgentMessage: {
    color: UI_COLORS.text,
    lineHeight: 22,
    fontWeight: '600',
  },
  urgentActionButton: {
    borderRadius: KLIR_RADII.card,
    backgroundColor: '#B5121B',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: KLIR_RADII.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#B5121B',
    borderWidth: 0,
  },
  filterPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  filterPillText: {
    fontSize: 12,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterPillTextInactive: {
    color: '#222222',
    fontWeight: '500',
  },
  taskCard: {
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    overflow: 'hidden',
    ...sharedShadow,
  },
  cardContent: {
    padding: 16,
    gap: 12,
  },
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    flex: 1,
  },
  relativeTimeBadge: {
    minHeight: 22,
    borderRadius: KLIR_RADII.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  relativeTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: UI_COLORS.muted,
  },
  cardTitleBlock: {
    gap: 3,
  },
  cardHeadline: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: UI_COLORS.text,
    letterSpacing: -0.2,
  },
  locationBreadcrumb: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: UI_COLORS.muted,
  },
  noteText: {
    color: UI_COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  taskActionButton: {
    flex: 1,
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.primary,
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
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  loadingLineShort: {
    width: '34%',
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  loadingLineWide: {
    width: '80%',
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  titleWrapper: {
    gap: 4,
  },
  shiftPill: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: KLIR_RADII.tag,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  taskCardContent: {
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
  },
  taskActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingLineMid: {
    width: '56%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
  },
});
