import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Chip,
  Dialog,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  AssigneeAvatarCluster,
  EmptyOperationState,
  INTER_FONT,
  KLIR_COLORS,
  KLIR_RADII,
  KLIR_SPACING,
  KLIR_TYPOGRAPHY,
  MetaPill,
  OperationBadge,
  SquadCapacityPillBar,
  getComponentMeta,
  sharedShadow,
  statusTone,
} from '../components/MaintenanceUI';
import { KlirButton } from '../components/KlirButton';
import { useAuth } from '../hooks/useAuth';
import { useSupervisorContext } from '../contexts/SupervisorContext';
import { db } from '../lib/firebase';
import {
  fetchMaintenancePersonnel,
  fetchSupervisorTasks,
  flagTask,
  reassignTask,
  type MaintenancePerson,
} from '../lib/supervisor-api';
import {
  CHECKLIST_LABELS,
  formatTaskComponent,
  formatTaskStatus,
  getTaskDisplayStatus,
  isBroadcastTask,
  parseTaskDocument,
} from '../lib/tasks';
import type { SupervisorStackParamList, Task } from '../types';

type DashboardProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorDashboard'
>;
type TaskDetailProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorTaskDetail'
>;
type ReviewDetailProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'CompletedReviewDetail'
>;
type ReportsProps = NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorReports'
>;

