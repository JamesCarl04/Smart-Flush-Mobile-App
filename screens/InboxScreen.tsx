import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useContext, useMemo, useState } from 'react';
import { Card, Snackbar, Text } from 'react-native-paper';

import { KlirButton } from '../components/KlirButton';
import {
  AssigneeAvatarCluster,
  EmptyOperationState,
  INTER_FONT,
  KLIR_COLORS,
  KLIR_RADII,
  KLIR_SPACING,
  MetaPill,
  OperationBadge,
  cardElevation,
  getComponentMeta,
  getInitials,
  getTaskDisplayTone,
  getTaskPriority,
  taskPriorityTone,
  taskTriggerTone,
} from '../components/MaintenanceUI';
import { FlaggedRemarksModal } from '../components/FlaggedRemarksModal';
import { TaskExecutionModal } from '../components/TaskExecutionModal';
import { AuthContext } from '../contexts/AuthContext';
import { useTasks } from '../hooks/useTasks';
import { acknowledgeTask, acceptRecheckTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { getTaskDisplayStatus } from '../lib/tasks';
import type { InboxStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxHome'>;
type InboxFilter = 'all' | 'active' | 'flagged';

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

function EmptyState({ activeFilter }: { activeFilter?: InboxFilter }): React.JSX.Element {
  return (
    <EmptyOperationState
      icon={
        activeFilter === 'flagged'
          ? 'flag-outline'
          : activeFilter === 'active'
            ? 'progress-clock'
            : 'shield-check-outline'
      }
      title={
        activeFilter === 'flagged'
          ? 'No flagged tasks'
          : activeFilter === 'active'
            ? 'No active tasks'
            : 'No pending tasks'
      }
      body={
        activeFilter === 'flagged'
          ? 'All tasks have passed supervisor QA inspection.'
          : activeFilter === 'active'
            ? 'You currently have no tasks in progress.'
            : 'You are all caught up for now. New restroom alerts will appear here as soon as the IoT system assigns them to you.'
      }
    />
  );
}

function LoadingCards(): React.JSX.Element {
  return (
    <View style={styles.loadingList}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.loadingCard, styles.cardElevation]}>
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
    (task) => task.status === 'acknowledged' || task.status === 'rechecking',
  ).length;

  const flaggedTasksList = useMemo(() => {
    return inboxTasks.filter(
      (task) => task.status === 'flagged',
    );
  }, [inboxTasks]);

  const activeTasksList = useMemo(() => {
    return inboxTasks.filter((task) => {
      // Tasks currently in progress by this technician
      if (task.status === 'acknowledged' || task.status === 'rechecking') {
        return true;
      }

      // Tasks assigned directly to this technician
      const isAssignedToMe =
        task.assignedTo === user?.uid ||
        task.assignedTo === user?.email ||
        (Array.isArray(task.assignedToIds) && task.assignedToIds.includes(user?.uid ?? ''));

      if (task.status === 'assigned' && isAssignedToMe) {
        return true;
      }

      return false;
    });
  }, [inboxTasks, user?.uid, user?.email]);

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
        : activeFilter === 'flagged'
          ? flaggedTasksList
          : activeTasksList;

    if (priorityTask && activeFilter !== 'flagged') {
      return baseTasks.filter((task) => task.id !== priorityTask.id);
    }

    return baseTasks;
  }, [activeFilter, inboxTasks, activeTasksList, flaggedTasksList, priorityTask]);

  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const [flaggedTaskToReview, setFlaggedTaskToReview] = useState<Task | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [acceptingRecheck, setAcceptingRecheck] = useState(false);

  const handleStartTask = async (task: Task): Promise<void> => {
    if (task.status === 'acknowledged' || task.status === 'rechecking') {
      setExecutingTask(task);
      return;
    }

    if (task.status === 'flagged') {
      setFlaggedTaskToReview(task);
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

  const handleAcceptRecheck = async (task: Task): Promise<void> => {
    if (!user) return;
    setAcceptingRecheck(true);
    try {
      await acceptRecheckTask({
        taskId: task.id,
        technicianUid: user.uid,
        technicianName: user.name,
      });
      await refreshTasks();
      setFlaggedTaskToReview(null);
      setExecutingTask({
        ...task,
        status: 'rechecking',
        recheckedBy: user.uid,
        recheckedAt: new Date(),
      });
    } catch {
      // Handled by refresh error
    } finally {
      setAcceptingRecheck(false);
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

  const userCleanName = user?.name ? user.name.replace(/\([^)]*\)/g, '').trim() : 'Technician';

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            colors={[KLIR_COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Top Section Header Row */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Text style={styles.sectionHeaderTitle}>Today's Tasks</Text>
                <Text style={styles.facilitySubtitle}>
                  {user?.building ? `${user.building} Facility` : 'SDCA Annex Facility'} • {user?.shift ?? '1st'} Shift
                </Text>
              </View>
            </View>

            {/* 2-Column Bento KPI Metrics Grid */}
            <View style={styles.metricsGrid}>
              {/* Bento Card 1: Pending Tasks */}
              <Card
                mode="contained"
                style={[
                  styles.metricTile,
                  pendingCount > 0 ? styles.urgentMetricTile : styles.standardMetricTile,
                  styles.cardElevation,
                ]}
              >
                <Card.Content style={styles.metricTileContent}>
                  <Text
                    variant="labelLarge"
                    style={[styles.metricLabel, pendingCount > 0 && styles.urgentMetricLabel]}
                  >
                    Pending
                  </Text>
                  <Text
                    variant="displaySmall"
                    style={[styles.metricBigNumber, pendingCount > 0 && styles.urgentMetricNumber]}
                  >
                    {loading ? '—' : pendingCount}
                  </Text>
                  <Text style={styles.metricFooterText}>
                    {pendingCount > 0 ? 'Needs action today' : 'All clear'}
                  </Text>
                </Card.Content>
              </Card>

              {/* Bento Card 2: In Progress Tasks */}
              <Card
                mode="contained"
                style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
              >
                <Card.Content style={styles.metricTileContent}>
                  <Text variant="labelLarge" style={styles.metricLabel}>
                    In Progress
                  </Text>
                  <Text variant="displaySmall" style={styles.metricBigNumber}>
                    {loading ? '—' : acknowledgedCount}
                  </Text>
                  <Text style={styles.metricFooterText}>Being worked on</Text>
                </Card.Content>
              </Card>
            </View>

            {/* Priority Alert Callout */}
            {priorityTask && activeFilter !== 'flagged' ? (
              <Card
                mode="contained"
                style={[styles.urgentCard, styles.cardElevation]}
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
                          name="clock-outline"
                          size={12}
                          color="#475569"
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

                  <View style={{ marginTop: 6 }}>
                    <AssigneeAvatarCluster
                      task={priorityTask}
                      currentUserId={user?.uid}
                      currentUserName={user?.name}
                    />
                  </View>

                  <KlirButton
                    title="Open Priority Task"
                    variant="primary"
                    onPress={() => openTaskDetail(priorityTask.id)}
                    icon="arrow-right"
                    iconPosition="right"
                    style={styles.urgentActionButton}
                  />
                </Card.Content>
              </Card>
            ) : null}

            {/* Section Heading */}
            <Text style={styles.sectionHeaderTitle}>Task Queue</Text>

            {/* Mobbin Segmented Filter Control */}
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, activeFilter === 'all' && styles.segmentBtnActive]}
                onPress={() => setActiveFilter('all')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeFilter === 'all' }}
                accessibilityLabel={`All tasks (${inboxTasks.length})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    activeFilter === 'all' && styles.segmentBtnTextActive,
                  ]}
                >
                  All ({inboxTasks.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, activeFilter === 'active' && styles.segmentBtnActive]}
                onPress={() => setActiveFilter('active')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeFilter === 'active' }}
                accessibilityLabel={`Active tasks (${activeTasksList.length})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    activeFilter === 'active' && styles.segmentBtnTextActive,
                  ]}
                >
                  Active ({activeTasksList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  activeFilter === 'flagged' && styles.segmentBtnActive,
                  flaggedTasksList.length > 0 && styles.segmentBtnFlaggedAlert,
                ]}
                onPress={() => setActiveFilter('flagged')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeFilter === 'flagged' }}
                accessibilityLabel={`Flagged tasks (${flaggedTasksList.length})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    activeFilter === 'flagged' && styles.segmentBtnTextActive,
                    flaggedTasksList.length > 0 && styles.segmentBtnFlaggedText,
                  ]}
                >
                  Flagged ({flaggedTasksList.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading && visibleTasks.length === 0 ? (
            <LoadingCards />
          ) : (
            <EmptyState activeFilter={activeFilter} />
          )
        }
        renderItem={({ item }) => (
          <Card
            mode="elevated"
            style={[styles.taskCard, styles.cardElevation]}
            onPress={() => openTaskDetail(item.id)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${getRestroomLabel(item)}, ${item.floor} ${item.location}. Status: ${item.status}.`}
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
                    color="#94A3B8"
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

              {/* Supervisor Flag Reason Snippet */}
              {item.status === 'flagged' && item.flagReason ? (
                <View style={styles.flagSnippetCard}>
                  <MaterialCommunityIcons
                    name="flag-variant"
                    size={14}
                    color="#DC2626"
                  />
                  <Text style={styles.flagSnippetText} numberOfLines={2}>
                    <Text style={styles.flagSnippetBold}>Supervisor Remarks: </Text>
                    {item.flagReason}
                  </Text>
                </View>
              ) : null}

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

              <View style={{ marginTop: 6 }}>
                <AssigneeAvatarCluster
                  task={item}
                  currentUserId={user?.uid}
                  currentUserName={user?.name}
                />
              </View>
            </Card.Content>

            {/* Tactile Full-width View Details Action */}
            <Card.Actions style={styles.cardActions}>
              {item.status === 'flagged' ? (
                <KlirButton
                  title="Review Remarks & Accept Recheck"
                  variant="primary"
                  onPress={() => setFlaggedTaskToReview(item)}
                  icon="flag-variant"
                  style={styles.taskActionButton}
                />
              ) : item.status === 'rechecking' ? (
                <KlirButton
                  title="Resume Recheck & Open Camera"
                  variant="primary"
                  onPress={() => setExecutingTask(item)}
                  icon="camera-outline"
                  style={styles.taskActionButton}
                />
              ) : (
                <KlirButton
                  title={
                    item.status === 'acknowledged' ||
                    (user?.uid && Boolean(item.acknowledgedBy?.[user.uid]))
                      ? 'Resume Task & Open Camera'
                      : 'Acknowledge & Start'
                  }
                  variant="primary"
                  loading={actionInFlightId === item.id}
                  disabled={actionInFlightId === item.id}
                  onPress={() => void handleStartTask(item)}
                  icon={
                    item.status === 'acknowledged' ||
                    (user?.uid && Boolean(item.acknowledgedBy?.[user.uid]))
                      ? 'camera-outline'
                      : 'clipboard-check-outline'
                  }
                  style={styles.taskActionButton}
                />
              )}
            </Card.Actions>
          </Card>
        )}
      />

      {/* Slide-Up Flagged Remarks Dialog */}
      <FlaggedRemarksModal
        visible={flaggedTaskToReview !== null}
        task={flaggedTaskToReview}
        loading={acceptingRecheck}
        onDismiss={() => setFlaggedTaskToReview(null)}
        onAcceptRecheck={(task) => void handleAcceptRecheck(task)}
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
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: KLIR_SPACING.lg,
    paddingBottom: 34,
    gap: KLIR_SPACING.md,
    backgroundColor: '#F8FAFC',
    flexGrow: 1,
  },
  headerBlock: {
    gap: 12,
    marginBottom: 4,
  },
  cardElevation: {
    ...cardElevation,
  },

  // Top Header Row
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  sectionTitleGroup: {
    gap: 2,
    flex: 1,
  },
  sectionHeaderTitle: {
    fontFamily: INTER_FONT,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  facilitySubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  shiftPill: {
    minHeight: 24,
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
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  // Bento Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
  },
  standardMetricTile: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EAECF0',
  },
  urgentMetricTile: {
    backgroundColor: '#FFFBFB',
    borderColor: '#FECACA',
  },
  metricTileContent: {
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  urgentMetricLabel: {
    color: '#991B1B',
  },
  metricBigNumber: {
    fontFamily: INTER_FONT,
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  urgentMetricNumber: {
    color: '#B5121B',
  },
  metricFooterText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // Urgent Callout Card
  urgentCard: {
    borderRadius: 16,
    backgroundColor: '#FFFBFB',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 2,
  },
  urgentContent: {
    padding: 16,
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
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#B5121B',
    letterSpacing: 0.5,
  },
  urgentTitle: {
    fontFamily: INTER_FONT,
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  urgentLocationBreadcrumb: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  urgentMessage: {
    fontFamily: INTER_FONT,
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  urgentActionButton: {
    borderRadius: 12,
    marginTop: 4,
  },

  // Segmented Filter Control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    gap: 4,
    marginTop: 2,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentBtnActive: {
    backgroundColor: KLIR_COLORS.primary,
  },
  segmentBtnFlaggedAlert: {
    backgroundColor: '#FEF2F2',
  },
  segmentBtnFlaggedText: {
    color: '#DC2626',
    fontWeight: '800',
  },
  segmentBtnText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Task Cards
  taskCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
    gap: 10,
  },
  flagSnippetCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 2,
  },
  flagSnippetText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
    lineHeight: 16,
  },
  flagSnippetBold: {
    fontWeight: '800',
    color: '#7F1D1D',
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
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  relativeTimeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  cardTitleBlock: {
    gap: 2,
  },
  cardHeadline: {
    fontFamily: INTER_FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  locationBreadcrumb: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  noteText: {
    fontFamily: INTER_FONT,
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  taskActionButton: {
    flex: 1,
    borderRadius: 12,
  },

  // Skeleton Loader
  loadingList: {
    gap: 12,
  },
  loadingCard: {
    height: 138,
    padding: 16,
    gap: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  loadingLineShort: {
    width: '34%',
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  loadingLineWide: {
    width: '80%',
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  loadingLineMid: {
    width: '56%',
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
});
