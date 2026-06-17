import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { captureRef } from 'react-native-view-shot';
import {
  Button,
  Card,
  Chip,
  Divider,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { TaskDetailSkeleton } from '../components/SkeletonScreens';
import {
  completeTaskOnline,
  currentUserId,
  isOnlineAsync,
  queueOfflineCompletion,
} from '../lib/task-completion';
import { CHECKLIST_LABELS, EMPTY_CHECKLIST, formatTaskStatus } from '../lib/tasks';
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

function formatComponent(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStatusChipStyle(status: Task['status']): object {
  if (status === 'completed') {
    return styles.completedChip;
  }

  if (status === 'acknowledged') {
    return styles.acknowledgedChip;
  }

  return styles.pendingChip;
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

function checklistComplete(checklist: TaskChecklist): boolean {
  return CHECKLIST_LABELS.every((item) => checklist[item.key] !== 'unchecked');
}

function checklistFirestoreValue(value: ChecklistValue): boolean | 'N/A' {
  return value === 'done' ? true : 'N/A';
}

function toFirestoreChecklist(checklist: TaskChecklist): Record<string, boolean | 'N/A'> {
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

export function TaskDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const { tasks, refreshTasks } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [step, setStep] = useState<FlowStep>('details');
  const [checklist, setChecklist] = useState<TaskChecklist>({ ...EMPTY_CHECKLIST });
  const [remarks, setRemarks] = useState('');
  const [beforePhotoUri, setBeforePhotoUri] = useState<string | null>(null);
  const [beforeCapturedAt, setBeforeCapturedAt] = useState<Date | null>(null);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [afterCapturedAt, setAfterCapturedAt] = useState<Date | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const overlayRef = useRef<View>(null);
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
    setChecklist(cachedTask.checklist ?? { ...EMPTY_CHECKLIST });
    setRemarks(cachedTask.remarks ?? '');
    setLoading(false);
    setLoadError(null);
  }, [cachedTask]);

  const refreshTaskDetail = useCallback(async (silent = false): Promise<void> => {
    if (!silent && !cachedTask) {
      setLoading(true);
    }

    try {
      const apiTask = await fetchTask(taskId);
      setTask(apiTask);
      setChecklist(apiTask.checklist ?? { ...EMPTY_CHECKLIST });
      setRemarks(apiTask.remarks ?? '');
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
  }, [cachedTask, taskId]);

  useEffect(() => {
    void refreshTaskDetail(Boolean(cachedTask));
  }, [cachedTask, refreshTaskDetail]);

  const handleAcknowledge = async (): Promise<void> => {
    if (!task || actionInFlight) {
      return;
    }

    setActionInFlight(true);
    try {
      await acknowledgeTask(task.id);
      const acknowledgedAt = new Date();
      setTask({ ...task, status: 'acknowledged', acknowledgedAt });
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
    const taskSuffix = task.id.slice(-6);
    setOverlayUri(prepared.uri);
    setOverlayText(
      `${formatDate(capturedAt)} | ${getRestroomLabel(task)} (${task.deviceId}) | Task ${taskSuffix}`,
    );
    await delay(250);

    if (!overlayRef.current) {
      return prepared.uri;
    }

    const captured = await captureRef(overlayRef, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
    });
    setOverlayUri(null);
    setOverlayText('');
    return captured;
  };

  const takePhoto = async (kind: 'before' | 'after'): Promise<void> => {
    if (!task) {
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Camera access is required to complete tasks.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const capturedAt = new Date();
    const stampedUri = await burnTimestampOverlay(result.assets[0].uri, capturedAt);

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
        error instanceof Error ? error.message : 'Unable to start completion flow.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const captureAfterPhoto = async (): Promise<void> => {
    if (!checklistComplete(checklist)) {
      setSnackbarMessage('Set every checklist item to Done or N/A before proceeding.');
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
      const firestoreChecklist = toFirestoreChecklist(checklist) as unknown as TaskChecklist;
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
      setTask({ ...task, status: 'completed', completedAt, completedBy: uid });
      setStep('details');
    } catch (error) {
      setSnackbarMessage(
        error instanceof Error ? error.message : 'Failed to submit completion.',
      );
    } finally {
      setActionInFlight(false);
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
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Card mode="contained" style={styles.headerCard}>
          <Card.Content style={styles.headerContent}>
            <Text variant="titleLarge">{getRestroomLabel(task)}</Text>
            <Text variant="bodyMedium" style={styles.headerCopy}>
              {task.location}, {task.floor}, {task.building}
            </Text>
            <Chip compact style={getStatusChipStyle(task.status)}>
              {formatTaskStatus(task.status)}
            </Chip>
          </Card.Content>
        </Card>

        {step === 'details' ? (
          <>
            <Card mode="elevated" style={styles.detailCard}>
              <Card.Content style={styles.sectionContent}>
                <DetailRow label="Component" value={formatComponent(task.component)} />
                <Divider />
                <DetailRow label="Created at" value={formatDate(task.createdAt)} />
                <Divider />
                <DetailRow label="Assigned to" value={user?.name ?? 'You'} />
                <Divider />
                <DetailRow label="Task ID" value={task.id} />
              </Card.Content>
            </Card>

            <Card mode="elevated" style={styles.detailCard}>
              <Card.Content style={styles.sectionContent}>
                <Text variant="titleMedium">Task details</Text>
                <Text variant="bodyLarge" style={styles.noteText}>
                  {task.message}
                </Text>
              </Card.Content>
            </Card>

            {task.status === 'assigned' || task.status === 'unassigned' ? (
              <Button
                mode="contained"
                loading={actionInFlight}
                disabled={actionInFlight}
                onPress={() => void handleAcknowledge()}
                contentStyle={styles.primaryActionContent}
              >
                Acknowledge Task
              </Button>
            ) : null}

            {task.status === 'acknowledged' ? (
              <Button
                mode="contained"
                loading={actionInFlight}
                disabled={actionInFlight}
                onPress={() => void startCompletionFlow()}
                contentStyle={styles.primaryActionContent}
              >
                Start Photo and Checklist
              </Button>
            ) : null}

            <Button mode="outlined" onPress={() => navigation.goBack()}>
              View History
            </Button>

            {task.status === 'completed' ? (
              <Card mode="elevated" style={styles.detailCard}>
                <Card.Content style={styles.sectionContent}>
                  <Text variant="titleMedium">Completion Evidence</Text>
                  <View style={styles.photoRow}>
                    {task.beforePhotoUrl ? (
                      <Image
                        source={{ uri: task.beforePhotoUrl }}
                        style={styles.summaryPhoto}
                      />
                    ) : null}
                    {task.afterPhotoUrl ? (
                      <Image
                        source={{ uri: task.afterPhotoUrl }}
                        style={styles.summaryPhoto}
                      />
                    ) : null}
                  </View>
                  {CHECKLIST_LABELS.map((item) => (
                    <Text key={item.key} variant="bodyMedium">
                      {task.checklist?.[item.key] === 'na' ? 'N/A' : '✓'}{' '}
                      {item.label}
                    </Text>
                  ))}
                  <Text variant="bodyMedium">
                    Remarks: {task.remarks || 'None'}
                  </Text>
                  <Text variant="bodyMedium">
                    Before photo: {formatDate(task.beforePhotoCapturedAt)}
                  </Text>
                  <Text variant="bodyMedium">
                    After photo: {formatDate(task.afterPhotoCapturedAt)}
                  </Text>
                  <Text variant="bodyMedium">
                    Completed at: {formatDate(task.completedAt)}
                  </Text>
                  {task.biometricVerified ? <Chip>Biometric verified</Chip> : null}
                </Card.Content>
              </Card>
            ) : null}
          </>
        ) : null}

        {step === 'checklist' ? (
          <Card mode="elevated" style={styles.detailCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">SDCA F-TGS 203 Checklist</Text>
              {CHECKLIST_LABELS.map((item) => (
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
              <TextInput
                label="Remarks"
                value={remarks}
                mode="outlined"
                multiline
                numberOfLines={4}
                onChangeText={setRemarks}
              />
              <Button mode="contained" onPress={() => void captureAfterPhoto()}>
                Take After Photo
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {step === 'summary' ? (
          <Card mode="elevated" style={styles.detailCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">Completion Summary</Text>
              <View style={styles.photoRow}>
                {beforePhotoUri ? (
                  <Image source={{ uri: beforePhotoUri }} style={styles.summaryPhoto} />
                ) : null}
                {afterPhotoUri ? (
                  <Image source={{ uri: afterPhotoUri }} style={styles.summaryPhoto} />
                ) : null}
              </View>
              <Text variant="bodyMedium">
                Done: {CHECKLIST_LABELS.filter((item) => checklist[item.key] === 'done').length}
                {'  '}N/A: {CHECKLIST_LABELS.filter((item) => checklist[item.key] === 'na').length}
              </Text>
              <Text variant="bodyMedium">Remarks: {remarks || 'None'}</Text>
              <Text variant="bodyMedium">
                Biometric: {biometricVerified ? 'Verified' : 'Not verified'}
              </Text>
              <Button
                mode="contained"
                loading={actionInFlight}
                disabled={actionInFlight}
                onPress={() => void submitCompletion()}
                contentStyle={styles.primaryActionContent}
              >
                Submit Completion
              </Button>
            </Card.Content>
          </Card>
        ) : null}
      </ScrollView>

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
    backgroundColor: '#f3faf8',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: '#f3faf8',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f3faf8',
  },
  missingCopy: {
    textAlign: 'center',
    color: '#586562',
  },
  headerCard: {
    borderRadius: 20,
    backgroundColor: '#dff4ef',
  },
  headerContent: {
    gap: 10,
  },
  headerCopy: {
    color: '#3a4c47',
  },
  detailCard: {
    borderRadius: 18,
  },
  sectionContent: {
    gap: 12,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#5b6764',
  },
  detailValue: {
    color: '#14211f',
  },
  noteText: {
    color: '#31403c',
    fontSize: 17,
    lineHeight: 25,
  },
  primaryActionContent: {
    minHeight: 52,
  },
  checklistItem: {
    gap: 8,
  },
  checklistLabel: {
    color: '#243532',
    fontWeight: '600',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryPhoto: {
    flex: 1,
    height: 180,
    borderRadius: 10,
    backgroundColor: '#dfe7e4',
  },
  pendingChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffe2de',
  },
  acknowledgedChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#dce9ff',
  },
  completedChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#d8f2db',
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