function formatDate(date?: Date | null): string {
  return date
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
    : 'Not recorded';
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) {
    return 'N/A';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} sec`;
}

function formatRelativeTime(date?: Date | null): string {
  if (!date) return 'Recently';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function SupervisorSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeletonCard, styles.cardElevation]}>
          <View style={styles.skeletonLineShort} />
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineMid} />
        </View>
      ))}
    </View>
  );
}

function useSupervisorData() {
  return useSupervisorContext();
}

export function SupervisorDashboardScreen({
  navigation,
}: DashboardProps): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, people, loading, error, refresh, clearError } = useSupervisorData();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeToday = useMemo(() => {
    return tasks.filter(
      (task) => task.createdAt >= today && task.status !== 'completed',
    );
  }, [tasks, today]);

  const unassigned = useMemo(() => {
    return activeToday.filter(
      (task) =>
        (task.status === 'unassigned' && !isBroadcastTask(task)) ||
        task.status === 'reassignment_needed',
    ).length;
  }, [activeToday]);

  const completedTodayCount = useMemo(() => {
    return tasks.filter(
      (task) => task.status === 'completed' && task.createdAt >= today,
    ).length;
  }, [tasks, today]);

  const staffStats = useMemo(() => {
    let onTaskCount = 0;
    let availableCount = 0;
    let offlineCount = 0;

    for (const person of people) {
      const hasActiveTask = tasks.some(
        (task) =>
          task.status !== 'completed' &&
          (task.id === person.currentTaskId ||
            task.assignedTo === person.id ||
            task.assignedTo === person.email),
      );

      if (hasActiveTask || Boolean(person.currentTaskId)) {
        onTaskCount++;
      } else if (person.isAvailable) {
        availableCount++;
      } else {
        offlineCount++;
      }
    }

    return {
      onTask: onTaskCount,
      available: availableCount,
      offline: offlineCount,
    };
  }, [people, tasks]);

  const isColdLoading = loading && tasks.length === 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            colors={[KLIR_COLORS.primary]}
          />
        }
      >
        {/* Command Hub Hero Card */}
        <View style={[styles.commandHeaderCard, styles.cardElevation]}>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.facilitySubtitle}>
              {user?.building
                ? `${user.building} Facility`
                : 'SDCA Annex Facility'}
            </Text>
            <Text style={styles.facilityLeadName}>
              {user?.name || 'Lead Supervisor'}
            </Text>
          </View>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>Overview</Text>

        {/* 2-Column Bento KPI Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Bento Card 1: Total Active Tasks */}
          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelLarge" style={styles.metricLabel}>
                Active Tasks
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {isColdLoading ? '—' : activeToday.length}
              </Text>
              <Text style={styles.metricFooterText}>In progress today</Text>
            </Card.Content>
          </Card>

          {/* Bento Card 2: Unassigned Tasks Bottleneck */}
          <Card
            mode="contained"
            style={[
              styles.metricTile,
              unassigned > 0 ? styles.urgentMetricTile : styles.standardMetricTile,
              styles.cardElevation,
            ]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text
                variant="labelLarge"
                style={[styles.metricLabel, unassigned > 0 && styles.urgentMetricLabel]}
              >
                Unassigned
              </Text>
              <Text
                variant="displaySmall"
                style={[styles.metricBigNumber, unassigned > 0 && styles.urgentMetricNumber]}
              >
                {isColdLoading ? '—' : unassigned}
              </Text>
              <Text style={styles.metricFooterText}>
                {unassigned > 0 ? 'Needs assignment' : 'All assigned'}
              </Text>
            </Card.Content>
          </Card>

          {/* Bento Card 3: Squad Capacity Breakdown */}
          <Card
            mode="contained"
            style={[styles.metricWideTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelLarge" style={styles.metricLabel}>
                Team Availability
              </Text>
              <Text variant="titleLarge" style={styles.teamSummaryText}>
                {isColdLoading && people.length === 0
                  ? 'Loading team...'
                  : `${staffStats.available} available, ${staffStats.onTask} on task, ${staffStats.offline} offline`}
              </Text>
              <SquadCapacityPillBar
                available={staffStats.available}
                onTask={staffStats.onTask}
                offline={staffStats.offline}
                loading={isColdLoading && people.length === 0}
              />
            </Card.Content>
          </Card>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>Quick Actions</Text>

        {/* Mobbin Inset Grouped Menu Card */}
        <View style={[styles.groupedMenuCard, styles.cardElevation]}>
          {/* Row 1: Manage Tasks */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('SupervisorTasks')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Tasks"
            accessibilityHint="Open task queue to view or assign active tasks"
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
                <MaterialCommunityIcons
                  name="clipboard-list-outline"
                  size={20}
                  color={KLIR_COLORS.primary}
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuItemTitle}>Tasks</Text>
                <Text style={styles.menuItemSubtitle}>View and assign active tasks</Text>
              </View>
            </View>
            <View style={styles.menuRowRight}>
              {unassigned > 0 && (
                <View style={styles.menuBadgeUrgent}>
                  <Text style={styles.menuBadgeUrgentText}>{unassigned} unassigned</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Row 2: Team Availability */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('TeamAvailability')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Team"
            accessibilityHint="View technician availability and active assignments"
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#DBEAFE' }]}>
                <MaterialCommunityIcons
                  name="account-multiple-check-outline"
                  size={20}
                  color="#2563EB"
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuItemTitle}>Team</Text>
                <Text style={styles.menuItemSubtitle}>View team status & availability</Text>
              </View>
            </View>
            <View style={styles.menuRowRight}>
              <View style={styles.menuBadgeInfo}>
                <Text style={styles.menuBadgeInfoText}>{staffStats.available} Available</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Row 3: Review Completed Tasks */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('CompletedReviews')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Completed Tasks"
            accessibilityHint="Inspect completed tasks with proof photos and checklists"
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons
                  name="check-decagram-outline"
                  size={20}
                  color="#16A34A"
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuItemTitle}>Completed Tasks</Text>
                <Text style={styles.menuItemSubtitle}>Review completed work & photos</Text>
              </View>
            </View>
            <View style={styles.menuRowRight}>
              {completedTodayCount > 0 && (
                <View style={styles.menuBadgeSuccess}>
                  <Text style={styles.menuBadgeSuccessText}>{completedTodayCount} Done</Text>
                </View>
              )}
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Row 4: Operations Audit & Export Log */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate('SupervisorReports')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reports & Export"
            accessibilityHint="Export compliance reports and view resolution analytics"
          >
            <View style={styles.menuRowLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons
                  name="file-chart-outline"
                  size={20}
                  color="#D97706"
                />
              </View>
              <View style={styles.menuTextGroup}>
                <Text style={styles.menuItemTitle}>Reports & Export</Text>
                <Text style={styles.menuItemSubtitle}>View performance and export CSV</Text>
              </View>
            </View>
            <View style={styles.menuRowRight}>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

function getAssigneeName(
  assignedTo: string | null | undefined,
  people: MaintenancePerson[],
  task?: Task | null,
): string {
  if (task && isBroadcastTask(task)) {
    const ackCount = task.acknowledgedBy
      ? Object.keys(task.acknowledgedBy).length
      : 0;
    return ackCount > 0
      ? `All Team (Broadcast • ${ackCount} Responded)`
      : 'All Team (Broadcast)';
  }
  if (!assignedTo || assignedTo === 'unassigned') {
    return 'Unassigned';
  }
  const person = people.find(
    (p) =>
      p.id === assignedTo ||
      p.email?.toLowerCase() === assignedTo.toLowerCase(),
  );
  return person ? person.displayName : assignedTo;
}

export function TeamAvailabilityScreen(): React.JSX.Element {
  const { user } = useAuth();
  const { people, tasks, loading, error, refresh, clearError } = useSupervisorData();
  const [filter, setFilter] = useState<'all' | 'available' | 'on_task'>('all');

  const visiblePeople = useMemo(() => {
    return people.filter(
      (person) => !user?.building || !person.building || person.building === user.building,
    );
  }, [people, user?.building]);

  const filteredPeople = useMemo(() => {
    return visiblePeople.filter((person) => {
      const activeTask = tasks.find(
        (candidate) =>
          candidate.status !== 'completed' &&
          (candidate.id === person.currentTaskId ||
            candidate.assignedTo === person.id ||
            candidate.assignedTo === person.email),
      );
      const isOnTask = activeTask !== null || Boolean(person.currentTaskId);
      const isAvailable = !isOnTask && person.isAvailable;

      if (filter === 'available') return isAvailable;
      if (filter === 'on_task') return isOnTask;
      return true;
    });
  }, [visiblePeople, tasks, filter]);

  const availableCount = useMemo(() => {
    return visiblePeople.filter((person) => {
      const hasActive = tasks.some(
        (t) =>
          t.status !== 'completed' &&
          (t.id === person.currentTaskId ||
            t.assignedTo === person.id ||
            t.assignedTo === person.email),
      );
      return !hasActive && !person.currentTaskId && person.isAvailable;
    }).length;
  }, [visiblePeople, tasks]);

  const onTaskCount = useMemo(() => {
    return visiblePeople.filter((person) => {
      const hasActive = tasks.some(
        (t) =>
          t.status !== 'completed' &&
          (t.id === person.currentTaskId ||
            t.assignedTo === person.id ||
            t.assignedTo === person.email),
      );
      return hasActive || Boolean(person.currentTaskId);
    }).length;
  }, [visiblePeople, tasks]);

  if (loading && visiblePeople.length === 0) {
    return (
      <View style={styles.screen}>
        <SupervisorSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            colors={[KLIR_COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.tabHeaderWrap}>
            {/* Mobbin Segmented Filter Control */}
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, filter === 'all' && styles.segmentBtnActive]}
                onPress={() => setFilter('all')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === 'all' }}
                accessibilityLabel={`All personnel (${visiblePeople.length})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    filter === 'all' && styles.segmentBtnTextActive,
                  ]}
                >
                  All ({visiblePeople.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, filter === 'available' && styles.segmentBtnActive]}
                onPress={() => setFilter('available')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === 'available' }}
                accessibilityLabel={`Available (${availableCount})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    filter === 'available' && styles.segmentBtnTextActive,
                  ]}
                >
                  Available ({availableCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, filter === 'on_task' && styles.segmentBtnActive]}
                onPress={() => setFilter('on_task')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === 'on_task' }}
                accessibilityLabel={`On Task (${onTaskCount})`}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    filter === 'on_task' && styles.segmentBtnTextActive,
                  ]}
                >
                  On Task ({onTaskCount})
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHeaderTitle}>Team Members</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyOperationState
            icon="account-search-outline"
            title="No team members found"
            body="No team members match the selected status filter."
          />
        }
        renderItem={({ item }) => {
          const activeTask =
            tasks.find(
              (candidate) =>
                candidate.status !== 'completed' &&
                (candidate.id === item.currentTaskId ||
                  candidate.assignedTo === item.id ||
                  candidate.assignedTo === item.email),
            ) ?? null;

          const isOnTask = activeTask !== null || Boolean(item.currentTaskId);
          const isAvailable = !isOnTask && item.isAvailable;
          const initials = item.displayName
            ? item.displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()
            : 'OP';

          return (
            <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <View style={styles.personHeaderGroup}>
                    <View style={styles.personAvatarBox}>
                      <Text style={styles.personAvatarText}>{initials}</Text>
                    </View>
                    <View style={{ gap: 2 }}>
                      <Text variant="titleMedium" style={styles.personName}>
                        {item.displayName}
                      </Text>
                      <Text variant="bodyMedium" style={styles.personBuilding}>
                        {item.building ?? 'SDCA Annex Building'}
                        {item.shift ? ` • ${item.shift} Shift` : ''}
                      </Text>
                    </View>
                  </View>

                  <Chip
                    style={{
                      backgroundColor: isOnTask
                        ? '#FEE2E2'
                        : isAvailable
                          ? '#DCFCE7'
                          : '#F1F5F9',
                      borderRadius: KLIR_RADII.chip,
                    }}
                    textStyle={[
                      styles.chipText,
                      {
                        color: isOnTask
                          ? '#991B1B'
                          : isAvailable
                            ? '#15803D'
                            : '#475569',
                      },
                    ]}
                  >
                    {isOnTask
                      ? 'On Task'
                      : isAvailable
                        ? 'Available'
                        : 'Offline'}
                  </Chip>
                </View>

                {activeTask ? (
                  <View style={styles.activeTaskCallout}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={15}
                      color="#B45309"
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodySmall" style={styles.calloutTitle}>
                        Working on: {activeTask.location} • {activeTask.message}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.personReadySubtitle}>Available for tasks</Text>
                )}
              </Card.Content>
            </Card>
          );
        }}
      />
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function SupervisorTasksScreen({
  navigation,
}: NativeStackScreenProps<
  SupervisorStackParamList,
  'SupervisorTasks'
>): React.JSX.Element {
  const { tasks, people, loading, error, refresh, clearError } = useSupervisorData();
  const [taskFilter, setTaskFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const activeTasks = tasks.filter((task) => task.status !== 'completed');

  const unassignedTasks = useMemo(() => {
    return activeTasks.filter(
      (t) =>
        (t.status === 'unassigned' && !isBroadcastTask(t)) ||
        t.status === 'reassignment_needed',
    );
  }, [activeTasks]);

  const assignedTasks = useMemo(() => {
    return activeTasks.filter(
      (t) =>
        t.status === 'assigned' ||
        t.status === 'acknowledged' ||
        isBroadcastTask(t),
    );
  }, [activeTasks]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'unassigned') return unassignedTasks;
    if (taskFilter === 'assigned') return assignedTasks;
    return activeTasks;
  }, [taskFilter, activeTasks, unassignedTasks, assignedTasks]);

  return (
    <View style={styles.screen}>
      {loading && activeTasks.length === 0 ? (
        <SupervisorSkeleton />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void refresh()}
              colors={[KLIR_COLORS.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.tabHeaderWrap}>
              {/* Segmented Filter Control */}
              <View style={styles.segmentedContainer}>
                <TouchableOpacity
                  style={[styles.segmentBtn, taskFilter === 'all' && styles.segmentBtnActive]}
                  onPress={() => setTaskFilter('all')}
                  accessible={true}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: taskFilter === 'all' }}
                  accessibilityLabel={`All tasks (${activeTasks.length})`}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      taskFilter === 'all' && styles.segmentBtnTextActive,
                    ]}
                  >
                    All ({activeTasks.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    taskFilter === 'unassigned' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTaskFilter('unassigned')}
                  accessible={true}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: taskFilter === 'unassigned' }}
                  accessibilityLabel={`Unassigned (${unassignedTasks.length})`}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      taskFilter === 'unassigned' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Unassigned ({unassignedTasks.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    taskFilter === 'assigned' && styles.segmentBtnActive,
                  ]}
                  onPress={() => setTaskFilter('assigned')}
                  accessible={true}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: taskFilter === 'assigned' }}
                  accessibilityLabel={`Assigned (${assignedTasks.length})`}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      taskFilter === 'assigned' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Assigned ({assignedTasks.length})
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionHeaderTitle}>Active Tasks</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyOperationState
              icon="clipboard-check-outline"
              title="No active tasks"
              body="No tasks match this filter."
            />
          }
          renderItem={({ item }) => {
            const isUrgent =
              item.status === 'reassignment_needed' ||
              (item.status === 'unassigned' && !isBroadcastTask(item));
            const assigneeName = getAssigneeName(item.assignedTo, people, item);

            return (
              <Card
                mode="elevated"
                style={[
                  styles.taskCard,
                  isUrgent && styles.urgentCard,
                  styles.cardElevation,
                ]}
                onPress={() =>
                  navigation.navigate('SupervisorTaskDetail', { taskId: item.id })
                }
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${item.location}, ${item.component}, status ${getTaskDisplayStatus(item)}`}
                accessibilityHint="Double tap to open task details and reassign technician"
              >
                <Card.Content style={styles.cardContent}>
                  <View style={styles.rowBetween}>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.statusBadgePill,
                          isUrgent
                            ? styles.statusBadgeUrgent
                            : styles.statusBadgeStandard,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isUrgent ? 'alert-circle' : 'account-check'}
                          size={13}
                          color={isUrgent ? '#B5121B' : '#2563EB'}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isUrgent
                              ? styles.statusBadgeTextUrgent
                              : styles.statusBadgeTextStandard,
                          ]}
                        >
                          {getTaskDisplayStatus(item)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.relativeTimeText}>
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>

                  <Text variant="titleMedium" style={styles.taskLocationTitle}>
                    {item.location}
                  </Text>

                  <Text variant="bodyMedium" style={styles.taskComponentText}>
                    {item.component} - {item.floor}, {item.building}
                  </Text>

                  {item.message ? (
                    <Text style={styles.taskMessagePreview} numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}

                  {isUrgent ? (
                    <View style={styles.dispatchPromptBar}>
                      <Text style={styles.dispatchPromptText}>
                        Unassigned — Tap to assign →
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.rowBetween}>
                      <Text variant="bodySmall" style={styles.taskAssigneeText}>
                        Assigned to: {assigneeName}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function SupervisorTaskDetailScreen({
  route,
}: TaskDetailProps): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, people, refresh, error, clearError } = useSupervisorData();
  const task = tasks.find((candidate) => candidate.id === route.params.taskId);
  const availablePeople = people.filter((person) => person.isAvailable);
  const [assignee, setAssignee] = useState('');
  const [reason, setReason] = useState('Manual reassignment');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (!task || !assignee || !user) {
      return;
    }

    setSubmitting(true);
    try {
      await reassignTask({
        taskId: task.id,
        newAssigneeUid: assignee,
        reason,
        supervisorUid: user.uid,
      });
      setMessage('Task reassigned.');
      await refresh();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'Failed to reassign task.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) {
    return (
      <View style={styles.screen}>
        <EmptyOperationState
          icon="clipboard-alert-outline"
          title="Task not found"
          body="The requested task could not be loaded."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Task Details Hero Card */}
        <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleLarge" style={styles.taskLocationLarge}>
              {task.location}
            </Text>
            <Text style={styles.taskLocationSub}>
              {task.floor}, {task.building}
            </Text>
            <View style={styles.taskMessageContainer}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={16}
                color={KLIR_COLORS.primary}
              />
              <Text style={styles.taskMessageBody}>{task.message}</Text>
            </View>
            <Text style={styles.assigneeDetailText}>
              Assigned to: {getAssigneeName(task.assignedTo, people, task)}
            </Text>
          </Card.Content>
        </Card>

        {/* Reassignment Selector Card */}
        <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.cardHeaderTitle}>
              Select Team Member
            </Text>
            <RadioButton.Group onValueChange={setAssignee} value={assignee}>
              {(availablePeople.length > 0 ? availablePeople : people).map((person) => {
                const isSelected = assignee === person.id;
                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[
                      styles.technicianSelectRow,
                      isSelected && styles.technicianSelectRowActive,
                    ]}
                    onPress={() => setAssignee(person.id)}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={person.displayName}
                  >
                    <RadioButton.Item
                      label={person.displayName}
                      value={person.id}
                      color={KLIR_COLORS.primary}
                      labelStyle={styles.radioLabel}
                      style={{ paddingHorizontal: 0, paddingVertical: 4 }}
                    />
                  </TouchableOpacity>
                );
              })}
            </RadioButton.Group>

            <TextInput
              label="Reason"
              value={reason}
              onChangeText={setReason}
              mode="outlined"
              outlineColor="#CBD5E1"
              activeOutlineColor={KLIR_COLORS.primary}
              style={styles.reasonInput}
            />

            <Button
              mode="contained"
              buttonColor={KLIR_COLORS.primary}
              textColor="#FFFFFF"
              loading={submitting}
              disabled={!assignee || submitting}
              onPress={() => void submit()}
              style={[styles.reassignButton, styles.cardElevation]}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.actionButtonLabel}
            >
              Reassign Task
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar
        visible={message !== null || error !== null}
        onDismiss={() => {
          setMessage(null);
          clearError();
        }}
      >
        {message ?? error ?? ''}
      </Snackbar>
    </View>
  );
}

