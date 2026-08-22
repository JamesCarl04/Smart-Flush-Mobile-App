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
  KLIR_COLORS,
  KLIR_SPACING,
  KLIR_TYPOGRAPHY,
  MetaPill,
  OperationBadge,
  getComponentMeta,
  sharedShadow,
  statusTone,
} from '../components/MaintenanceUI';
import { KlirButton } from '../components/KlirButton';
import { useAuth } from '../hooks/useAuth';
import { useSupervisorContext } from '../contexts/SupervisorContext';
import { db } from '../lib/firebase';
import { clearAllTasksInFirestore } from '../lib/task-completion';
import {
  fetchMaintenancePersonnel,
  fetchSupervisorTasks,
  flagTask,
  reassignTask,
  type MaintenancePerson,
} from '../lib/supervisor-api';
import { CHECKLIST_LABELS, formatTaskComponent, formatTaskStatus, parseTaskDocument } from '../lib/tasks';
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

function statusColor(person: MaintenancePerson): string {
  if (person.currentTaskId) {
    return '#f7d5d2';
  }

  return person.isAvailable ? '#d8f2db' : '#fff1bd';
}

function SupervisorSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={[styles.skeletonCard, sharedShadow]}>
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
      (task) => task.status === 'unassigned' || !task.assignedTo,
    ).length;
  }, [activeToday]);

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
        {/* Supervisor Facility Command Header Banner */}
        <View style={[styles.commandHeaderCard, sharedShadow]}>
          <View style={styles.rowBetween}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.facilitySubtitle}>
                {user?.building
                  ? `${user.building} Command Hub`
                  : 'SDCA Annex Command Hub'}
              </Text>
              <Text style={styles.facilityLeadName}>
                {user?.name || 'Lead Supervisor'}
              </Text>
            </View>
            <View style={styles.liveSyncBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveSyncText}>Live Dispatch</Text>
            </View>
          </View>
        </View>

        {/* Operational Metrics Hero Grid */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Active Tasks Today */}
          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <View style={styles.metricTileHeader}>
                <MaterialCommunityIcons
                  name="clipboard-clock-outline"
                  size={18}
                  color={KLIR_COLORS.primary}
                />
                <Text variant="labelLarge" style={styles.metricLabel}>
                  Total active tasks today
                </Text>
              </View>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {isColdLoading ? '—' : activeToday.length}
              </Text>
              <Text style={styles.metricFooterText}>Active in facility</Text>
            </Card.Content>
          </Card>

          {/* Card 2: Unassigned Tasks */}
          <Card
            mode="contained"
            style={[
              styles.metricTile,
              unassigned > 0 ? styles.urgentMetricTile : styles.standardMetricTile,
              sharedShadow,
            ]}
          >
            <Card.Content style={styles.metricTileContent}>
              <View style={styles.metricTileHeader}>
                <MaterialCommunityIcons
                  name={unassigned > 0 ? 'alert-circle' : 'shield-check'}
                  size={18}
                  color={unassigned > 0 ? KLIR_COLORS.danger : KLIR_COLORS.success}
                />
                <Text
                  variant="labelLarge"
                  style={[styles.metricLabel, unassigned > 0 && styles.urgentMetricLabel]}
                >
                  Unassigned tasks
                </Text>
              </View>
              <Text
                variant="displaySmall"
                style={[styles.metricBigNumber, unassigned > 0 && styles.urgentMetricNumber]}
              >
                {isColdLoading ? '—' : unassigned}
              </Text>
              <Text style={styles.metricFooterText}>
                {unassigned > 0 ? 'Needs immediate dispatch' : 'All alerts assigned'}
              </Text>
            </Card.Content>
          </Card>

          {/* Card 3: Maintenance Personnel */}
          <Card
            mode="contained"
            style={[styles.metricWideTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <View style={styles.rowBetween}>
                <View style={styles.metricTileHeader}>
                  <MaterialCommunityIcons
                    name="account-group-outline"
                    size={20}
                    color={KLIR_COLORS.goldDark}
                  />
                  <Text variant="labelLarge" style={styles.metricLabel}>
                    Maintenance personnel
                  </Text>
                </View>
              </View>
              <Text variant="titleLarge" style={styles.teamSummaryText}>
                {isColdLoading && people.length === 0
                  ? 'Syncing team...'
                  : `${staffStats.available} available, ${staffStats.onTask} on task, ${staffStats.offline} offline`}
              </Text>
              <View style={styles.teamPillRow}>
                <View style={[styles.teamBadge, { backgroundColor: KLIR_COLORS.softGreen }]}>
                  <Text style={[styles.teamBadgeText, { color: KLIR_COLORS.successText }]}>
                    ● {isColdLoading && people.length === 0 ? '—' : staffStats.available} Available
                  </Text>
                </View>
                <View style={[styles.teamBadge, { backgroundColor: KLIR_COLORS.softRed }]}>
                  <Text style={[styles.teamBadgeText, { color: KLIR_COLORS.dangerText }]}>
                    ● {isColdLoading && people.length === 0 ? '—' : staffStats.onTask} On Task
                  </Text>
                </View>
                <View style={[styles.teamBadge, { backgroundColor: KLIR_COLORS.softYellow }]}>
                  <Text style={[styles.teamBadgeText, { color: KLIR_COLORS.warningText }]}>
                    ● {isColdLoading && people.length === 0 ? '—' : staffStats.offline} Offline
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>Operational Shortcuts</Text>

        {/* Action Shortcuts */}
        <View style={styles.actionList}>
          <Button
            mode="contained"
            buttonColor={KLIR_COLORS.primary}
            textColor="#FFFFFF"
            icon="clipboard-list-outline"
            style={[styles.mainActionButton, sharedShadow]}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.actionButtonLabel}
            onPress={() => navigation.navigate('SupervisorTasks')}
          >
            Manage Tasks
          </Button>

          <Button
            mode="outlined"
            textColor={KLIR_COLORS.charcoal}
            icon="account-multiple-check-outline"
            style={[styles.secondaryActionButton, sharedShadow]}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.secondaryButtonLabel}
            onPress={() => navigation.navigate('TeamAvailability')}
          >
            Team Availability
          </Button>

          <Button
            mode="outlined"
            textColor={KLIR_COLORS.charcoal}
            icon="check-decagram-outline"
            style={[styles.secondaryActionButton, sharedShadow]}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.secondaryButtonLabel}
            onPress={() => navigation.navigate('CompletedReviews')}
          >
            Review Completed Tasks
          </Button>

          <Button
            mode="outlined"
            textColor={KLIR_COLORS.charcoal}
            icon="file-chart-outline"
            style={[styles.secondaryActionButton, sharedShadow]}
            contentStyle={styles.actionButtonContent}
            labelStyle={styles.secondaryButtonLabel}
            onPress={() => navigation.navigate('SupervisorReports')}
          >
            Operations Audit & Export Log
          </Button>

          <Button
            mode="text"
            textColor={KLIR_COLORS.danger}
            icon="trash-can-outline"
            style={{ marginTop: 4 }}
            onPress={() => {
              Alert.alert(
                'Wipe All Tasks',
                'Are you sure you want to permanently delete all task records in Firestore and reset staff availability?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Wipe All Tasks',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const count = await clearAllTasksInFirestore();
                        await refresh();
                        Alert.alert('Success', `Cleaned up ${count} tasks. Staff availability reset.`);
                      } catch (err) {
                        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to clear tasks.');
                      }
                    },
                  },
                ],
              );
            }}
          >
            Clear All Tasks (Clean Database)
          </Button>
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
): string {
  if (!assignedTo || assignedTo === 'unassigned') {
    return 'Unassigned';
  }
  const person = people.find(
    (p) => p.id === assignedTo || p.email?.toLowerCase() === assignedTo.toLowerCase(),
  );
  return person ? person.displayName : assignedTo;
}

