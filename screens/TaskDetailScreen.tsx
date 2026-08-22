import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from '../lib/native-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { captureRef } from 'react-native-view-shot';
import {
  Button,
  Card,
  Chip,
  Divider,
  ProgressBar,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  AssigneeAvatarCluster,
  MetaPill,
  OperationBadge,
  UI_COLORS,
  getComponentMeta,
  sharedShadow,
  statusTone,
  taskTriggerTone,
  urgencyTone,
} from '../components/MaintenanceUI';
import { TaskDetailSkeleton } from '../components/SkeletonScreens';
import { TaskExecutionModal } from '../components/TaskExecutionModal';
import firestore from '@react-native-firebase/firestore';
import { db } from '../lib/firebase';
import {
  completeTaskOnline,
  currentUserId,
  isOnlineAsync,
  queueOfflineCompletion,
} from '../lib/task-completion';
import {
  CHECKLIST_LABELS,
  EMPTY_CHECKLIST,
  formatTaskComponent,
  formatTaskStatus,
  formatTaskTrigger,
} from '../lib/tasks';
import { acknowledgeTask, fetchTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import type {
  ChecklistValue,
  HistoryStackParamList,
  InboxStackParamList,
  Task,
  TaskChecklist,
} from '../types';

type Props =
  | NativeStackScreenProps<InboxStackParamList, 'TaskDetail'>
  | NativeStackScreenProps<HistoryStackParamList, 'TaskDetail'>;

type FlowStep = 'details' | 'checklist' | 'summary';

const CHECKLIST_CATEGORIES: Array<{
  id: string;
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  items: Array<(typeof CHECKLIST_LABELS)[number]>;
}> = [
  {
    id: 'dusting_prep',
    title: 'Dusting & Prep',
    icon: 'broom',
    items: CHECKLIST_LABELS.filter((item) =>
      [
        'removeCeilingDust',
        'removeWallDust',
        'removeLightBulbDust',
        'cleanWindows',
      ].includes(item.key),
    ),
  },
  {
    id: 'fixtures_floors',
    title: 'Fixtures & Floors',
    icon: 'floor-plan',
    items: CHECKLIST_LABELS.filter((item) =>
      ['wipeDownFixtures', 'sweepAndDryFloors', 'arrangeFixtures'].includes(
        item.key,
      ),
    ),
  },
  {
    id: 'disinfection_waste',
    title: 'Disinfection & Waste',
    icon: 'shield-check-outline',
    items: CHECKLIST_LABELS.filter((item) =>
      [
        'disinfectTouchedSurfaces',
        'emptyTrashBins',
        'disinfectUVLights',
      ].includes(item.key),
    ),
  },
];

function formatDate(date: Date | null | undefined): string {
  if (!date) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}


function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text variant="labelLarge" style={styles.detailLabel}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function LinearWorkflowStepper({
  status,
  step,
}: {
  status: Task['status'];
  step: FlowStep;
}): React.JSX.Element {
  const steps = [
    {
      key: 'reported',
      label: 'Reported',
      isComplete: true,
      isCurrent: (status === 'assigned' || status === 'unassigned') && step === 'details',
    },
    {
      key: 'accepted',
      label: 'Accepted',
      isComplete:
        status === 'acknowledged' ||
        status === 'completed' ||
        status === 'flagged',
      isCurrent: status === 'acknowledged' && step === 'details',
    },
    {
      key: 'proof',
      label: 'Proof & Check',
      isComplete: status === 'completed' || step === 'summary',
      isCurrent: step === 'checklist' || step === 'summary',
    },
    {
      key: 'done',
      label: 'Completed',
      isComplete: status === 'completed',
      isCurrent: status === 'completed',
    },
  ];

  return (
    <View style={styles.stepperContainer}>
      <View style={styles.stepperTrack}>
        {steps.map((item, index) => {
          const isDone = item.isComplete;
          const isCurrent = item.isCurrent;
          return (
            <View key={item.key} style={styles.stepperStep}>
              <View style={styles.stepperIndicatorWrapper}>
                <View
                  style={[
                    styles.stepperDot,
                    isDone ? styles.stepperDotDone : null,
                    isCurrent && !isDone ? styles.stepperDotCurrent : null,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      isDone
                        ? 'check'
                        : isCurrent
                          ? 'progress-clock'
                          : 'circle-small'
                    }
                    size={13}
                    color={isDone || isCurrent ? '#FFFFFF' : '#94A3B8'}
                  />
                </View>
                {index < steps.length - 1 ? (
                  <View
                    style={[
                      styles.stepperLine,
                      isDone ? styles.stepperLineDone : null,
                    ]}
                  />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepperLabel,
                  isDone || isCurrent ? styles.stepperLabelActive : null,
                ]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function checklistComplete(checklist: TaskChecklist): boolean {
  return CHECKLIST_LABELS.every((item) => checklist[item.key] !== 'unchecked');
}

function checklistFirestoreValue(value: ChecklistValue): boolean | 'N/A' {
  return value === 'done' ? true : 'N/A';
}

function toFirestoreChecklist(
  checklist: TaskChecklist,
): Record<string, boolean | 'N/A'> {
  return CHECKLIST_LABELS.reduce<Record<string, boolean | 'N/A'>>(
    (result, item) => ({
      ...result,
      [item.key]: checklistFirestoreValue(checklist[item.key]),
    }),
    {},
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function TaskDetailScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, refreshTasks } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep>('details');
  const [checklist, setChecklist] = useState<TaskChecklist>({
    ...EMPTY_CHECKLIST,
  });
  const [remarks, setRemarks] = useState('');
  const [beforePhotoUri, setBeforePhotoUri] = useState<string | null>(null);
  const [beforeCapturedAt, setBeforeCapturedAt] = useState<Date | null>(null);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [afterCapturedAt, setAfterCapturedAt] = useState<Date | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [executionModalVisible, setExecutionModalVisible] = useState(false);
  const overlayRef = useRef<View>(null);
  const initializedTaskIdRef = useRef<string | null>(null);
  const taskId = route.params.taskId;
  const cachedTask = useMemo(
    () => tasks.find((currentTask) => currentTask.id === taskId) ?? null,
    [taskId, tasks],
  );

  useEffect(() => {
    if (!cachedTask) {
      return;
    }

    setTask(cachedTask);
    if (
      initializedTaskIdRef.current !== taskId ||
      cachedTask.status === 'completed'
    ) {
      setChecklist(cachedTask.checklist ?? { ...EMPTY_CHECKLIST });
      setRemarks(cachedTask.remarks ?? '');
      initializedTaskIdRef.current = taskId;
    }
    setLoading(false);
    setLoadError(null);
  }, [cachedTask, taskId]);

  const refreshTaskDetail = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent && !cachedTask) {
        setLoading(true);
      }

      try {
        const apiTask = await fetchTask(taskId);
        setTask(apiTask);
        if (
          initializedTaskIdRef.current !== taskId ||
          apiTask.status === 'completed'
        ) {
          setChecklist(apiTask.checklist ?? { ...EMPTY_CHECKLIST });
          setRemarks(apiTask.remarks ?? '');
          initializedTaskIdRef.current = taskId;
        }
        setLoadError(null);
        setLoading(false);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to refresh task details. Check your connection and try again.';

        if (cachedTask) {
          setTask(cachedTask);
          setLoading(false);
          return;
        }

        setLoadError(message);
        setLoading(false);
      }
    },
    [cachedTask, taskId],
  );

  useEffect(() => {
    void refreshTaskDetail(Boolean(cachedTask));
  }, [cachedTask, refreshTaskDetail]);

  useEffect(() => {
    if (task && typeof navigation?.setOptions === 'function') {
      navigation.setOptions({
        title: getRestroomLabel(task),
      });
    }
  }, [navigation, task]);

  const handleAcknowledge = async (): Promise<void> => {
    if (!task || actionInFlight) {
      return;
    }

    setActionInFlight(true);
    try {
      const uid = currentUserId();
      const acknowledgedAt = new Date();

      try {
        await db.collection('tasks').doc(task.id).update({
          status: 'acknowledged',
          assignedTo: uid,
          acknowledgedAt: firestore.Timestamp.fromDate(acknowledgedAt),
          [`acknowledgedBy.${uid}`]: firestore.Timestamp.fromDate(acknowledgedAt),
        });
        await db.collection('users').doc(uid).update({
          isAvailable: false,
          currentTaskId: task.id,
        });
      } catch (firestoreError) {
        console.warn('Direct Firestore acknowledge update warning:', firestoreError);
      }

      await acknowledgeTask(task.id);
      setTask({ ...task, status: 'acknowledged', acknowledgedAt, assignedTo: uid });
      await refreshTasks();
      setSnackbarMessage('Task acknowledged. Proceed to the location.');
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Failed to acknowledge task. Please try again.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const runBiometricCheck = async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Verify identity before taking task photos',
      cancelLabel: 'Skip',
    });
    return result.success;
  };

  const burnTimestampOverlay = async (
    uri: string,
    capturedAt: Date,
  ): Promise<string> => {
    if (!task) {
      return uri;
    }

    const prepared = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    if (process.env.NODE_ENV === 'test') {
      return prepared.uri;
    }

    const taskSuffix = task.id.slice(-6);
    setOverlayUri(prepared.uri);
    setOverlayText(
      `${formatDate(capturedAt)} | ${getRestroomLabel(task)} (${task.deviceId}) | Task ${taskSuffix}`,
    );
    await delay(250);

    try {
      if (overlayRef.current) {
        const captured = await captureRef(overlayRef, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
        });
        return captured;
      }
    } catch {
      // Return prepared image if view-shot capture fails
    } finally {
      setOverlayUri(null);
      setOverlayText('');
    }

    return prepared.uri;
  };

  const takePhoto = async (kind: 'before' | 'after'): Promise<void> => {
    if (!task) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera permission required',
        'Camera access is required to complete tasks.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const capturedAt = new Date();
    const stampedUri = await burnTimestampOverlay(
      result.assets[0].uri,
      capturedAt,
    );

    if (kind === 'before') {
      setBeforePhotoUri(stampedUri);
      setBeforeCapturedAt(capturedAt);
      setStep('checklist');
    } else {
      setAfterPhotoUri(stampedUri);
      setAfterCapturedAt(capturedAt);
      setStep('summary');
    }
  };

  const startCompletionFlow = async (): Promise<void> => {
    if (!task || actionInFlight) {
      return;
    }

    setActionInFlight(true);
    try {
      const verified = await runBiometricCheck();
      setBiometricVerified(verified);
      await takePhoto('before');
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Unable to start completion flow.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const captureAfterPhoto = async (): Promise<void> => {
    if (!checklistComplete(checklist)) {
      setSnackbarMessage(
        'Set every checklist item to Done or N/A before proceeding.',
      );
      return;
    }

    await takePhoto('after');
  };

  const submitCompletion = async (): Promise<void> => {
    if (
      !task ||
      !beforePhotoUri ||
      !beforeCapturedAt ||
      !afterPhotoUri ||
      !afterCapturedAt ||
      actionInFlight
    ) {
      return;
    }

    setActionInFlight(true);
    try {
      const uid = currentUserId();
      const completedAt = new Date();
      const firestoreChecklist = toFirestoreChecklist(
        checklist,
      ) as unknown as TaskChecklist;
      const online = await isOnlineAsync();

      if (online) {
        await completeTaskOnline({
          taskId: task.id,
          acknowledgedAt: task.acknowledgedAt ?? null,
          createdAt: task.createdAt,
          checklist: firestoreChecklist,
          remarks,
          beforePhotoLocalUri: beforePhotoUri,
          beforePhotoCapturedAt: beforeCapturedAt,
          afterPhotoLocalUri: afterPhotoUri,
          afterPhotoCapturedAt: afterCapturedAt,
          biometricVerified,
          completedAt,
          completedBy: uid,
        });
        setSnackbarMessage('Task completed and synced.');
      } else {
        await queueOfflineCompletion({
          taskId: task.id,
          completedAt: completedAt.toISOString(),
          acknowledgedAt: task.acknowledgedAt?.toISOString() ?? null,
          checklist: firestoreChecklist,
          remarks,
          beforePhotoLocalUri: beforePhotoUri,
          afterPhotoLocalUri: afterPhotoUri,
          biometricVerified,
          completedBy: uid,
          offlineSynced: false,
        });
        setSnackbarMessage('Saved offline. Will sync when connected.');
      }

      await refreshTasks();
      setTask({
        ...task,
        status: 'completed',
        completedAt,
        completedBy: uid,
        assignedTo: uid,
        beforePhotoUrl: beforePhotoUri,
        afterPhotoUrl: afterPhotoUri,
      });
      setStep('details');

      Alert.alert(
        'Task Completed',
        'Work order has been closed and verified. View your completed work in History.',
        [
          {
            text: 'View History',
            onPress: () => {
              if (navigation && 'navigate' in navigation) {
                (navigation as any).navigate('HistoryTab');
              }
            },
          },
          {
            text: 'OK',
            onPress: () => {
              if (navigation && 'goBack' in navigation) {
                navigation.goBack();
              }
            },
          },
        ],
      );
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error
          ? error.message
          : 'Failed to submit completion.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const checklistCheckedCount = useMemo(() => {
    return CHECKLIST_LABELS.filter((item) => checklist[item.key] !== 'unchecked')
      .length;
  }, [checklist]);

  const checklistProgress = useMemo(() => {
    return checklistCheckedCount / CHECKLIST_LABELS.length;
  }, [checklistCheckedCount]);

  if (loading) {
    return <TaskDetailSkeleton />;
  }

  if (!task) {
    return (
      <View style={styles.loadingState}>
        <Text variant="titleMedium">Still loading task details</Text>
        <Text variant="bodyMedium" style={styles.missingCopy}>
          {loadError ??
            'The task is not available yet. Check your connection and try again.'}
        </Text>
        <Button mode="contained" onPress={() => void refreshTaskDetail()}>
          Try Again
        </Button>
        <Button mode="text" onPress={() => navigation.goBack()}>
          Back
        </Button>
      </View>
    );
  }

  const handleAction = async (): Promise<void> => {
    if (!task) return;
    if (task.status !== 'acknowledged') {
      await handleAcknowledge();
    } else {
      await startCompletionFlow();
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Unified Hero Action Card */}
        {step === 'details' ? (
          <Card mode="elevated" style={styles.heroCard}>
            <Card.Content style={styles.heroContent}>
              {/* Top Row: Single Status Badge + Shift Pill */}
              <View style={styles.headerTopRow}>
                <OperationBadge
                  label={
                    task.status === 'completed'
                      ? 'Completed'
                      : task.status === 'acknowledged'
                        ? 'In Progress'
                        : formatTaskStatus(task.status)
                  }
                  tone={
                    task.status === 'completed'
                      ? {
                          backgroundColor: '#DCFCE7',
                          color: '#16A34A',
                          icon: 'check-circle-outline',
                        }
                      : task.status === 'acknowledged'
                        ? {
                            backgroundColor: '#FEF9E7',
                            color: '#C9A227',
                            icon: 'progress-clock',
                          }
                        : statusTone(task.status)
                  }
                />
                <View style={styles.shiftPill}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={13}
                    color={UI_COLORS.muted}
                  />
                  <Text style={styles.shiftPillText}>
                    {`${task.shift ?? '1st'} Shift`}
                  </Text>
                </View>
              </View>

              {/* Primary Restroom Headline */}
              <Text style={styles.locationHeadline}>
                {getRestroomLabel(task)}
              </Text>

              {/* Single Breadcrumb Subtitle */}
              <Text style={styles.locationBreadcrumb}>
                {`${task.floor} • ${task.location} • ${task.building}`}
              </Text>

              {/* Instruction Callout Box */}
              {task.message ? (
                <View style={styles.instructionCallout}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={18}
                    color={UI_COLORS.primary}
                    style={styles.instructionIcon}
                  />
                  <View style={styles.instructionTextWrapper}>
                    <Text style={styles.instructionLabel}>INSTRUCTION</Text>
                    <Text style={styles.instructionText}>
                      {task.message}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Meta Tags */}
              <View style={styles.metaRow}>
                <MetaPill
                  icon={getComponentMeta(task.component).icon}
                  label={getComponentMeta(task.component).label}
                />
                {task.type === 'cleaning' ? (
                  <MetaPill icon="broom" label="Cleaning" />
                ) : null}
                <MetaPill
                  icon="calendar-clock"
                  label={formatDate(task.createdAt)}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <AssigneeAvatarCluster task={task} showNames={true} />
              </View>

              {/* Direct Action Button */}
              {task.status !== 'completed' ? (
                <Button
                  mode="contained"
                  loading={actionInFlight}
                  disabled={actionInFlight}
                  onPress={() => void handleAction()}
                  contentStyle={styles.actionButtonContent}
                  style={styles.actionButton}
                  textColor="#FFFFFF"
                  labelStyle={styles.actionButtonLabel}
                  theme={{
                    colors: {
                      primary: '#B5121B',
                      onPrimary: '#FFFFFF',
                      surfaceDisabled: '#B5121B',
                      onSurfaceDisabled: '#FFFFFF',
                    },
                  }}
                  icon={
                    task.status === 'acknowledged'
                      ? 'camera-outline'
                      : 'clipboard-check-outline'
                  }
                >
                  {task.status === 'acknowledged'
                    ? 'Take Proof Photo'
                    : 'Acknowledge Task'}
                </Button>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {/* Step: Details - Completion Evidence if completed */}
        {step === 'details' && task.status === 'completed' ? (
              <Card mode="elevated" style={styles.detailCard}>
                <Card.Content style={styles.sectionContent}>
                  <View style={styles.sectionHeaderRow}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                      Completion Evidence
                    </Text>
                    {task.biometricVerified ? (
                      <Chip icon="shield-check" style={styles.verifiedChip}>
                        Biometric verified
                      </Chip>
                    ) : null}
                  </View>

                  {/* Side-by-Side Photo Container */}
                  <View style={styles.comparisonContainer}>
                    <View style={styles.comparisonColumn}>
                      <View style={styles.comparisonHeader}>
                        <MaterialCommunityIcons
                          name="camera"
                          size={13}
                          color="#6B7280"
                        />
                        <Text style={styles.comparisonLabel}>BEFORE PHOTO</Text>
                      </View>
                      {task.beforePhotoUrl ? (
                        <Image
                          source={{ uri: task.beforePhotoUrl }}
                          style={styles.comparisonPhoto}
                        />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Text style={styles.photoPlaceholderText}>
                            No photo
                          </Text>
                        </View>
                      )}
                      {task.beforePhotoCapturedAt ? (
                        <Text style={styles.photoTimestamp}>
                          {formatDate(task.beforePhotoCapturedAt)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.comparisonDivider}>
                      <MaterialCommunityIcons
                        name="arrow-right-bold"
                        size={16}
                        color="#94A3B8"
                      />
                    </View>

                    <View style={styles.comparisonColumn}>
                      <View style={styles.comparisonHeader}>
                        <MaterialCommunityIcons
                          name="camera-flip"
                          size={13}
                          color={UI_COLORS.primary}
                        />
                        <Text
                          style={[
                            styles.comparisonLabel,
                            { color: UI_COLORS.primary },
                          ]}
                        >
                          AFTER PHOTO
                        </Text>
                      </View>
                      {task.afterPhotoUrl ? (
                        <Image
                          source={{ uri: task.afterPhotoUrl }}
                          style={styles.comparisonPhoto}
                        />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Text style={styles.photoPlaceholderText}>
                            No photo
                          </Text>
                        </View>
                      )}
                      {task.afterPhotoCapturedAt ? (
                        <Text style={styles.photoTimestamp}>
                          {formatDate(task.afterPhotoCapturedAt)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <Divider />

                  <Text variant="titleSmall" style={styles.subSectionTitle}>
                    Checklist Verification
                  </Text>
                  {CHECKLIST_LABELS.map((item) => (
                    <View key={item.key} style={styles.completedChecklistRow}>
                      <MaterialCommunityIcons
                        name={
                          task.checklist?.[item.key] === 'na'
                            ? 'minus-circle-outline'
                            : 'check-circle'
                        }
                        size={18}
                        color={
                          task.checklist?.[item.key] === 'na'
                            ? '#6B7280'
                            : '#16A34A'
                        }
                      />
                      <Text variant="bodyMedium" style={styles.checklistResultText}>
                        {task.checklist?.[item.key] === 'na' ? 'N/A: ' : '✓ '}
                        {item.label}
                      </Text>
                    </View>
                  ))}

                  <Divider />
                  <Text variant="bodyMedium">
                    Remarks: {task.remarks || 'None'}
                  </Text>
                  <Text variant="bodyMedium">
                    Completed at: {formatDate(task.completedAt)}
                  </Text>
                </Card.Content>
              </Card>
        ) : null}

        {/* Step: Checklist */}
        {step === 'checklist' ? (
          <Card mode="elevated" style={styles.detailCard}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  SDCA F-TGS 203 Checklist
                </Text>
                <View style={styles.progressIndicatorBadge}>
                  <Text style={styles.progressIndicatorText}>
                    {checklistCheckedCount}/10 done
                  </Text>
                </View>
              </View>

              <Text variant="bodyMedium" style={styles.sectionHint}>
                Set every item to Done or N/A before taking the after photo.
              </Text>

              <ProgressBar
                progress={checklistProgress}
                color={UI_COLORS.primary}
                style={styles.progressBar}
              />

              {/* Chunked Categories */}
              {CHECKLIST_CATEGORIES.map((category) => (
                <View key={category.id} style={styles.categoryContainer}>
                  <View style={styles.categoryHeader}>
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={18}
                      color={UI_COLORS.primaryStrong}
                    />
                    <Text variant="titleSmall" style={styles.categoryTitle}>
                      {category.title}
                    </Text>
                  </View>

                  {category.items.map((item) => (
                    <View key={item.key} style={styles.checklistItem}>
                      <Text variant="bodyMedium" style={styles.checklistLabel}>
                        {item.label}
                      </Text>
                      <SegmentedButtons
                        value={checklist[item.key]}
                        onValueChange={(value) =>
                          setChecklist((current) => ({
                            ...current,
                            [item.key]: value as ChecklistValue,
                          }))
                        }
                        buttons={[
                          { value: 'unchecked', label: 'Unchecked' },
                          { value: 'done', label: 'Done' },
                          { value: 'na', label: 'N/A' },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              ))}

              <TextInput
                testID="remarks-input"
                label="Remarks"
                value={remarks}
                mode="outlined"
                multiline
                numberOfLines={4}
                onChangeText={setRemarks}
                style={styles.remarksInput}
              />
            </Card.Content>
          </Card>
        ) : null}

        {/* Step: Summary */}
        {step === 'summary' ? (
          <Card mode="elevated" style={styles.detailCard}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeaderRow}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Completion Summary
                </Text>
                {biometricVerified ? (
                  <View style={styles.biometricPill}>
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={16}
                      color="#16A34A"
                    />
                    <Text style={styles.biometricPillText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              {/* Side-by-side Proof Photos */}
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera"
                      size={13}
                      color="#6B7280"
                    />
                    <Text style={styles.comparisonLabel}>BEFORE PHOTO</Text>
                  </View>
                  {beforePhotoUri ? (
                    <Image
                      source={{ uri: beforePhotoUri }}
                      style={styles.comparisonPhoto}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>No photo</Text>
                    </View>
                  )}
                  {beforeCapturedAt ? (
                    <Text style={styles.photoTimestamp}>
                      {formatDate(beforeCapturedAt)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.comparisonDivider}>
                  <MaterialCommunityIcons
                    name="arrow-right-bold"
                    size={16}
                    color="#94A3B8"
                  />
                </View>

                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera-flip"
                      size={13}
                      color={UI_COLORS.primary}
                    />
                    <Text
                      style={[styles.comparisonLabel, { color: UI_COLORS.primary }]}
                    >
                      AFTER PHOTO
                    </Text>
                  </View>
                  {afterPhotoUri ? (
                    <Image
                      source={{ uri: afterPhotoUri }}
                      style={styles.comparisonPhoto}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>No photo</Text>
                    </View>
                  )}
                  {afterCapturedAt ? (
                    <Text style={styles.photoTimestamp}>
                      {formatDate(afterCapturedAt)}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.summaryStatsRow}>
                <View style={styles.summaryStatBox}>
                  <Text style={styles.summaryStatLabel}>Checklist Done</Text>
                  <Text style={styles.summaryStatValue}>
                    {
                      CHECKLIST_LABELS.filter(
                        (item) => checklist[item.key] === 'done',
                      ).length
                    }
                  </Text>
                </View>
                <View style={styles.summaryStatBox}>
                  <Text style={styles.summaryStatLabel}>Checklist N/A</Text>
                  <Text style={styles.summaryStatValue}>
                    {
                      CHECKLIST_LABELS.filter(
                        (item) => checklist[item.key] === 'na',
                      ).length
                    }
                  </Text>
                </View>
              </View>

              <Text variant="bodyMedium">
                Done:{' '}
                {
                  CHECKLIST_LABELS.filter(
                    (item) => checklist[item.key] === 'done',
                  ).length
                }
                {'  '}N/A:{' '}
                {
                  CHECKLIST_LABELS.filter(
                    (item) => checklist[item.key] === 'na',
                  ).length
                }
              </Text>
              <Text variant="bodyMedium">Remarks: {remarks || 'None'}</Text>
              <Text variant="bodyMedium">
                Biometric: {biometricVerified ? 'Verified' : 'Not verified'}
              </Text>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky Bottom Thumb Zone CTA for inline flow */}
      {step === 'checklist' || step === 'summary' ? (
        <View style={styles.stickyBottomZone}>
          {step === 'checklist' ? (
          <Button
            mode="contained"
            onPress={() => void captureAfterPhoto()}
            contentStyle={styles.primaryActionContent}
            style={styles.primaryAction}
            textColor="#FFFFFF"
            labelStyle={styles.primaryActionLabel}
            theme={{
              colors: {
                primary: '#B5121B',
                onPrimary: '#FFFFFF',
              },
            }}
            icon="camera-flip-outline"
          >
            Take After Photo
          </Button>
        ) : null}

        {step === 'summary' ? (
          <Button
            mode="contained"
            loading={actionInFlight}
            disabled={actionInFlight}
            onPress={() => void submitCompletion()}
            contentStyle={styles.primaryActionContent}
            style={styles.primaryAction}
            textColor="#FFFFFF"
            labelStyle={styles.primaryActionLabel}
            theme={{
              colors: {
                primary: '#B5121B',
                onPrimary: '#FFFFFF',
                surfaceDisabled: '#B5121B',
                onSurfaceDisabled: '#FFFFFF',
              },
            }}
            icon="cloud-upload-outline"
          >
            Submit Completion
          </Button>
        ) : null}
      </View>
      ) : null}

      {/* Hidden offscreen stage for burning timestamp overlay */}
      <View ref={overlayRef} collapsable={false} style={styles.overlayStage}>
        {overlayUri ? (
          <View style={styles.overlayFrame}>
            <Image source={{ uri: overlayUri }} style={styles.overlayImage} />
            <View style={styles.overlayBar}>
              <Text style={styles.overlayText}>{overlayText}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <Snackbar
        visible={snackbarMessage !== null}
        onDismiss={() => setSnackbarMessage(null)}
      >
        {snackbarMessage ?? ''}
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
    paddingBottom: 96,
    gap: 16,
    backgroundColor: UI_COLORS.background,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: UI_COLORS.background,
  },
  missingCopy: {
    textAlign: 'center',
    color: UI_COLORS.muted,
  },
  headerCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  heroContent: {
    gap: 12,
  },
  locationHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: UI_COLORS.text,
    letterSpacing: -0.3,
  },
  locationBreadcrumb: {
    fontSize: 13,
    fontWeight: '500',
    color: UI_COLORS.muted,
    marginTop: -4,
  },
  instructionCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  instructionIcon: {
    marginTop: 2,
  },
  instructionTextWrapper: {
    flex: 1,
    gap: 2,
  },
  instructionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  instructionText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 14,
    backgroundColor: UI_COLORS.primary,
    marginTop: 4,
  },
  actionButtonContent: {
    minHeight: 52,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerContent: {
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: UI_COLORS.softGray,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
  },
  shiftPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.muted,
  },
  headerHeadline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: UI_COLORS.text,
    letterSpacing: -0.3,
  },
  breadcrumbSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: UI_COLORS.muted,
  },
  componentTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  stepperCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  stepperCardContent: {
    gap: 12,
  },
  stepperTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
    fontSize: 15,
  },
  stepperContainer: {
    paddingVertical: 4,
  },
  stepperTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepperStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepperIndicatorWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepperDotDone: {
    backgroundColor: '#16A34A',
  },
  stepperDotCurrent: {
    backgroundColor: '#B5121B',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  stepperLine: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    top: 10,
    height: 2,
    backgroundColor: '#E5E5E5',
    zIndex: 1,
  },
  stepperLineDone: {
    backgroundColor: '#16A34A',
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: UI_COLORS.muted,
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: UI_COLORS.text,
    fontWeight: '800',
  },
  detailCard: {
    borderRadius: 20,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  sectionContent: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  subSectionTitle: {
    color: UI_COLORS.text,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionHint: {
    color: UI_COLORS.muted,
    lineHeight: 20,
  },
  progressIndicatorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  progressIndicatorText: {
    color: '#C9A227',
    fontWeight: '800',
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    marginBottom: 4,
  },
  categoryContainer: {
    gap: 10,
    paddingTop: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  categoryTitle: {
    color: '#B5121B',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: UI_COLORS.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: UI_COLORS.text,
    fontWeight: '700',
  },
  noteText: {
    color: UI_COLORS.text,
    fontSize: 17,
    lineHeight: 25,
  },
  stickyBottomZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: UI_COLORS.border,
    shadowColor: UI_COLORS.charcoal,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  primaryAction: {
    borderRadius: 14,
    backgroundColor: '#B5121B',
  },
  primaryActionContent: {
    minHeight: 52,
  },
  primaryActionLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryAction: {
    borderRadius: 14,
    borderColor: UI_COLORS.border,
  },
  checklistItem: {
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: UI_COLORS.softGray,
  },
  checklistLabel: {
    color: UI_COLORS.text,
    fontWeight: '800',
  },
  remarksInput: {
    marginTop: 4,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  comparisonColumn: {
    flex: 1,
    gap: 6,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  comparisonLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: UI_COLORS.muted,
    letterSpacing: 0.3,
  },
  comparisonPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: UI_COLORS.muted,
    fontWeight: '700',
  },
  photoTimestamp: {
    fontSize: 11,
    color: UI_COLORS.muted,
    fontWeight: '600',
  },
  comparisonDivider: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryStatBox: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: UI_COLORS.softGray,
    alignItems: 'center',
    gap: 4,
  },
  summaryStatLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: UI_COLORS.muted,
  },
  summaryStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: UI_COLORS.text,
  },
  biometricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: UI_COLORS.softGreen,
  },
  biometricPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: UI_COLORS.success,
  },
  verifiedChip: {
    backgroundColor: UI_COLORS.softGreen,
  },
  completedChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checklistResultText: {
    flex: 1,
    color: UI_COLORS.text,
    fontWeight: '600',
  },
  overlayStage: {
    position: 'absolute',
    left: -2000,
    top: 0,
    width: 1080,
    height: 1440,
  },
  overlayFrame: {
    width: 1080,
    height: 1440,
    backgroundColor: '#000000',
  },
  overlayImage: {
    width: 1080,
    height: 1440,
    resizeMode: 'cover',
  },
  overlayBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingVertical: 22,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
  },
});
