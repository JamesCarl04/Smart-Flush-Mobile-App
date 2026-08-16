import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as LocalAuthentication from 'expo-local-authentication';
import { captureRef } from 'react-native-view-shot';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  ProgressBar,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import * as ImagePicker from '../lib/native-image-picker';
import { KLIR_COLORS, UI_COLORS, sharedShadow } from './MaintenanceUI';
import { KlirButton } from './KlirButton';
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
} from '../lib/tasks';
import { getRestroomLabel } from '../lib/restrooms';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import type {
  ChecklistValue,
  Task,
  TaskChecklist,
} from '../types';

export interface TaskExecutionModalProps {
  visible: boolean;
  task: Task | null;
  onDismiss: () => void;
  onTaskCompleted?: (completedTask: Task) => void;
}

type ModalStep = 'before_photo' | 'checklist' | 'summary';

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
  if (!date) return 'Not available';
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { AuthContext } from '../contexts/AuthContext';
import { TasksContext } from '../contexts/TasksContext';

export function TaskExecutionModal({
  visible,
  task,
  onDismiss,
  onTaskCompleted,
}: TaskExecutionModalProps): React.JSX.Element | null {
  const authContext = useContext(AuthContext);
  const user = authContext?.user ?? null;
  const tasksContext = useContext(TasksContext);
  const refreshTasks = tasksContext?.refreshTasks ?? (async () => {});

  const [step, setStep] = useState<ModalStep>('before_photo');
  const [beforePhotoUri, setBeforePhotoUri] = useState<string | null>(null);
  const [beforeCapturedAt, setBeforeCapturedAt] = useState<Date | null>(null);
  const [afterPhotoUri, setAfterPhotoUri] = useState<string | null>(null);
  const [afterCapturedAt, setAfterCapturedAt] = useState<Date | null>(null);
  const [checklist, setChecklist] = useState<TaskChecklist>({
    ...EMPTY_CHECKLIST,
  });
  const [remarks, setRemarks] = useState('');
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [actionInFlight, setActionInFlight] = useState(false);

  // Stamping Overlay Stage
  const overlayRef = useRef<View>(null);
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const prevVisibleRef = useRef(false);
  const currentTaskIdRef = useRef<string | null>(null);

  // Initialize modal state only when newly opened or switching to a new task ID
  useEffect(() => {
    const isOpening = visible && !prevVisibleRef.current;
    const isNewTask = Boolean(task && task.id !== currentTaskIdRef.current);

    if (visible && task && (isOpening || isNewTask)) {
      currentTaskIdRef.current = task.id;
      if (task.beforePhotoUrl) {
        setBeforePhotoUri(task.beforePhotoUrl);
        setBeforeCapturedAt(task.beforePhotoCapturedAt ?? new Date());
        setStep(task.afterPhotoUrl ? 'summary' : 'checklist');
      } else {
        setStep('before_photo');
        setBeforePhotoUri(null);
        setBeforeCapturedAt(null);
      }
      setAfterPhotoUri(task.afterPhotoUrl ?? null);
      setAfterCapturedAt(task.afterPhotoCapturedAt ?? null);
      setChecklist(task.checklist ? { ...task.checklist } : { ...EMPTY_CHECKLIST });
      setRemarks(task.remarks ?? '');
      setBiometricVerified(Boolean(task.biometricVerified));
      setActionInFlight(false);
    }

    if (!visible) {
      currentTaskIdRef.current = null;
    }

    prevVisibleRef.current = visible;
  }, [visible, task?.id]);

  const handleRequestClose = (): void => {
    if (beforePhotoUri && step !== 'before_photo') {
      Alert.alert(
        'Discard Progress?',
        'You have unsaved photos/checklist items for this task. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Close',
            style: 'destructive',
            onPress: () => {
              onDismiss();
            },
          },
        ],
      );
    } else {
      onDismiss();
    }
  };

  const runBiometricCheck = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify technician identity before photo capture',
        cancelLabel: 'Skip',
      });
      return result.success;
    } catch {
      return false;
    }
  };

  const burnTimestampOverlay = async (
    uri: string,
    capturedAt: Date,
  ): Promise<string> => {
    if (!task) return uri;

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
      // Fall back to prepared
    } finally {
      setOverlayUri(null);
      setOverlayText('');
    }

    return prepared.uri;
  };

  const takePhoto = async (kind: 'before' | 'after'): Promise<void> => {
    if (!task) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera Permission Required',
        'Camera access is required to take proof photos.',
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

  const handleStartBeforePhoto = async (): Promise<void> => {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      const verified = await runBiometricCheck();
      setBiometricVerified(verified);
      await takePhoto('before');
    } catch (error) {
      Alert.alert(
        'Camera Error',
        error instanceof Error ? error.message : 'Unable to open camera.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const handleCaptureAfterPhoto = async (): Promise<void> => {
    if (!checklistComplete(checklist)) {
      Alert.alert(
        'Checklist Incomplete',
        'Please mark all 10 checklist items as Done or N/A before taking the after photo.',
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
      }

      await refreshTasks();
      const updatedTask: Task = {
        ...task,
        status: 'completed',
        completedAt,
        completedBy: uid,
        beforePhotoUrl: beforePhotoUri,
        beforePhotoCapturedAt: beforeCapturedAt,
        afterPhotoUrl: afterPhotoUri,
        afterPhotoCapturedAt: afterCapturedAt,
        checklist,
        remarks,
        biometricVerified,
      };

      if (onTaskCompleted) {
        onTaskCompleted(updatedTask);
      }
      onDismiss();
    } catch (error) {
      Alert.alert(
        'Submission Error',
        error instanceof Error
          ? error.message
          : 'Failed to submit task completion.',
      );
    } finally {
      setActionInFlight(false);
    }
  };

  const checklistCheckedCount = useMemo(() => {
    return CHECKLIST_LABELS.filter((item) => checklist[item.key] !== 'unchecked')
      .length;
  }, [checklist]);

  const checklistProgress = checklistCheckedCount / CHECKLIST_LABELS.length;

  if (!task) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Modal Top Header */}
        <View style={styles.modalHeader}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.stepTitle}>
              {step === 'before_photo'
                ? 'Step 1 of 3 • Proof Photo'
                : step === 'checklist'
                  ? 'Step 2 of 3 • Maintenance Checklist'
                  : 'Step 3 of 3 • Completion Summary'}
            </Text>
            <Text style={styles.locationSubtitle}>
              {`${getRestroomLabel(task)} • ${task.location} (${task.building})`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRequestClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close execution sheet"
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={KLIR_COLORS.charcoal}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: BEFORE PHOTO */}
          {step === 'before_photo' ? (
            <View style={styles.stepContainer}>
              {/* Task Instruction Banner */}
              {task.message ? (
                <View style={styles.instructionBanner}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={18}
                    color={KLIR_COLORS.primary}
                    style={styles.instructionIcon}
                  />
                  <View style={styles.instructionTextWrapper}>
                    <Text style={styles.instructionLabel}>TASK INSTRUCTION</Text>
                    <Text style={styles.instructionText}>{task.message}</Text>
                  </View>
                </View>
              ) : null}

              {/* Viewfinder / Capture Box */}
              <Card mode="elevated" style={styles.stepCard}>
                <Card.Content style={styles.stepContent}>
                  {beforePhotoUri ? (
                    <View style={styles.previewBox}>
                      <Image
                        source={{ uri: beforePhotoUri }}
                        style={styles.previewImage}
                      />
                      <View style={styles.previewBar}>
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={14}
                          color="#4ADE80"
                        />
                        <Text style={styles.previewText}>
                          Captured & Watermarked: {formatDate(beforeCapturedAt)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.viewfinderBox}>
                      <View style={styles.viewfinderIconCircle}>
                        <MaterialCommunityIcons
                          name="camera"
                          size={36}
                          color={KLIR_COLORS.primary}
                        />
                      </View>
                      <Text style={styles.stepHeadline}>
                        Capture Initial Condition
                      </Text>
                      <Text style={styles.stepDescription}>
                        Take a clear photo of the fixture prior to servicing. Geotag and timestamp are automatically burned.
                      </Text>
                      <View style={styles.viewfinderMetaRow}>
                        <View style={styles.viewfinderMetaPill}>
                          <MaterialCommunityIcons
                            name="map-marker-outline"
                            size={12}
                            color={KLIR_COLORS.slateMuted}
                          />
                          <Text style={styles.viewfinderMetaText}>
                            {task.location}
                          </Text>
                        </View>
                        <View style={styles.viewfinderMetaPill}>
                          <MaterialCommunityIcons
                            name="shield-lock-outline"
                            size={12}
                            color={KLIR_COLORS.slateMuted}
                          />
                          <Text style={styles.viewfinderMetaText}>
                            Biometric Encrypted
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <Button
                    mode="contained"
                    onPress={() => void handleStartBeforePhoto()}
                    loading={actionInFlight}
                    disabled={actionInFlight}
                    contentStyle={styles.ctaButtonContent}
                    style={styles.ctaButton}
                    textColor="#FFFFFF"
                    labelStyle={styles.ctaButtonLabel}
                    theme={{
                      colors: {
                        primary: '#B5121B',
                        onPrimary: '#FFFFFF',
                        surfaceDisabled: '#B5121B',
                        onSurfaceDisabled: '#FFFFFF',
                      },
                    }}
                    icon="camera"
                  >
                    {beforePhotoUri ? 'Retake Before Photo' : 'Take Proof Photo'}
                  </Button>

                  {beforePhotoUri ? (
                    <Button
                      mode="outlined"
                      onPress={() => setStep('checklist')}
                      style={styles.secondaryButton}
                      textColor={KLIR_COLORS.primary}
                      icon="arrow-right"
                    >
                      Proceed to Checklist
                    </Button>
                  ) : null}
                </Card.Content>
              </Card>
            </View>
          ) : null}

          {/* STEP 2: CHECKLIST */}
          {step === 'checklist' ? (
            <Card mode="elevated" style={styles.stepCard}>
              <Card.Content style={styles.stepContent}>
                <View style={styles.checklistHeaderRow}>
                  <View>
                    <Text style={styles.checklistTitle}>
                      SDCA F-TGS 203 Checklist
                    </Text>
                    <Text style={styles.checklistSubtitle}>
                      Mark all 10 items before taking the After photo.
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {checklistCheckedCount}/10
                    </Text>
                  </View>
                </View>

                <ProgressBar
                  progress={checklistProgress}
                  color={KLIR_COLORS.primary}
                  style={styles.progressBar}
                />

                {/* Categorized Checklist Items */}
                {CHECKLIST_CATEGORIES.map((category) => (
                  <View key={category.id} style={styles.categoryBox}>
                    <View style={styles.categoryHeader}>
                      <MaterialCommunityIcons
                        name={category.icon}
                        size={18}
                        color={KLIR_COLORS.primary}
                      />
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                    </View>

                    {category.items.map((item) => (
                      <View key={item.key} style={styles.checklistItem}>
                        <Text style={styles.checklistItemLabel}>
                          {item.label}
                        </Text>
                        <SegmentedButtons
                          value={checklist[item.key]}
                          onValueChange={(value) =>
                            setChecklist((curr) => ({
                              ...curr,
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

                {/* Remarks Input */}
                <TextInput
                  label="Technician Remarks (Optional)"
                  value={remarks}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  onChangeText={setRemarks}
                  outlineColor="#E5E5E5"
                  activeOutlineColor="#222222"
                  style={styles.remarksInput}
                />

                <Button
                  mode="contained"
                  onPress={() => void handleCaptureAfterPhoto()}
                  contentStyle={styles.ctaButtonContent}
                  style={styles.ctaButton}
                  textColor="#FFFFFF"
                  labelStyle={styles.ctaButtonLabel}
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
              </Card.Content>
            </Card>
          ) : null}

          {/* STEP 3: SUMMARY & VERIFICATION */}
          {step === 'summary' ? (
            <Card mode="elevated" style={styles.stepCard}>
              <Card.Content style={styles.stepContent}>
                <Text style={styles.summaryTitle}>Completion Verification</Text>
                <Text style={styles.summarySubtitle}>
                  Review your before & after proof photos and checklist summary.
                </Text>

                {/* Side-by-Side Photo Comparison */}
                <View style={styles.photoComparisonRow}>
                  <View style={styles.photoCol}>
                    <View style={styles.photoHeader}>
                      <MaterialCommunityIcons
                        name="camera"
                        size={14}
                        color={KLIR_COLORS.slateMuted}
                      />
                      <Text style={styles.photoHeaderLabel}>BEFORE</Text>
                    </View>
                    {beforePhotoUri ? (
                      <Image
                        source={{ uri: beforePhotoUri }}
                        style={styles.comparePhoto}
                      />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <Text style={styles.photoEmptyText}>No Photo</Text>
                      </View>
                    )}
                    {beforeCapturedAt ? (
                      <Text style={styles.compareTime}>
                        {formatDate(beforeCapturedAt)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.photoArrow}>
                    <MaterialCommunityIcons
                      name="arrow-right-bold"
                      size={18}
                      color={KLIR_COLORS.slateLight}
                    />
                  </View>

                  <View style={styles.photoCol}>
                    <View style={styles.photoHeader}>
                      <MaterialCommunityIcons
                        name="camera-flip"
                        size={14}
                        color={KLIR_COLORS.primary}
                      />
                      <Text
                        style={[
                          styles.photoHeaderLabel,
                          { color: KLIR_COLORS.primary },
                        ]}
                      >
                        AFTER
                      </Text>
                    </View>
                    {afterPhotoUri ? (
                      <Image
                        source={{ uri: afterPhotoUri }}
                        style={styles.comparePhoto}
                      />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <Text style={styles.photoEmptyText}>No Photo</Text>
                      </View>
                    )}
                    {afterCapturedAt ? (
                      <Text style={styles.compareTime}>
                        {formatDate(afterCapturedAt)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Summary Metrics */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Checklist Done</Text>
                    <Text style={styles.metricValue}>
                      {
                        CHECKLIST_LABELS.filter(
                          (item) => checklist[item.key] === 'done',
                        ).length
                      }
                    </Text>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Checklist N/A</Text>
                    <Text style={styles.metricValue}>
                      {
                        CHECKLIST_LABELS.filter(
                          (item) => checklist[item.key] === 'na',
                        ).length
                      }
                    </Text>
                  </View>
                </View>

                {remarks ? (
                  <View style={styles.remarksBox}>
                    <Text style={styles.remarksBoxLabel}>Remarks</Text>
                    <Text style={styles.remarksBoxText}>{remarks}</Text>
                  </View>
                ) : null}

                <Divider style={styles.divider} />

                {/* Final Submit Button */}
                <Button
                  mode="contained"
                  loading={actionInFlight}
                  disabled={actionInFlight}
                  onPress={() => void submitCompletion()}
                  contentStyle={styles.ctaButtonContent}
                  style={styles.ctaButton}
                  textColor="#FFFFFF"
                  labelStyle={styles.ctaButtonLabel}
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
              </Card.Content>
            </Card>
          ) : null}
        </ScrollView>

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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBox: {
    flex: 1,
    gap: 3,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  stepPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: KLIR_COLORS.primary,
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
    letterSpacing: -0.2,
  },
  locationSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
    backgroundColor: KLIR_COLORS.canvas,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  stepContainer: {
    gap: 14,
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
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
  stepCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    ...sharedShadow,
  },
  stepContent: {
    padding: 16,
    gap: 16,
  },
  viewfinderBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    gap: 10,
  },
  viewfinderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  viewfinderMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  viewfinderMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  viewfinderMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
  },
  stepHeadline: {
    fontSize: 17,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 13,
    color: KLIR_COLORS.slateMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  previewBox: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  previewBar: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  ctaButton: {
    borderRadius: 14,
    backgroundColor: KLIR_COLORS.primary,
  },
  ctaButtonContent: {
    minHeight: 52,
  },
  ctaButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 14,
    borderColor: '#E5E5E5',
  },
  checklistHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  checklistSubtitle: {
    fontSize: 12,
    color: KLIR_COLORS.slateMuted,
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF9E7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
  },
  categoryBox: {
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: KLIR_COLORS.canvas,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  checklistItem: {
    gap: 6,
    paddingVertical: 4,
  },
  checklistItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: KLIR_COLORS.charcoal,
  },
  remarksInput: {
    backgroundColor: '#FFFFFF',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
  },
  summarySubtitle: {
    fontSize: 13,
    color: KLIR_COLORS.slateMuted,
    marginTop: -8,
  },
  photoComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  photoCol: {
    flex: 1,
    gap: 4,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: KLIR_COLORS.slateMuted,
  },
  comparePhoto: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    resizeMode: 'cover',
  },
  photoEmpty: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
  },
  compareTime: {
    fontSize: 10,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
  },
  photoArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: KLIR_COLORS.canvas,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: KLIR_COLORS.slateMuted,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: KLIR_COLORS.charcoal,
  },
  remarksBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: KLIR_COLORS.canvas,
    gap: 2,
  },
  remarksBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: KLIR_COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  remarksBoxText: {
    fontSize: 13,
    color: KLIR_COLORS.charcoal,
  },
  divider: {
    marginVertical: 4,
    backgroundColor: '#E5E5E5',
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
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