export function TeamAvailabilityScreen(): React.JSX.Element {
  const { user } = useAuth();
  const { people, tasks, loading, error, refresh, clearError } = useSupervisorData();

  const visiblePeople = useMemo(() => {
    return people.filter(
      (person) => !user?.building || !person.building || person.building === user.building,
    );
  }, [people, user?.building]);

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
        data={visiblePeople}
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
        ListEmptyComponent={
          <EmptyOperationState
            icon="account-search-outline"
            title="No personnel found"
            body="No maintenance personnel records were found for your facility."
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

          return (
            <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium" style={styles.personName}>
                    {item.displayName}
                  </Text>
                  <Chip
                    style={{
                      backgroundColor: isOnTask
                        ? '#f7d5d2'
                        : isAvailable
                          ? '#d8f2db'
                          : '#fff1bd',
                    }}
                    textStyle={styles.chipText}
                  >
                    {isOnTask
                      ? 'On Task'
                      : isAvailable
                        ? 'Available'
                        : 'Offline'}
                  </Chip>
                </View>
                <Text variant="bodyMedium" style={styles.personBuilding}>
                  {item.building ?? 'SDCA Annex Building'}
                </Text>
                {activeTask ? (
                  <View style={styles.activeTaskCallout}>
                    <Text variant="bodySmall" style={styles.calloutText}>
                      Active: {activeTask.location} ({activeTask.deviceId}) - {activeTask.message}
                    </Text>
                  </View>
                ) : null}
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
  const activeTasks = tasks.filter((task) => task.status !== 'completed');

  return (
    <View style={styles.screen}>
      {loading && activeTasks.length === 0 ? (
        <SupervisorSkeleton />
      ) : (
        <FlatList
          data={activeTasks}
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
          ListEmptyComponent={
            <EmptyOperationState
              icon="clipboard-check-outline"
              title="No active tasks"
              body="There are currently no active facility work orders."
            />
          }
          renderItem={({ item }) => (
            <Card
              mode="elevated"
              style={[
                styles.taskCard,
                item.status === 'unassigned' && styles.urgentCard,
                sharedShadow,
              ]}
              onPress={() =>
                navigation.navigate('SupervisorTaskDetail', { taskId: item.id })
              }
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium" style={styles.taskLocationTitle}>
                    {item.location}
                  </Text>
                  <Chip textStyle={styles.chipText}>
                    {formatTaskStatus(item.status)}
                  </Chip>
                </View>
                <Text variant="bodyMedium" style={styles.taskComponentText}>
                  {item.component} - {item.floor}, {item.building}
                </Text>
                <Text variant="bodySmall" style={styles.taskAssigneeText}>
                  Assignee: {getAssigneeName(item.assignedTo, people)}
                </Text>
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
          body="The requested work order could not be loaded."
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
        {/* Task Details Card */}
        <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleLarge" style={styles.taskLocationLarge}>
              {task.location}
            </Text>
            <Text style={styles.taskMessageBody}>{task.message}</Text>
            <Text style={styles.assigneeDetailText}>
              Current assignee: {task.assignedTo ?? 'Unassigned'}
            </Text>
            <Text style={styles.taskLocationSub}>
              {task.floor}, {task.building}
            </Text>
          </Card.Content>
        </Card>

        {/* Reassignment Selector Card */}
        <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.cardHeaderTitle}>
              Available maintenance
            </Text>
            <RadioButton.Group onValueChange={setAssignee} value={assignee}>
              {(availablePeople.length > 0 ? availablePeople : people).map((person) => (
                <RadioButton.Item
                  key={person.id}
                  label={person.displayName}
                  value={person.id}
                  color={KLIR_COLORS.primary}
                  labelStyle={styles.radioLabel}
                />
              ))}
            </RadioButton.Group>
            <TextInput
              label="Reason"
              value={reason}
              onChangeText={setReason}
              mode="outlined"
              outlineColor={KLIR_COLORS.slateBorder}
              activeOutlineColor={KLIR_COLORS.charcoal}
              style={styles.reasonInput}
            />
            <Button
              mode="contained"
              buttonColor={KLIR_COLORS.primary}
              textColor="#FFFFFF"
              loading={submitting}
              disabled={!assignee || submitting}
              onPress={() => void submit()}
              style={styles.reassignButton}
            >
              Reassign
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
          ListEmptyComponent={
            <EmptyOperationState
              icon="check-all"
              title="No completed reviews yet"
              body="Completed tasks with proof photos and checklist will appear here for supervisor review."
            />
          }
          renderItem={({ item }) => (
            <Card
              mode="elevated"
              style={[styles.taskCard, sharedShadow]}
              onPress={() =>
                navigation.navigate('CompletedReviewDetail', { taskId: item.id })
              }
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.rowBetween}>
                  <Text variant="titleMedium" style={styles.taskLocationTitle}>
                    {item.location}
                  </Text>
                  <Chip
                    style={{ backgroundColor: KLIR_COLORS.softGreen }}
                    textStyle={[styles.chipText, { color: KLIR_COLORS.successText }]}
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
                  <View style={styles.teamPillRow}>
                    <View style={[styles.teamBadge, { backgroundColor: '#E0F2FE' }]}>
                      <Text style={[styles.teamBadgeText, { color: '#0369A1' }]}>
                        📷 Before & After Proof Attached
                      </Text>
                    </View>
                  </View>
                ) : null}
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
          body="The requested completed review could not be loaded."
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
        {/* Task Overview Card */}
        <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={styles.taskLocationLarge}>
                {task.location}
              </Text>
              <View
                style={[
                  styles.teamBadge,
                  { backgroundColor: KLIR_COLORS.softGreen },
                ]}
              >
                <Text
                  style={[
                    styles.teamBadgeText,
                    { color: KLIR_COLORS.successText },
                  ]}
                >
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

        {/* Multi-Technician Submission Tabs (if multiple submissions) */}
        {submissionUids.length > 1 ? (
          <View style={styles.techTabsCard}>
            <Text variant="labelLarge" style={styles.techTabsTitle}>
              Submissions by Team Members ({submissionUids.length}):
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

        {/* Before / After Photo Row */}
        <View style={styles.photoRow}>
          {displayBeforePhoto ? (
            <Image
              source={{ uri: displayBeforePhoto }}
              style={styles.photo}
              accessibilityLabel="Before maintenance photo proof"
            />
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
            <Image
              source={{ uri: displayAfterPhoto }}
              style={styles.photo}
              accessibilityLabel="After maintenance photo proof"
            />
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
        <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.cardHeaderTitle}>
              {activeSubmission
                ? `Checklist (${activeSubmission.technicianName})`
                : 'Checklist'}
            </Text>
            {CHECKLIST_LABELS.map((item) => {
              const val = displayChecklist?.[item.key];
              const symbol = val === 'done' ? '✓' : val === 'na' ? 'N/A' : '—';
              return (
                <Text key={item.key} style={styles.checklistItemText}>
                  {symbol} {item.label}
                </Text>
              );
            })}
            <Text style={styles.metricText}>
              Remarks: {displayRemarks || 'None'}
            </Text>
            <Text style={styles.metricText}>
              Response time: {formatDuration(computedResponseTime)}
            </Text>
            <Text style={styles.metricText}>
              Work duration: {formatDuration(computedWorkDuration)}
            </Text>
            <Text style={styles.metricText}>
              Submitted by:{' '}
              {activeSubmission
                ? activeSubmission.technicianName
                : getAssigneeName(task.completedBy ?? task.assignedTo, people)}
            </Text>
            {displayBiometric ? (
              <Chip icon="fingerprint" style={styles.biometricChip}>
                Biometric verified
              </Chip>
            ) : null}
            <Button
              mode="contained-tonal"
              textColor={KLIR_COLORS.danger}
              icon="flag-outline"
              style={styles.flagButton}
              onPress={() => setVisible(true)}
            >
              Flag for Re-inspection
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Flag Dialog */}
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Flag task</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Reason"
              value={reason}
              onChangeText={setReason}
              mode="outlined"
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

        {/* Analytics Summary KPI Cards */}
        <View style={styles.metricsGrid}>
          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Tasks Completed
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.total}
              </Text>
              <Text style={styles.metricFooterText}>Resolved in timeframe</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Avg Resolution SLA
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.avgDuration}
              </Text>
              <Text style={styles.metricFooterText}>From ack to done</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Photo Evidence
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.photoPairsCount}
              </Text>
              <Text style={styles.metricFooterText}>Before/After pairs</Text>
            </Card.Content>
          </Card>

          <Card
            mode="contained"
            style={[styles.metricTile, styles.standardMetricTile, sharedShadow]}
          >
            <Card.Content style={styles.metricTileContent}>
              <Text variant="labelMedium" style={styles.metricLabel}>
                Biometric Verified
              </Text>
              <Text variant="displaySmall" style={styles.metricBigNumber}>
                {metrics.biometricPct}
              </Text>
              <Text style={styles.metricFooterText}>Identity authenticated</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Export Action Card */}
        <Card mode="elevated" style={[styles.personCard, sharedShadow]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleMedium" style={styles.cardHeaderTitle}>
                  Export Operations CSV
                </Text>
                <Text style={styles.metricFooterText}>
                  Generate compliance audit spreadsheet for{' '}
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
                style={sharedShadow}
              >
                Export CSV
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Submissions Log Feed */}
        <Text style={styles.sectionHeaderTitle}>
          Completed Submissions Feed ({filteredTasks.length})
        </Text>

        {filteredTasks.length === 0 ? (
          <EmptyOperationState
            icon="clipboard-text-outline"
            title="No records found"
            body={`No completed tasks recorded for ${timeframeTabs.find((t) => t.id === timeframe)?.label.toLowerCase()}.`}
          />
        ) : (
          filteredTasks.map((item) => (
            <Card
              key={item.id}
              mode="elevated"
              style={[styles.taskCard, sharedShadow]}
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
                      { backgroundColor: KLIR_COLORS.softGreen },
                    ]}
                  >
                    <Text
                      style={[
                        styles.teamBadgeText,
                        { color: KLIR_COLORS.successText },
                      ]}
                    >
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
                      fontWeight: '600',
                    }}
                  >
                    SLA: {formatDuration(item.workDuration ?? 0)}
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
    backgroundColor: KLIR_COLORS.canvas,
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
    gap: 8,
  },

  // Command Header
  commandHeaderCard: {
    backgroundColor: KLIR_COLORS.cardSurface,
    borderRadius: 16,
    padding: KLIR_SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: KLIR_COLORS.primary,
    marginBottom: 4,
  },
  headerTitleGroup: {
    gap: 2,
  },
  facilitySubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: KLIR_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  facilityLeadName: {
    fontSize: 18,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: KLIR_COLORS.softGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: KLIR_COLORS.success,
  },
  liveSyncText: {
    fontSize: 11,
    fontWeight: '700',
    color: KLIR_COLORS.successText,
  },

  // Operational Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: KLIR_SPACING.md,
  },
  metricTile: {
    flex: 1,
    minWidth: 140,
    borderRadius: 16,
    borderWidth: 1,
  },
  metricWideTile: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
  },
  standardMetricTile: {
    backgroundColor: KLIR_COLORS.cardSurface,
    borderColor: KLIR_COLORS.slateBorder,
  },
  urgentMetricTile: {
    backgroundColor: KLIR_COLORS.softRed,
    borderColor: '#FECACA',
  },
  metricTileContent: {
    padding: KLIR_SPACING.md,
    gap: 4,
  },
  metricTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: KLIR_COLORS.slateMuted,
  },
  urgentMetricLabel: {
    color: KLIR_COLORS.danger,
  },
  metricBigNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.5,
  },
  urgentMetricNumber: {
    color: KLIR_COLORS.danger,
  },
  metricFooterText: {
    fontSize: 11,
    fontWeight: '500',
    color: KLIR_COLORS.slateLight,
  },
  teamSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
    marginTop: 2,
  },
  teamPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  teamBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Shortcuts
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.2,
    marginTop: 6,
  },
  actionList: {
    gap: 10,
  },
  mainActionButton: {
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  secondaryActionButton: {
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: KLIR_COLORS.cardSurface,
    borderColor: KLIR_COLORS.slateBorder,
  },
  actionButtonContent: {
    height: 52,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
    letterSpacing: 0.2,
  },

  // Cards
  personCard: {
    backgroundColor: KLIR_COLORS.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
  },
  taskCard: {
    backgroundColor: KLIR_COLORS.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
  },
  urgentCard: {
    backgroundColor: '#FFFBFB',
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: KLIR_COLORS.danger,
  },
  personName: {
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
  },
  personBuilding: {
    color: KLIR_COLORS.slateMuted,
  },
  chipText: {
    fontWeight: '700',
    fontSize: 11,
  },
  activeTaskCallout: {
    backgroundColor: KLIR_COLORS.goldSurface,
    borderColor: KLIR_COLORS.goldBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  calloutText: {
    color: KLIR_COLORS.charcoal,
    fontWeight: '600',
  },

  // Tasks
  taskLocationTitle: {
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  taskComponentText: {
    color: KLIR_COLORS.slateMuted,
    fontWeight: '600',
  },
  taskAssigneeText: {
    color: KLIR_COLORS.slate,
    fontWeight: '600',
  },
  taskLocationLarge: {
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  taskMessageBody: {
    fontSize: 14,
    color: KLIR_COLORS.charcoal,
    lineHeight: 20,
  },
  assigneeDetailText: {
    fontSize: 13,
    fontWeight: '600',
    color: KLIR_COLORS.slate,
  },
  taskLocationSub: {
    fontSize: 12,
    color: KLIR_COLORS.slateMuted,
  },
  cardHeaderTitle: {
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  radioLabel: {
    fontWeight: '600',
    color: KLIR_COLORS.charcoal,
  },
  reasonInput: {
    backgroundColor: KLIR_COLORS.cardSurface,
    marginTop: 4,
    marginBottom: 8,
  },
  reassignButton: {
    borderRadius: 12,
    marginTop: 4,
  },

  // Completed Reviews
  taskDurationLine: {
    color: KLIR_COLORS.slateMuted,
    fontSize: 13,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photo: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    backgroundColor: KLIR_COLORS.canvas,
  },
  photoPlaceholder: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    backgroundColor: KLIR_COLORS.canvas,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: KLIR_COLORS.slateLight,
    fontWeight: '600',
  },
  checklistItemText: {
    fontSize: 13,
    color: KLIR_COLORS.slate,
    lineHeight: 20,
  },
  metricText: {
    fontSize: 13,
    color: KLIR_COLORS.slate,
    lineHeight: 20,
  },
  biometricChip: {
    backgroundColor: KLIR_COLORS.softGreen,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  flagButton: {
    marginTop: 8,
    borderRadius: 12,
  },

  // Multi-Technician Tabs
  techTabsCard: {
    backgroundColor: KLIR_COLORS.cardSurface,
    borderRadius: 16,
    padding: KLIR_SPACING.md,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
    gap: 8,
  },
  techTabsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    minHeight: 40,
  },
  techTabPillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  techTabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
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
    backgroundColor: KLIR_COLORS.cardSurface,
    borderWidth: 1,
    borderColor: KLIR_COLORS.slateBorder,
    minHeight: 40,
    justifyContent: 'center',
  },
  timeframePillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  timeframePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: KLIR_COLORS.slate,
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
    backgroundColor: KLIR_COLORS.cardSurface,
    borderRadius: 16,
    padding: KLIR_SPACING.lg,
    gap: 12,
  },
  skeletonLineShort: {
    width: '35%',
    height: 14,
    backgroundColor: KLIR_COLORS.slateBorder,
    borderRadius: 6,
  },
  skeletonLineWide: {
    width: '85%',
    height: 20,
    backgroundColor: KLIR_COLORS.slateBorder,
    borderRadius: 6,
  },
  skeletonLineMid: {
    width: '60%',
    height: 14,
    backgroundColor: KLIR_COLORS.slateBorder,
    borderRadius: 6,
  },
});