export function CompletedReviewsScreen({
  navigation,
}: NativeStackScreenProps<
  SupervisorStackParamList,
  'CompletedReviews'
>): React.JSX.Element {
  const { tasks, people, loading, error, refresh, clearError } = useSupervisorData();

  const completed = useMemo(() => {
    return tasks
      .filter((task) => task.status === 'completed')
      .sort((a, b) => {
        const timeA = (a.completedAt ?? a.createdAt).getTime();
        const timeB = (b.completedAt ?? b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [tasks]);

  return (
    <View style={styles.screen}>
      {loading && completed.length === 0 ? (
        <SupervisorSkeleton />
      ) : (
        <FlatList
          data={completed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void refresh()}
              colors={[KLIR_COLORS.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.tabHeaderWrap}>
              <Text style={styles.sectionHeaderTitle}>Completed Tasks</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyOperationState
              icon="check-all"
              title="No completed tasks yet"
              body="Completed tasks with photos and checklists will appear here."
            />
          }
          renderItem={({ item }) => (
            <Card
              mode="elevated"
              style={[styles.taskCard, styles.cardElevation]}
              onPress={() =>
                navigation.navigate('CompletedReviewDetail', { taskId: item.id })
              }
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${item.location}, Completed`}
              accessibilityHint="Double tap to view before and after proof and 10-point checklist"
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium" style={styles.taskLocationTitle}>
                    {item.location}
                  </Text>
                  <Chip
                    style={{ backgroundColor: '#DCFCE7', borderRadius: KLIR_RADII.chip }}
                    textStyle={[styles.chipText, { color: '#15803D' }]}
                  >
                    Completed
                  </Chip>
                </View>

                <Text style={styles.taskDurationLine}>
                  {formatDate(item.completedAt ?? item.createdAt)} • {formatDuration(item.workDuration)}
                </Text>

                <Text variant="bodySmall" style={styles.taskAssigneeText}>
                  Completed by: {getAssigneeName(item.completedBy ?? item.assignedTo, people)}
                </Text>

                {item.beforePhotoUrl && item.afterPhotoUrl ? (
                  <View style={styles.proofThumbnailsContainer}>
                    <View style={styles.photoThumbWrap}>
                      <Image source={{ uri: item.beforePhotoUrl }} style={styles.thumbImage} />
                      <View style={styles.thumbOverlayTag}>
                        <Text style={styles.thumbOverlayText}>Before</Text>
                      </View>
                    </View>
                    <View style={styles.photoThumbWrap}>
                      <Image source={{ uri: item.afterPhotoUrl }} style={styles.thumbImage} />
                      <View style={styles.thumbOverlayTag}>
                        <Text style={styles.thumbOverlayText}>After</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.teamPillRow}>
                    <View style={[styles.teamBadge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <MaterialCommunityIcons
                        name="camera-image"
                        size={12}
                        color="#0284C7"
                        accessibilityElementsHidden={true}
                        importantForAccessibility="no"
                      />
                      <Text style={[styles.teamBadgeText, { color: '#0369A1' }]}>
                        Photos attached
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.inspectProofPrompt}>
                  <MaterialCommunityIcons name="magnify" size={14} color={KLIR_COLORS.primary} />
                  <Text style={styles.inspectProofText}>Tap to view checklist & photos →</Text>
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}
      <Snackbar visible={error !== null} onDismiss={clearError}>
        {error ?? ''}
      </Snackbar>
    </View>
  );
}

export function CompletedReviewDetailScreen({
  route,
}: ReviewDetailProps): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, people } = useSupervisorData();
  const task = tasks.find((candidate) => candidate.id === route.params.taskId);
  const [reason, setReason] = useState('Requires re-inspection');
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Multi-technician submission selection
  const submissionUids = useMemo(() => {
    if (!task?.submissions) return [];
    return Object.keys(task.submissions);
  }, [task]);

  const [selectedTechUid, setSelectedTechUid] = useState<string | null>(null);

  useEffect(() => {
    if (
      submissionUids.length > 0 &&
      (!selectedTechUid || !submissionUids.includes(selectedTechUid))
    ) {
      setSelectedTechUid(submissionUids[0]);
    }
  }, [submissionUids, selectedTechUid]);

  if (!task) {
    return (
      <View style={styles.screen}>
        <EmptyOperationState
          icon="clipboard-alert-outline"
          title="Task not found"
          body="The requested task could not be loaded."
        />
      </View>
    );
  }

  const activeSubmission =
    selectedTechUid && task.submissions
      ? task.submissions[selectedTechUid]
      : null;

  const displayBeforePhoto =
    activeSubmission?.beforePhotoUrl ?? task.beforePhotoUrl;
  const displayBeforeCapturedAt =
    activeSubmission?.beforePhotoCapturedAt ?? task.beforePhotoCapturedAt;
  const displayAfterPhoto =
    activeSubmission?.afterPhotoUrl ?? task.afterPhotoUrl;
  const displayAfterCapturedAt =
    activeSubmission?.afterPhotoCapturedAt ?? task.afterPhotoCapturedAt;
  const displayChecklist = activeSubmission?.checklist ?? task.checklist;
  const displayRemarks = activeSubmission?.remarks ?? task.remarks;
  const displayBiometric =
    activeSubmission?.biometricVerified ?? task.biometricVerified;

  const computedWorkDuration =
    activeSubmission?.workDuration ??
    task.workDuration ??
    (task.completedAt && task.acknowledgedAt
      ? Math.max(
          0,
          Math.round(
            (task.completedAt.getTime() - task.acknowledgedAt.getTime()) / 1000,
          ),
        )
      : task.completedAt && task.createdAt
        ? Math.max(
            0,
            Math.round(
              (task.completedAt.getTime() - task.createdAt.getTime()) / 1000,
            ),
          )
        : null);

  const computedResponseTime =
    task.responseTime ??
    (task.acknowledgedAt && task.createdAt
      ? Math.max(
          0,
          Math.round(
            (task.acknowledgedAt.getTime() - task.createdAt.getTime()) / 1000,
          ),
        )
      : null);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Task Overview Hero Card */}
        <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={styles.taskLocationLarge}>
                {task.location}
              </Text>
              <View
                style={[
                  styles.teamBadge,
                  styles.teamBadgeAvailable,
                ]}
              >
                <Text style={styles.teamBadgeTextAvailable}>
                  ✓ Completed
                </Text>
              </View>
            </View>
            <Text style={styles.taskLocationSub}>
              {task.component} • {task.floor}, {task.building}
            </Text>
            <View style={{ marginVertical: 4 }}>
              <AssigneeAvatarCluster
                task={task}
                people={people}
                showNames={true}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Multi-Technician Submission Tabs */}
        {submissionUids.length > 1 ? (
          <View style={[styles.techTabsCard, styles.cardElevation]}>
            <Text variant="labelLarge" style={styles.techTabsTitle}>
              Team Submissions ({submissionUids.length}):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.techTabsRow}
            >
              {submissionUids.map((uid) => {
                const isSelected = selectedTechUid === uid;
                const techName =
                  task.submissions?.[uid]?.technicianName ||
                  getAssigneeName(uid, people);
                return (
                  <TouchableOpacity
                    key={uid}
                    onPress={() => setSelectedTechUid(uid)}
                    style={[
                      styles.techTabPill,
                      isSelected && styles.techTabPillActive,
                    ]}
                    accessible={true}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`View submission from ${techName}`}
                  >
                    <MaterialCommunityIcons
                      name="account-check"
                      size={14}
                      color={isSelected ? '#FFFFFF' : KLIR_COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.techTabPillText,
                        isSelected && styles.techTabPillTextActive,
                      ]}
                    >
                      {techName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Side-by-Side Dual Photo Comparison */}
        <View style={styles.photoRow}>
          {displayBeforePhoto ? (
            <View style={styles.photoWrapper}>
              <Image
                source={{ uri: displayBeforePhoto }}
                style={styles.photo}
                accessibilityLabel="Before maintenance photo proof"
              />
              <View style={styles.photoLabelTag}>
                <Text style={styles.photoLabelText}>Before Photo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons
                name="camera-off"
                size={24}
                color={KLIR_COLORS.slateLight}
              />
              <Text style={styles.photoPlaceholderText}>No Before Photo</Text>
            </View>
          )}

          {displayAfterPhoto ? (
            <View style={styles.photoWrapper}>
              <Image
                source={{ uri: displayAfterPhoto }}
                style={styles.photo}
                accessibilityLabel="After maintenance photo proof"
              />
              <View style={styles.photoLabelTag}>
                <Text style={styles.photoLabelText}>After Photo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons
                name="camera-off"
                size={24}
                color={KLIR_COLORS.slateLight}
              />
              <Text style={styles.photoPlaceholderText}>No After Photo</Text>
            </View>
          )}
        </View>

        {/* Checklist & Audit Metrics */}
        <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.cardHeaderTitle}>
              {activeSubmission
                ? `Checklist (${activeSubmission.technicianName})`
                : 'Checklist'}
            </Text>

            <View style={styles.checklistGrid}>
              {CHECKLIST_LABELS.map((item) => {
                const val = displayChecklist?.[item.key];
                const isPassed = val === 'done';
                const isNA = val === 'na';
                const symbol = isPassed ? '✓' : isNA ? 'N/A' : '—';
                return (
                  <View key={item.key} style={styles.checklistItemRow}>
                    <View
                      style={[
                        styles.checklistSymbolBox,
                        isPassed && styles.checklistSymbolBoxPassed,
                        isNA && styles.checklistSymbolBoxNA,
                      ]}
                    >
                      <Text
                        style={[
                          styles.checklistSymbolText,
                          isPassed && styles.checklistSymbolTextPassed,
                        ]}
                      >
                        {symbol}
                      </Text>
                    </View>
                    <Text style={styles.checklistItemText}>{item.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.metricDetailsCard}>
              <Text style={styles.metricText}>
                Notes: {displayRemarks || 'None'}
              </Text>
              <Text style={styles.metricText}>
                Response time: {formatDuration(computedResponseTime)}
              </Text>
              <Text style={styles.metricText}>
                Duration: {formatDuration(computedWorkDuration)}
              </Text>
              <Text style={styles.metricText}>
                Completed by:{' '}
                {activeSubmission
                  ? activeSubmission.technicianName
                  : (task.completedBy ?? getAssigneeName(task.assignedTo, people))}
              </Text>
            </View>

            {displayBiometric ? (
              <Chip icon="fingerprint" style={styles.biometricChip}>
                Biometric Verified
              </Chip>
            ) : null}

            <Button
              mode="contained-tonal"
              textColor={KLIR_COLORS.danger}
              icon="flag-outline"
              style={styles.flagButton}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.actionButtonLabel}
              onPress={() => setVisible(true)}
            >
              Flag for Re-inspection
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Flag Dialog */}
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)} style={styles.dialogCard}>
          <Dialog.Title style={styles.dialogTitle}>Flag task</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reason"
              value={reason}
              onChangeText={setReason}
              mode="outlined"
              outlineColor="#CBD5E1"
              activeOutlineColor={KLIR_COLORS.primary}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setVisible(false)}
              textColor={KLIR_COLORS.slateMuted}
            >
              Cancel
            </Button>
            <Button
              textColor={KLIR_COLORS.danger}
              onPress={() => {
                if (!user) return;
                void flagTask({
                  taskId: task.id,
                  reason,
                  supervisorUid: user.uid,
                })
                  .then(() => setMessage('Task flagged for re-inspection.'))
                  .catch((caught) =>
                    setMessage(
                      caught instanceof Error
                        ? caught.message
                        : 'Failed to flag task.',
                    ),
                  )
                  .finally(() => setVisible(false));
              }}
            >
              Flag
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)}>
        {message ?? ''}
      </Snackbar>
    </View>
  );
}

type ReportTimeframe = 'today' | 'week' | 'month' | 'year' | 'all';

export function SupervisorReportsScreen({
  navigation,
}: ReportsProps): React.JSX.Element {
  const { tasks, people, loading, refresh } = useSupervisorData();
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('today');
  const [exporting, setExporting] = useState(false);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'completed');
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
    );
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return completedTasks.filter((t) => {
      const taskDate = t.completedAt ?? t.createdAt;
      switch (timeframe) {
        case 'today':
          return taskDate >= startOfToday;
        case 'week':
          return taskDate >= startOfWeek;
        case 'month':
          return taskDate >= startOfMonth;
        case 'year':
          return taskDate >= startOfYear;
        case 'all':
        default:
          return true;
      }
    });
  }, [completedTasks, timeframe]);

  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    let totalDurationSeconds = 0;
    let photoPairsCount = 0;
    let biometricCount = 0;

    for (const t of filteredTasks) {
      if (t.workDuration) totalDurationSeconds += t.workDuration;
      if (t.beforePhotoUrl && t.afterPhotoUrl) photoPairsCount += 1;
      if (t.biometricVerified) biometricCount += 1;
    }

    const avgDurationSeconds =
      total > 0 ? Math.round(totalDurationSeconds / total) : 0;
    const biometricPct =
      total > 0 ? Math.round((biometricCount / total) * 100) : 0;

    return {
      total,
      avgDuration: formatDuration(avgDurationSeconds),
      photoPairsCount,
      biometricPct: `${biometricPct}%`,
    };
  }, [filteredTasks]);

  const handleExportCSV = async (): Promise<void> => {
    if (filteredTasks.length === 0) {
      Alert.alert(
        'No Records',
        'There are no completed tasks in this timeframe to export.',
      );
      return;
    }

    setExporting(true);
    try {
      const headers = [
        'Task ID',
        'Restroom / Location',
        'Floor',
        'Building',
        'Component',
        'Trigger Type',
        'Technician(s)',
        'Created At',
        'Completed At',
        'Work Duration (Seconds)',
        'Biometric Verified',
        'Remarks',
      ];

      const rows = filteredTasks.map((t) => {
        const assignee = getAssigneeName(
          t.completedBy ?? t.assignedTo,
          people,
        );
        const createdAtStr = t.createdAt.toISOString();
        const completedAtStr = t.completedAt
          ? t.completedAt.toISOString()
          : 'N/A';
        const remarksClean = `"${(t.remarks || '').replace(/"/g, '""')}"`;
        const locClean = `"${(t.location || t.restroomName || '').replace(/"/g, '""')}"`;

        return [
          t.id,
          locClean,
          t.floor,
          t.building,
          t.component,
          t.triggerType,
          `"${assignee.replace(/"/g, '""')}"`,
          createdAtStr,
          completedAtStr,
          t.workDuration ?? 0,
          t.biometricVerified ? 'Yes' : 'No',
          remarksClean,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      await Share.share({
        title: `Smart Flush Operations Log - ${timeframe.toUpperCase()}`,
        message: csvContent,
      });
    } catch {
      Alert.alert('Export Failed', 'Unable to share CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const timeframeTabs: Array<{ id: ReportTimeframe; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            colors={[KLIR_COLORS.primary]}
          />
        }
      >
        {/* Timeframe Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeframeScrollRow}
        >
          {timeframeTabs.map((tab) => {
            const isSelected = timeframe === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setTimeframe(tab.id)}
                style={[
                  styles.timeframePill,
                  isSelected && styles.timeframePillActive,
                ]}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`View report for ${tab.label}`}
              >
                <Text
                  style={[
                    styles.timeframePillText,
                    isSelected && styles.timeframePillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>Performance Summary</Text>

        {/* Analytics Summary 2x2 Bento KPI Cards */}
        <View style={styles.metricsGrid}>
          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Tasks Completed
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.total}
              </Text>
              <Text style={styles.metricFooterText}>Completed in timeframe</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Avg Resolution Time
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.avgDuration}
              </Text>
              <Text style={styles.metricFooterText}>Average duration</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Photo Proof
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.photoPairsCount}
              </Text>
              <Text style={styles.metricFooterText}>Before & after sets</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, styles.cardElevation]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Biometric Verified
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.biometricPct}
              </Text>
              <Text style={styles.metricFooterText}>Verified with fingerprint</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>Export Report</Text>

        {/* Export Operations Action Card */}
        <Card mode="elevated" style={[styles.personCard, styles.cardElevation]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="titleMedium" style={styles.cardHeaderTitle}>
                  Export CSV Report
                </Text>
                <Text style={styles.metricFooterText}>
                  Download task history and data for{' '}
                  {
                    timeframeTabs.find((t) => t.id === timeframe)?.label
                  }
                </Text>
              </View>
              <Button
                mode="contained"
                buttonColor={KLIR_COLORS.primary}
                textColor="#FFFFFF"
                icon="file-download-outline"
                loading={exporting}
                disabled={exporting || filteredTasks.length === 0}
                onPress={() => void handleExportCSV()}
                style={styles.cardElevation}
                contentStyle={styles.actionButtonContent}
                labelStyle={styles.actionButtonLabel}
              >
                Export CSV
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Submissions Log Feed */}
        <Text style={styles.sectionHeaderTitle}>
          Completed Tasks ({filteredTasks.length})
        </Text>

        {filteredTasks.length === 0 ? (
          <EmptyOperationState
            icon="clipboard-text-outline"
            title="No completed tasks"
            body={`No completed tasks recorded for this timeframe.`}
          />
        ) : (
          filteredTasks.map((item) => (
            <Card
              key={item.id}
              mode="elevated"
              style={[styles.taskCard, styles.cardElevation]}
              onPress={() =>
                navigation.navigate('CompletedReviewDetail', {
                  taskId: item.id,
                })
              }
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${item.location}, ${item.floor}. Completed by ${getAssigneeName(item.completedBy ?? item.assignedTo, people)}`}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium" style={styles.taskLocationTitle}>
                    {item.location}
                  </Text>
                  <View
                    style={[
                      styles.teamBadge,
                      styles.teamBadgeAvailable,
                    ]}
                  >
                    <Text style={styles.teamBadgeTextAvailable}>
                      ✓ Completed
                    </Text>
                  </View>
                </View>

                <Text variant="bodyMedium" style={styles.taskComponentText}>
                  {item.component} • {item.floor}, {item.building}
                </Text>

                <View style={{ marginVertical: 4 }}>
                  <AssigneeAvatarCluster
                    task={item}
                    people={people}
                    showNames={true}
                  />
                </View>

                <View style={styles.rowBetween}>
                  <Text variant="bodySmall" style={styles.taskAssigneeText}>
                    Completed: {formatDate(item.completedAt)}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{
                      color: KLIR_COLORS.slateMuted,
                      fontWeight: '700',
                    }}
                  >
                    Duration: {formatDuration(item.workDuration ?? 0)}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: KLIR_SPACING.lg,
    gap: KLIR_SPACING.md,
    paddingBottom: 40,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardContent: {
    gap: 10,
    padding: 16,
  },
  cardElevation: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Command Header
  commandHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderLeftWidth: 4,
    borderLeftColor: KLIR_COLORS.primary,
    marginBottom: 4,
  },
  headerTitleGroup: {
    gap: 3,
  },
  facilitySubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: KLIR_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  facilityLeadName: {
    fontFamily: INTER_FONT,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  // Operational Bento Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricTile: {
    flex: 1,
    minWidth: 145,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricWideTile: {
    width: '100%',
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
    gap: 6,
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
  teamSummaryText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  teamPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  teamBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  teamBadgeAvailable: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  teamBadgeOnTask: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  teamBadgeOffline: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  teamBadgeTextAvailable: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  teamBadgeTextOnTask: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  teamBadgeTextOffline: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  teamBadgeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
  },

  // Grouped Menu Action List
  sectionHeaderTitle: {
    fontFamily: INTER_FONT,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
    marginTop: 8,
  },
  groupedMenuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextGroup: {
    gap: 2,
    flex: 1,
  },
  menuItemTitle: {
    fontFamily: INTER_FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuItemSubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadgeUrgent: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  menuBadgeUrgentText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#B5121B',
  },
  menuBadgeInfo: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  menuBadgeInfoText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  menuBadgeSuccess: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  menuBadgeSuccessText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },

  // Segmented Tab Filter
  tabHeaderWrap: {
    marginBottom: 4,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
    gap: 4,
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

  // Cards
  personCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  urgentCard: {
    backgroundColor: '#FFFBFB',
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: KLIR_COLORS.danger,
    borderRadius: 16,
  },
  personHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  personAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  personAvatarText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  personName: {
    fontFamily: INTER_FONT,
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 16,
  },
  personBuilding: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  personReadySubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 2,
  },
  chipText: {
    fontFamily: INTER_FONT,
    fontWeight: '800',
    fontSize: 11,
  },
  activeTaskCallout: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  calloutTitle: {
    fontFamily: INTER_FONT,
    color: '#92400E',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 18,
  },
  calloutText: {
    fontFamily: INTER_FONT,
    color: '#92400E',
    fontWeight: '700',
  },

  // Task Queue Items
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeStandard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusBadgeUrgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadgeTextStandard: {
    color: '#1D4ED8',
  },
  statusBadgeTextUrgent: {
    color: '#991B1B',
  },
  relativeTimeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  taskLocationTitle: {
    fontFamily: INTER_FONT,
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 17,
  },
  taskComponentText: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  taskMessagePreview: {
    fontFamily: INTER_FONT,
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  dispatchPromptBar: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  dispatchPromptText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  taskAssigneeText: {
    fontFamily: INTER_FONT,
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },

  // Detail & Reassign
  taskLocationLarge: {
    fontFamily: INTER_FONT,
    fontWeight: '900',
    color: '#0F172A',
    fontSize: 20,
  },
  taskMessageContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  taskMessageBody: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    fontWeight: '500',
    flex: 1,
  },
  assigneeDetailText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  taskLocationSub: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  cardHeaderTitle: {
    fontFamily: INTER_FONT,
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 16,
  },
  technicianSelectRow: {
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#EAECF0',
    backgroundColor: '#F8FAFC',
  },
  technicianSelectRowActive: {
    borderColor: KLIR_COLORS.primary,
    backgroundColor: '#FEF2F2',
  },
  radioLabel: {
    fontFamily: INTER_FONT,
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 14,
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    marginBottom: 10,
  },
  reassignButton: {
    borderRadius: 12,
    marginTop: 4,
    minHeight: 52,
    justifyContent: 'center',
  },
  actionButtonContent: {
    height: 52,
  },
  actionButtonLabel: {
    fontFamily: INTER_FONT,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Completed Reviews
  taskDurationLine: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  proofThumbnailsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  photoThumbWrap: {
    flex: 1,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbOverlayTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thumbOverlayText: {
    fontFamily: INTER_FONT,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inspectProofPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAECF0',
    marginTop: 2,
  },
  inspectProofText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: KLIR_COLORS.primary,
  },

  // Completed Review Detail
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoWrapper: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoLabelTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoLabelText: {
    fontFamily: INTER_FONT,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  photoPlaceholder: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Checklist
  checklistGrid: {
    gap: 8,
    marginTop: 4,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checklistSymbolBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistSymbolBoxPassed: {
    backgroundColor: '#DCFCE7',
  },
  checklistSymbolBoxNA: {
    backgroundColor: '#F1F5F9',
  },
  checklistSymbolText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
  },
  checklistSymbolTextPassed: {
    color: '#15803D',
  },
  checklistItemText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
  },
  metricDetailsCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    marginTop: 6,
  },
  metricText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
  },
  biometricChip: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 20,
  },
  flagButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  dialogCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  dialogTitle: {
    fontFamily: INTER_FONT,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Multi-Technician Tabs
  techTabsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    gap: 8,
  },
  techTabsTitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  techTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  techTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 38,
  },
  techTabPillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  techTabPillText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  techTabPillTextActive: {
    color: '#FFFFFF',
  },

  // Reports Timeframe Filter
  timeframeScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  timeframePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
    minHeight: 38,
    justifyContent: 'center',
  },
  timeframePillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  timeframePillText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  timeframePillTextActive: {
    color: '#FFFFFF',
  },

  // Skeletons
  skeletonContainer: {
    padding: KLIR_SPACING.lg,
    gap: KLIR_SPACING.md,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: KLIR_SPACING.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  skeletonLineShort: {
    width: '35%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  skeletonLineWide: {
    width: '85%',
    height: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  skeletonLineMid: {
    width: '60%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
});
