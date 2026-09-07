import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from '../lib/native-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { captureRef } from 'react-native-view-shot';
import {
  Button,
  Card,
  Divider,
  ProgressBar,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { ImageViewerModal } from '../components/ImageViewerModal';
import { KlirButton } from '../components/KlirButton';
import {
  AssigneeAvatarCluster,
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
  getTaskDisplayStatus,
} from '../lib/tasks';
import { acknowledgeTask, fetchTask } from '../lib/task-api';
import { getRestroomLabel } from '../lib/restrooms';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import type {
  AreaPhoto,
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

function LinearWorkflowStepper({
  status,
  step,
  isUserSubmitted = false,
}: {
  status: Task['status'];
  step: FlowStep;
  isUserSubmitted?: boolean;
}): React.JSX.Element {
  const isDoneOrSubmitted = status === 'completed' || isUserSubmitted;
  const steps: Array<{
    key: string;
    label: string;
    isComplete: boolean;
    isCurrent: boolean;
  }> = [
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
        status === 'flagged' ||
        isDoneOrSubmitted,
      isCurrent: status === 'acknowledged' && step === 'details' && !isDoneOrSubmitted,
    },
    {
      key: 'proof',
      label: 'Proof & Check',
      isComplete: isDoneOrSubmitted || step === 'summary',
      isCurrent: (step === 'checklist' || step === 'summary') && !isDoneOrSubmitted,
    },
    {
      key: 'done',
      label: status === 'completed' ? 'Completed' : 'Submitted',
      isComplete: isDoneOrSubmitted,
      isCurrent: isDoneOrSubmitted,
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
  const [selectedViewerPhoto, setSelectedViewerPhoto] = useState<string | null>(null);
  const [viewerCaption, setViewerCaption] = useState<string | null>(null);
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const overlayRef = useRef<View>(null);
  const initializedTaskIdRef = useRef<string | null>(null);
  const taskId = route.params.taskId;
  const cachedTask = useMemo(
    () => tasks.find((currentTask) => currentTask.id === taskId) ?? null,
    [taskId, tasks],
  );

  const displayAdditionalPhotos = useMemo<AreaPhoto[]>(() => {
    if (!task) return [];
    if (task.additionalPhotos && task.additionalPhotos.length > 0) {
      return task.additionalPhotos;
    }
    if (task.submissions) {
      const userSubmission = user?.uid ? task.submissions[user.uid] : null;
      if (
        userSubmission?.additionalPhotos &&
        userSubmission.additionalPhotos.length > 0
      ) {
        return userSubmission.additionalPhotos;
      }
      const collected: AreaPhoto[] = [];
      for (const sub of Object.values(task.submissions)) {
        if (
          Array.isArray(sub.additionalPhotos) &&
          sub.additionalPhotos.length > 0
        ) {
          collected.push(...sub.additionalPhotos);
        }
      }
      if (collected.length > 0) {
        return collected;
      }
    }
    return [];
  }, [task, user?.uid]);

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
      const isTeam = Boolean(task.assignedToIds && task.assignedToIds.length > 1);

      const updatePayload: Record<string, any> = {
        status: 'acknowledged',
        acknowledgedAt: firestore.Timestamp.fromDate(acknowledgedAt),
        [`acknowledgedBy.${uid}`]: firestore.Timestamp.fromDate(acknowledgedAt),
      };

      if (!isTeam) {
        updatePayload.assignedTo = uid;
        updatePayload.assignedToIds = [uid];
        updatePayload.isBroadcast = false;
        updatePayload.assignmentType = 'individual';
      }

      try {
        await db.collection('tasks').doc(task.id).update(updatePayload);
        await db.collection('users').doc(uid).update({
          isAvailable: false,
          currentTaskId: task.id,
        });
      } catch (firestoreError) {
        console.warn('Direct Firestore acknowledge update warning:', firestoreError);
      }

      await acknowledgeTask(task.id);
      setTask(
        isTeam
          ? {
              ...task,
              status: 'acknowledged',
              acknowledgedAt,
              acknowledgedBy: {
                ...(task.acknowledgedBy ?? {}),
                [uid]: acknowledgedAt,
              },
            }
          : {
              ...task,
              status: 'acknowledged',
              acknowledgedAt,
              assignedTo: uid,
              assignedToIds: [uid],
              isBroadcast: false,
              assignmentType: 'individual',
              acknowledgedBy: {
                ...(task.acknowledgedBy ?? {}),
                [uid]: acknowledgedAt,
              },
            },
      );
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

  const handleCheckAllAsDone = (): void => {
    const allDone: TaskChecklist = {
      removeCeilingDust: 'done',
      removeWallDust: 'done',
      removeLightBulbDust: 'done',
      cleanWindows: 'done',
      wipeDownFixtures: 'done',
      disinfectTouchedSurfaces: 'done',
      sweepAndDryFloors: 'done',
      emptyTrashBins: 'done',
      arrangeFixtures: 'done',
      disinfectUVLights: 'done',
    };
    setChecklist(allDone);
  };

  const handleResetChecklist = (): void => {
    setChecklist({ ...EMPTY_CHECKLIST });
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
      let isFullyCompleted = true;

      if (online) {
        const outcome = await completeTaskOnline({
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
        isFullyCompleted = outcome?.isFullyCompleted ?? true;
        setSnackbarMessage(
          isFullyCompleted
            ? 'Task completed and synced.'
            : 'Checklist submitted. Work order remains active for teammate(s).',
        );
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
        isFullyCompleted = !(task.assignedToIds && task.assignedToIds.length > 1);
        setSnackbarMessage('Saved offline. Will sync when connected.');
      }

      await refreshTasks();
      setTask({
        ...task,
        status: isFullyCompleted ? 'completed' : 'acknowledged',
        ...(isFullyCompleted ? { completedAt, completedBy: uid } : {}),
        submissions: {
          ...(task.submissions ?? {}),
          [uid]: {
            technicianUid: uid,
            technicianName: user?.name ?? 'You',
            checklist: firestoreChecklist,
            beforePhotoUrl: beforePhotoUri,
            afterPhotoUrl: afterPhotoUri,
            remarks,
            completedAt,
            biometricVerified,
          },
        },
        beforePhotoUrl: beforePhotoUri,
        afterPhotoUrl: afterPhotoUri,
      });
      setStep('details');

      Alert.alert(
        isFullyCompleted ? 'Task Completed' : 'Checklist Submitted',
        isFullyCompleted
          ? 'Work order has been closed and verified. View your completed work in History.'
          : 'Your checklist has been submitted! You are now free for other tasks. This work order remains active for your teammate.',
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

  const [selectedSubmissionUid, setSelectedSubmissionUid] = useState<string | null>(null);

  const currentUid = user?.uid ?? currentUserId();
  const isTeam = Boolean(task?.assignedToIds && task.assignedToIds.length > 1);
  const isUserAcknowledged = Boolean(
    (task?.acknowledgedBy && currentUid && task.acknowledgedBy[currentUid]) ||
    (!isTeam && task?.status === 'acknowledged')
  );
  const isUserSubmitted = Boolean(
    currentUid && (
      (task?.submissions && task.submissions[currentUid]) ||
      (task?.completedBy && typeof task.completedBy === 'object' && (task.completedBy as Record<string, any>)[currentUid])
    )
  );

  const completedTeammateCount = useMemo(() => {
    if (!task?.assignedToIds || task.assignedToIds.length <= 1) return 0;
    return task.assignedToIds.filter((id) => {
      if (id === currentUid) return false;
      const sub = task.submissions?.[id];
      const comp =
        task.completedBy && typeof task.completedBy === 'object'
          ? (task.completedBy as Record<string, any>)[id]
          : null;
      return Boolean(sub || comp);
    }).length;
  }, [task, currentUid]);

  const submissionsList = useMemo(() => {
    if (!task?.submissions) return [];
    return Object.values(task.submissions);
  }, [task?.submissions]);

  const displayedSubmission = useMemo(() => {
    if (!task?.submissions) return null;
    if (selectedSubmissionUid && task.submissions[selectedSubmissionUid]) {
      return task.submissions[selectedSubmissionUid];
    }
    if (currentUid && task.submissions[currentUid]) {
      return task.submissions[currentUid];
    }
    const firstUid = Object.keys(task.submissions)[0];
    return firstUid ? task.submissions[firstUid] : null;
  }, [task?.submissions, selectedSubmissionUid, currentUid]);

  const displayedBeforePhoto = displayedSubmission?.beforePhotoUrl ?? task?.beforePhotoUrl;
  const displayedBeforeCapturedAt = displayedSubmission?.completedAt ?? task?.beforePhotoCapturedAt;
  const displayedAfterPhoto = displayedSubmission?.afterPhotoUrl ?? task?.afterPhotoUrl;
  const displayedAfterCapturedAt = displayedSubmission?.completedAt ?? task?.afterPhotoCapturedAt;
  const displayedChecklist = displayedSubmission?.checklist ?? task?.checklist;
  const displayedBiometric = displayedSubmission?.biometricVerified ?? task?.biometricVerified;

  const handleAction = async (): Promise<void> => {
    if (!task) return;
    if (!isUserAcknowledged) {
      await handleAcknowledge();
    } else {
      await startCompletionFlow();
    }
  };

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Linear Stepper Card */}
        <Card mode="elevated" style={[styles.stepperCard, styles.cardElevation]}>
          <Card.Content style={styles.stepperCardContent}>
            <Text style={styles.stepperTitle}>Task Progress</Text>
            <LinearWorkflowStepper status={task.status} step={step} isUserSubmitted={isUserSubmitted} />
          </Card.Content>
        </Card>

        {/* Hero Action Card */}
        {step === 'details' ? (
          <Card mode="elevated" style={[styles.heroCard, styles.cardElevation]}>
            <Card.Content style={styles.heroContent}>
              {/* Top Row: Status Badge (when in progress / not completed) */}
              {task.status !== 'completed' ? (
                <View style={styles.headerTopRow}>
                  <OperationBadge
                    label={
                      task.status === 'acknowledged'
                        ? 'In Progress'
                        : getTaskDisplayStatus(task)
                    }
                    tone={
                      task.status === 'acknowledged'
                        ? {
                            backgroundColor: '#FEF9E7',
                            color: '#C9A227',
                            icon: 'progress-clock',
                          }
                        : getTaskDisplayTone(task)
                    }
                  />
                </View>
              ) : null}

              {/* Primary Restroom Headline */}
              <Text style={styles.locationHeadline}>
                {getRestroomLabel(task)}
              </Text>

              {/* Breadcrumb Subtitle */}
              <Text style={styles.locationBreadcrumb}>
                {`${task.floor} • ${task.location} • ${task.building}`}
              </Text>

              {/* Instruction Callout Box */}
              {task.message ? (
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
                      {task.message}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Reassignment Reason Callout Banner */}
              {task.reassignReason ? (
                <View style={styles.reassignCallout}>
                  <MaterialCommunityIcons
                    name="swap-horizontal-bold"
                    size={16}
                    color="#D97706"
                    style={styles.instructionIcon}
                  />
                  <View style={styles.instructionTextWrapper}>
                    <Text style={styles.reassignLabel}>
                      REASSIGNED BY {task.reassignedByName ? task.reassignedByName.toUpperCase() : 'SUPERVISOR'}
                    </Text>
                    <Text style={styles.reassignText}>
                      Reason: {task.reassignReason}
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

              <View style={{ marginTop: 4 }}>
                <AssigneeAvatarCluster
                  task={task}
                  showNames={true}
                  currentUserId={user?.uid ?? currentUserId()}
                  currentUserName={user?.name}
                />
              </View>

              {/* Teammate status callout banners */}
              {task.status !== 'completed' && isUserSubmitted ? (
                <View style={styles.teammateWaitingCallout}>
                  <MaterialCommunityIcons
                    name="clock-check-outline"
                    size={18}
                    color="#0284C7"
                    style={styles.instructionIcon}
                  />
                  <View style={styles.instructionTextWrapper}>
                    <Text style={styles.teammateWaitingLabel}>CHECKLIST SUBMITTED</Text>
                    <Text style={styles.teammateWaitingText}>
                      Your checklist has been submitted. Waiting for remaining teammate(s) to finish before the work order is closed.
                    </Text>
                  </View>
                </View>
              ) : null}

              {task.status !== 'completed' && !isUserSubmitted && completedTeammateCount > 0 ? (
                <View style={styles.teammateProgressCallout}>
                  <MaterialCommunityIcons
                    name="account-check-outline"
                    size={18}
                    color="#059669"
                    style={styles.instructionIcon}
                  />
                  <View style={styles.instructionTextWrapper}>
                    <Text style={styles.teammateProgressLabel}>TEAMMATE SUBMITTED</Text>
                    <Text style={styles.teammateProgressText}>
                      {completedTeammateCount} teammate{completedTeammateCount > 1 ? 's' : ''} submitted their checklist. Complete your checklist to close this work order.
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Direct Action Button */}
              {task.status !== 'completed' && !isUserSubmitted ? (
                <KlirButton
                  title={
                    isUserAcknowledged
                      ? 'Take Proof Photo'
                      : 'Acknowledge Task'
                  }
                  variant="primary"
                  loading={actionInFlight}
                  disabled={actionInFlight}
                  onPress={() => void handleAction()}
                  style={styles.actionButton}
                  icon={
                    isUserAcknowledged
                      ? 'camera-outline'
                      : 'clipboard-check-outline'
                  }
                />
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {/* Step: Details - Completion Evidence if completed or user submitted */}
        {step === 'details' && (task.status === 'completed' || isUserSubmitted) ? (
          <Card mode="elevated" style={[styles.detailCard, styles.cardElevation]}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {task.status === 'completed' ? 'Completion Photos' : 'Your Submitted Evidence'}
                </Text>
                {displayedBiometric ? (
                  <View style={styles.biometricBadge}>
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={13}
                      color="#16A34A"
                    />
                    <Text style={styles.biometricBadgeText}>
                      Biometric verified
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Multi-Technician Submission Selector */}
              {submissionsList.length > 1 ? (
                <View style={styles.submissionSelectorContainer}>
                  <Text style={styles.submissionSelectorLabel}>Technician Submission:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {submissionsList.map((sub) => {
                      const isSelected =
                        (displayedSubmission?.technicianUid === sub.technicianUid);
                      return (
                        <TouchableOpacity
                          key={sub.technicianUid}
                          onPress={() => setSelectedSubmissionUid(sub.technicianUid)}
                          style={[
                            styles.submissionSelectPill,
                            isSelected && styles.submissionSelectPillActive,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={isSelected ? 'account-check' : 'account-outline'}
                            size={14}
                            color={isSelected ? '#FFFFFF' : '#475569'}
                          />
                          <Text
                            style={[
                              styles.submissionSelectPillText,
                              isSelected && styles.submissionSelectPillTextActive,
                            ]}
                          >
                            {sub.technicianName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Side-by-Side Photo Container */}
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={13}
                      color="#64748B"
                    />
                    <Text style={styles.comparisonLabel}>BEFORE</Text>
                  </View>
                  {displayedBeforePhoto ? (
                    <TouchableOpacity
                      style={styles.photoWrapper}
                      onPress={() => {
                        setSelectedViewerPhoto(displayedBeforePhoto ?? null);
                        setViewerCaption('Before Photo');
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="View Before photo fullscreen"
                    >
                      <Image
                        source={{ uri: displayedBeforePhoto }}
                        style={styles.comparisonPhoto}
                      />
                      <View style={styles.photoOverlayTag}>
                        <Text style={styles.photoOverlayText}>Before</Text>
                      </View>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          borderRadius: 12,
                          width: 22,
                          height: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialCommunityIcons name="magnify-plus" size={13} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        No photo
                      </Text>
                    </View>
                  )}
                  {displayedBeforeCapturedAt ? (
                    <Text style={styles.photoTimestamp}>
                      {formatDate(displayedBeforeCapturedAt)}
                    </Text>
                  ) : null}
                </View>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color="#94A3B8"
                />

                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera-flip-outline"
                      size={13}
                      color={KLIR_COLORS.primary}
                    />
                    <Text
                      style={[
                        styles.comparisonLabel,
                        { color: KLIR_COLORS.primary },
                      ]}
                    >
                      AFTER
                    </Text>
                  </View>
                  {displayedAfterPhoto ? (
                    <TouchableOpacity
                      style={styles.photoWrapper}
                      onPress={() => {
                        setSelectedViewerPhoto(displayedAfterPhoto ?? null);
                        setViewerCaption('After Photo');
                      }}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="View After photo fullscreen"
                    >
                      <Image
                        source={{ uri: displayedAfterPhoto }}
                        style={styles.comparisonPhoto}
                      />
                      <View style={styles.photoOverlayTag}>
                        <Text style={styles.photoOverlayText}>After</Text>
                      </View>
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 6,
                          right: 6,
                          backgroundColor: 'rgba(15, 23, 42, 0.75)',
                          borderRadius: 12,
                          width: 22,
                          height: 22,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialCommunityIcons name="magnify-plus" size={13} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        No photo
                      </Text>
                    </View>
                  )}
                  {displayedAfterCapturedAt ? (
                    <Text style={styles.photoTimestamp}>
                      {formatDate(displayedAfterCapturedAt)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Additional Area Photos Carousel */}
              {displayAdditionalPhotos.length > 0 ? (
                <View style={{ marginTop: 14 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons
                        name="camera-burst"
                        size={16}
                        color={KLIR_COLORS.primary}
                      />
                      <Text style={styles.subSectionTitle}>
                        Additional Area Proofs
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: '#EDE9FE',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: '#6D28D9',
                        }}
                      >
                        {displayAdditionalPhotos.length}{' '}
                        {displayAdditionalPhotos.length === 1 ? 'Area' : 'Areas'}
                      </Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {displayAdditionalPhotos.map((areaPhoto) => (
                      <TouchableOpacity
                        key={areaPhoto.id}
                        onPress={() => {
                          setSelectedViewerPhoto(areaPhoto.photoUrl);
                          setViewerCaption(`${areaPhoto.areaTag} Photo`);
                        }}
                        style={{
                          width: 130,
                          borderRadius: 8,
                          overflow: 'hidden',
                          borderWidth: 1,
                          borderColor: '#CBD5E1',
                          backgroundColor: '#FFFFFF',
                        }}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${areaPhoto.areaTag} photo`}
                      >
                        <Image
                          source={{ uri: areaPhoto.photoUrl }}
                          style={{ width: 130, height: 95 }}
                        />
                        <View
                          style={{
                            padding: 6,
                            backgroundColor: '#0F172A',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: 11,
                              fontWeight: '700',
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {areaPhoto.areaTag}
                          </Text>
                          <MaterialCommunityIcons
                            name="magnify-plus"
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Divider style={{ marginVertical: 4 }} />

              <Text style={styles.subSectionTitle}>
                Checklist Verification (10 items)
              </Text>
              {CHECKLIST_LABELS.map((item) => {
                const isNa = (displayedChecklist?.[item.key] ?? task.checklist?.[item.key]) === 'na';
                return (
                  <View key={item.key} style={styles.completedChecklistRow}>
                    <View
                      style={[
                        styles.checklistSymbolBox,
                        isNa ? styles.checklistSymbolBoxNa : styles.checklistSymbolBoxDone,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isNa ? 'minus' : 'check'}
                        size={13}
                        color={isNa ? '#64748B' : '#16A34A'}
                      />
                    </View>
                    <Text style={styles.checklistResultText}>
                      {isNa ? `[N/A] ${item.label}` : item.label}
                    </Text>
                  </View>
                );
              })}

              <Divider style={{ marginVertical: 4 }} />
              <Text style={styles.detailSummaryText}>
                Remarks: {displayedSubmission?.remarks ?? task.remarks ?? 'None'}
              </Text>
              <Text style={styles.detailSummaryText}>
                Completed at: {formatDate(displayedSubmission?.completedAt ?? task.completedAt)}
              </Text>
            </Card.Content>
          </Card>
        ) : null}

        {/* Step: Checklist */}
        {step === 'checklist' ? (
          <Card mode="elevated" style={[styles.detailCard, styles.cardElevation]}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  SDCA F-TGS 203 Checklist
                </Text>
                <View style={styles.progressIndicatorBadge}>
                  <Text style={styles.progressIndicatorText}>
                    {checklistCheckedCount}/10 done
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionHint}>
                Set every item to Done or N/A before taking the after photo.
              </Text>

              <ProgressBar
                progress={checklistProgress}
                color={KLIR_COLORS.primary}
                style={styles.progressBar}
              />

              {/* 1-Tap Quick Action Button */}
              <View style={{ marginTop: 10, marginBottom: 8 }}>
                {CHECKLIST_LABELS.filter((item) => checklist[item.key] === 'done' || checklist[item.key] === 'na').length === 10 ? (
                  <KlirButton
                    title="Reset All Items"
                    variant="outline"
                    onPress={handleResetChecklist}
                    icon="refresh"
                  />
                ) : (
                  <KlirButton
                    title="Check All as Done"
                    variant="primary"
                    onPress={handleCheckAllAsDone}
                    icon="check-all"
                  />
                )}
              </View>

              {/* Chunked Categories */}
              {CHECKLIST_CATEGORIES.map((category) => (
                <View key={category.id} style={styles.categoryContainer}>
                  <View style={styles.categoryHeader}>
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={16}
                      color={KLIR_COLORS.primary}
                    />
                    <Text style={styles.categoryTitle}>
                      {category.title}
                    </Text>
                  </View>

                  {category.items.map((item) => (
                    <View key={item.key} style={styles.checklistItem}>
                      <Text style={styles.checklistLabel}>
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
                numberOfLines={3}
                outlineColor="#CBD5E1"
                activeOutlineColor={KLIR_COLORS.primary}
                onChangeText={setRemarks}
                style={styles.remarksInput}
              />
            </Card.Content>
          </Card>
        ) : null}

        {/* Step: Summary */}
        {step === 'summary' ? (
          <Card mode="elevated" style={[styles.detailCard, styles.cardElevation]}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Completion Summary
                </Text>
                {biometricVerified ? (
                  <View style={styles.biometricBadge}>
                    <MaterialCommunityIcons
                      name="shield-check"
                      size={13}
                      color="#16A34A"
                    />
                    <Text style={styles.biometricBadgeText}>Verified</Text>
                  </View>
                ) : null}
              </View>

              {/* Side-by-side Proof Photos */}
              <View style={styles.comparisonContainer}>
                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={13}
                      color="#64748B"
                    />
                    <Text style={styles.comparisonLabel}>BEFORE</Text>
                  </View>
                  {beforePhotoUri ? (
                    <View style={styles.photoWrapper}>
                      <Image
                        source={{ uri: beforePhotoUri }}
                        style={styles.comparisonPhoto}
                      />
                      <View style={styles.photoOverlayTag}>
                        <Text style={styles.photoOverlayText}>Before</Text>
                      </View>
                    </View>
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

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={16}
                  color="#94A3B8"
                />

                <View style={styles.comparisonColumn}>
                  <View style={styles.comparisonHeader}>
                    <MaterialCommunityIcons
                      name="camera-flip-outline"
                      size={13}
                      color={KLIR_COLORS.primary}
                    />
                    <Text
                      style={[styles.comparisonLabel, { color: KLIR_COLORS.primary }]}
                    >
                      AFTER
                    </Text>
                  </View>
                  {afterPhotoUri ? (
                    <View style={styles.photoWrapper}>
                      <Image
                        source={{ uri: afterPhotoUri }}
                        style={styles.comparisonPhoto}
                      />
                      <View style={styles.photoOverlayTag}>
                        <Text style={styles.photoOverlayText}>After</Text>
                      </View>
                    </View>
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

              <Text style={styles.detailSummaryText}>
                Remarks: {remarks || 'None'}
              </Text>
              <Text style={styles.detailSummaryText}>
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
            <KlirButton
              title="Take After Photo"
              variant="primary"
              onPress={() => void captureAfterPhoto()}
              icon="camera-flip-outline"
              style={styles.primaryAction}
            />
          ) : null}

          {step === 'summary' ? (
            <KlirButton
              title="Submit Completion"
              variant="primary"
              loading={actionInFlight}
              disabled={actionInFlight}
              onPress={() => void submitCompletion()}
              icon="cloud-upload-outline"
              style={styles.primaryAction}
            />
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

      <ImageViewerModal
        visible={selectedViewerPhoto !== null}
        imageUrl={selectedViewerPhoto}
        caption={viewerCaption}
        onDismiss={() => {
          setSelectedViewerPhoto(null);
          setViewerCaption(null);
        }}
      />

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
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: KLIR_SPACING.lg,
    paddingBottom: 96,
    gap: KLIR_SPACING.md,
    backgroundColor: '#F8FAFC',
  },
  cardElevation: {
    ...cardElevation,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  missingCopy: {
    textAlign: 'center',
    color: '#64748B',
  },

  // Stepper
  stepperCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  stepperCardContent: {
    padding: 16,
    gap: 12,
  },
  stepperTitle: {
    fontFamily: INTER_FONT,
    color: '#0F172A',
    fontWeight: '800',
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
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepperDotDone: {
    backgroundColor: '#16A34A',
  },
  stepperDotCurrent: {
    backgroundColor: KLIR_COLORS.primary,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  stepperLine: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    top: 10,
    height: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 1,
  },
  stepperLineDone: {
    backgroundColor: '#16A34A',
  },
  stepperLabel: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  // Hero Card
  heroCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  heroContent: {
    padding: 16,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
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
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  instructionText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 19,
  },
  reassignCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  reassignLabel: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  reassignText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#78350F',
    fontWeight: '600',
    lineHeight: 19,
  },
  teammateWaitingCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  teammateWaitingLabel: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
    letterSpacing: 0.5,
  },
  teammateWaitingText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#075985',
    fontWeight: '600',
    lineHeight: 19,
  },
  teammateProgressCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  teammateProgressLabel: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  teammateProgressText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
    lineHeight: 19,
  },
  submissionSelectorContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  submissionSelectorLabel: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  submissionSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  submissionSelectPillActive: {
    backgroundColor: KLIR_COLORS.primary,
    borderColor: KLIR_COLORS.primary,
  },
  submissionSelectPillText: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  submissionSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  actionButton: {
    borderRadius: 12,
    marginTop: 4,
  },

  // Detail & Evidence Cards
  detailCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  sectionContent: {
    padding: 16,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: INTER_FONT,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subSectionTitle: {
    fontFamily: INTER_FONT,
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 2,
  },
  sectionHint: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  progressIndicatorBadge: {
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: KLIR_RADII.tag,
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  progressIndicatorText: {
    fontFamily: INTER_FONT,
    color: '#B45309',
    fontWeight: '800',
    fontSize: 11,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
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
    fontFamily: INTER_FONT,
    color: KLIR_COLORS.primary,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  checklistItem: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  checklistLabel: {
    fontFamily: INTER_FONT,
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  remarksInput: {
    backgroundColor: '#FFFFFF',
    marginTop: 4,
  },

  // Comparison Photos
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  photoWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  comparisonPhoto: {
    width: '100%',
    height: '100%',
  },
  photoOverlayTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoOverlayText: {
    fontFamily: INTER_FONT,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  photoPlaceholder: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: INTER_FONT,
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  photoTimestamp: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Summary Stats
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryStatBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EAECF0',
    alignItems: 'center',
    gap: 2,
  },
  summaryStatLabel: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  summaryStatValue: {
    fontFamily: INTER_FONT,
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailSummaryText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },

  biometricBadge: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: KLIR_RADII.tag,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  biometricBadgeText: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  completedChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checklistSymbolBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistSymbolBoxDone: {
    backgroundColor: '#DCFCE7',
  },
  checklistSymbolBoxNa: {
    backgroundColor: '#F1F5F9',
  },
  checklistResultText: {
    fontFamily: INTER_FONT,
    flex: 1,
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 13,
  },

  // Sticky Bottom Zone
  stickyBottomZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#EAECF0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  primaryAction: {
    borderRadius: 12,
  },

  // Offscreen Overlay Stage
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
