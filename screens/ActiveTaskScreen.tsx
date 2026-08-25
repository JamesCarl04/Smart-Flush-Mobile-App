import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  getTaskDisplayTone,
} from '../components/MaintenanceUI';
import { TaskDetailSkeleton } from '../components/SkeletonScreens';
import { TaskExecutionModal } from '../components/TaskExecutionModal';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { acknowledgeTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { getTaskDisplayStatus } from '../lib/tasks';
import type { Task, TaskStackParamList } from '../types';

type Props = NativeStackScreenProps<TaskStackParamList, 'ActiveTask'>;

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

function EmptyTaskPanel({ onGoToInbox }: { onGoToInbox: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <EmptyOperationState
        icon="clipboard-text-search-outline"
        title="No active task in progress"
        body="You have no tasks currently in progress. Tap 'Acknowledge & Start' on any task in your Inbox to begin working."
      />
      <KlirButton
        title="View Inbox Tasks"
        variant="primary"
        icon="bell-outline"
        onPress={onGoToInbox}
        style={styles.emptyGoInboxBtn}
      />
    </View>
  );
}

export function ActiveTaskScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const { activeTasks, loading, refreshTasks } = useTasks();
  const routeTaskId = route.params?.taskId;
  const [selectedTaskIdState, setSelectedTaskIdState] = useState<string | null>(null);

  const activeTask = useMemo(() => {
    if (selectedTaskIdState) {
      const match = activeTasks.find((task) => task.id === selectedTaskIdState);
      if (match) return match;
    }
    if (routeTaskId) {
      const match = activeTasks.find((task) => task.id === routeTaskId);
      if (match) return match;
    }
    return activeTasks[0] ?? null;
  }, [activeTasks, routeTaskId, selectedTaskIdState]);

  const [executionModalVisible, setExecutionModalVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  const handleAction = async (): Promise<void> => {
    if (!activeTask) return;
    if (activeTask.status !== 'acknowledged' && activeTask.status !== 'rechecking') {
      setActionInFlight(true);
      try {
        await acknowledgeTask(activeTask.id);
        await refreshTasks();
        setExecutionModalVisible(true);
      } catch (error) {
        setSnackbarMessage(
          error instanceof Error ? error.message : 'Failed to start task.',
        );
      } finally {
        setActionInFlight(false);
      }
    } else {
      setExecutionModalVisible(true);
    }
  };

  if (loading && activeTasks.length === 0) {
    return <TaskDetailSkeleton />;
  }

  if (!activeTask) {
    return (
      <EmptyTaskPanel
        onGoToInbox={() => {
          const parentNav = navigation.getParent<any>();
          if (parentNav) {
            parentNav.navigate('InboxTab');
          }
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Multi-Active Task Switcher Bar */}
        {activeTasks.length > 1 ? (
          <View style={styles.multiTaskSelectorContainer}>
            <Text style={styles.multiTaskSelectorTitle}>
              Active Tasks ({activeTasks.length}):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.multiTaskTabsRow}
            >
              {activeTasks.map((t) => {
                const isSelected = t.id === activeTask.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setSelectedTaskIdState(t.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.multiTaskTabPill,
                      isSelected && styles.multiTaskTabPillActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? 'clipboard-check' : 'clipboard-outline'}
                      size={14}
                      color={isSelected ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.multiTaskTabPillText,
                        isSelected && styles.multiTaskTabPillTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {getRestroomLabel(t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Unified Hero Action Card */}
        <Card mode="elevated" style={[styles.heroCard, styles.cardElevation]}>
          <Card.Content style={styles.heroContent}>
            {/* Top Row: Status Badge + Shift Pill */}
            <View style={styles.headerTopRow}>
              <OperationBadge
                label={getTaskDisplayStatus(activeTask)}
                tone={getTaskDisplayTone(activeTask)}
              />
              <View style={styles.shiftPill}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={12}
                  color="#475569"
                />
                <Text style={styles.shiftPillText}>
                  {`${activeTask.shift ?? '1st'} Shift`}
                </Text>
              </View>
            </View>

            {/* Primary Restroom Headline */}
            <Text style={styles.locationHeadline}>
              {getRestroomLabel(activeTask)}
            </Text>

            {/* Location Breadcrumb Subtitle */}
            <Text style={styles.locationBreadcrumb}>
              {`${activeTask.floor} • ${activeTask.location} • ${activeTask.building}`}
            </Text>

            {/* Instruction Callout Box */}
            {activeTask.message ? (
              <View style={styles.instructionCallout}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={16}
                  color="#B45309"
                  style={styles.instructionIcon}
                />
                <View style={styles.instructionTextWrapper}>
                  <Text style={styles.instructionLabel}>INSTRUCTION</Text>
                  <Text style={styles.instructionText}>
                    {activeTask.message}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Meta Tags */}
            <View style={styles.metaRow}>
              <MetaPill
                icon={getComponentMeta(activeTask.component).icon}
                label={getComponentMeta(activeTask.component).label}
              />
              {activeTask.type === 'cleaning' ? (
                <MetaPill icon="broom" label="Cleaning" />
              ) : null}
              <MetaPill
                icon="calendar-clock"
                label={formatDate(activeTask.createdAt)}
              />
            </View>

            <View style={{ marginTop: 4 }}>
              <AssigneeAvatarCluster
                task={activeTask}
                currentUserId={user?.uid}
                currentUserName={user?.name}
              />
            </View>

            {/* Direct Action Button */}
            <KlirButton
              title={
                activeTask.status === 'acknowledged' || activeTask.status === 'rechecking'
                  ? 'Resume Task & Open Camera'
                  : 'Acknowledge & Start Task'
              }
              variant="primary"
              loading={actionInFlight}
              disabled={actionInFlight}
              icon={
                activeTask.status === 'acknowledged' || activeTask.status === 'rechecking'
                  ? 'camera-outline'
                  : 'clipboard-check-outline'
              }
              onPress={() => void handleAction()}
              style={styles.actionButton}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Slide-Up Task Execution Modal */}
      <TaskExecutionModal
        visible={executionModalVisible}
        task={activeTask}
        onDismiss={() => setExecutionModalVisible(false)}
        onTaskCompleted={() => {
          setSnackbarMessage('Task completed successfully.');
          setExecutionModalVisible(false);
          void refreshTasks();
        }}
      />

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage ?? ''}
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
    paddingBottom: 32,
    gap: KLIR_SPACING.md,
    backgroundColor: '#F8FAFC',
  },
  emptyGoInboxBtn: {
    marginTop: 14,
    minWidth: 180,
    borderRadius: 12,
  },
  multiTaskSelectorContainer: {
    gap: 6,
    marginBottom: 4,
  },
  multiTaskSelectorTitle: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.2,
  },
  multiTaskTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  multiTaskTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxWidth: 220,
  },
  multiTaskTabPillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  multiTaskTabPillText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  multiTaskTabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  cardElevation: {
    ...cardElevation,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  heroCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  heroContent: {
    gap: 12,
    padding: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  locationHeadline: {
    fontFamily: INTER_FONT,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  locationBreadcrumb: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: -4,
  },
  instructionCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  instructionIcon: {
    marginTop: 2,
  },
  instructionTextWrapper: {
    flex: 1,
    gap: 2,
  },
  instructionLabel: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  instructionText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionButton: {
    borderRadius: 12,
    marginTop: 4,
  },
});

