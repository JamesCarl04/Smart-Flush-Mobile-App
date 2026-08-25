import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useContext, useMemo, useState } from 'react';
import { Card, Snackbar, Text, TextInput } from 'react-native-paper';

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
  statusTone,
} from '../components/MaintenanceUI';
import { AuthContext } from '../contexts/AuthContext';
import { useTasks } from '../hooks/useTasks';
import { getRestroomLabel } from '../lib/restrooms';
import { formatTaskComponent, formatTaskStatus } from '../lib/tasks';
import type { HistoryStackParamList, Task } from '../types';

type Props = NativeStackScreenProps<HistoryStackParamList, 'HistoryHome'>;
type HistoryRange = 'today' | 'week' | 'all';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return 'N/A';
  }

  const totalSecs = Math.round(seconds);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const remainder = totalSecs % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes} min ${remainder} sec`;
  }
  return `${remainder} sec`;
}

function formatAvgDuration(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return 'N/A';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function EmptyState(): React.JSX.Element {
  return (
    <EmptyOperationState
      icon="check-all"
      title="No completed tasks yet"
      body="Completed tasks with proof photos and checklists will appear here."
    />
  );
}

export function HistoryScreen({ navigation }: Props): React.JSX.Element {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const { historyTasks, loading, errorMessage, clearError } = useTasks();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRange, setSelectedRange] = useState<HistoryRange>('week');

  const visibleHistory = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return historyTasks.filter((task) => {
      const completedAt = task.completedAt ?? task.createdAt;
      const matchesRange =
        selectedRange === 'all' ||
        (selectedRange === 'today' && completedAt >= startOfToday) ||
        (selectedRange === 'week' && completedAt >= sevenDaysAgo);
      const matchesSearch =
        !normalizedQuery ||
        getRestroomLabel(task).toLowerCase().includes(normalizedQuery) ||
        task.deviceId.toLowerCase().includes(normalizedQuery) ||
        task.message.toLowerCase().includes(normalizedQuery);

      return matchesRange && matchesSearch;
    });
  }, [historyTasks, searchQuery, selectedRange]);

  const completedCount = visibleHistory.length;

  const avgTurnaround = useMemo(() => {
    const validDurations = visibleHistory
      .map((t) => t.workDuration)
      .filter((d): d is number => typeof d === 'number' && d > 0);
    if (validDurations.length === 0) {
      return 'N/A';
    }
    const total = validDurations.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(total / validDurations.length);
    return formatAvgDuration(avg);
  }, [visibleHistory]);

  const complianceRate = useMemo(() => {
    if (visibleHistory.length === 0) {
      return '100%';
    }
    const compliantCount = visibleHistory.filter(
      (t) => t.biometricVerified || t.status === 'completed',
    ).length;
    const rate = Math.round((compliantCount / visibleHistory.length) * 100);
    return `${rate}%`;
  }, [visibleHistory]);

  const userCleanName = user?.name ? user.name.replace(/\([^)]*\)/g, '').trim() : 'Technician';

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Top Section Header Row */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Text style={styles.sectionHeaderTitle}>Completed Work</Text>
                <Text style={styles.facilitySubtitle}>
                  {user?.building ? `${user.building} Facility` : 'SDCA Annex Facility'} • {userCleanName}
                </Text>
              </View>
            </View>

            {/* Shift Performance Summary Header: Standardized 3-card grid */}
            <View style={styles.performanceGrid}>
              <Card mode="contained" style={[styles.metricCard, styles.cardElevation]}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Tasks Completed</Text>
                  <Text style={styles.standardMetricValue}>{completedCount}</Text>
                  <Text style={styles.metricFooterText}>Completed</Text>
                </Card.Content>
              </Card>

              <Card mode="contained" style={[styles.metricCard, styles.cardElevation]}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Avg Duration</Text>
                  <Text style={styles.standardMetricValue}>{avgTurnaround}</Text>
                  <Text style={styles.metricFooterText}>Turnaround</Text>
                </Card.Content>
              </Card>

              <Card mode="contained" style={[styles.metricCard, styles.cardElevation]}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Compliance</Text>
                  <Text style={styles.standardMetricValue}>{complianceRate}</Text>
                  <Text style={styles.metricFooterText}>Verified</Text>
                </Card.Content>
              </Card>
            </View>

            {/* Search Input */}
            <TextInput
              testID="text-input-outlined"
              label="Search completed jobs"
              value={searchQuery}
              mode="outlined"
              outlineColor="#CBD5E1"
              activeOutlineColor={KLIR_COLORS.primary}
              left={<TextInput.Icon icon="magnify" />}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />

            {/* Range Filter Mobbin Segmented Control */}
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, selectedRange === 'today' && styles.segmentBtnActive]}
                onPress={() => setSelectedRange('today')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRange === 'today' }}
                accessibilityLabel="Today's completed tasks"
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    selectedRange === 'today' && styles.segmentBtnTextActive,
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, selectedRange === 'week' && styles.segmentBtnActive]}
                onPress={() => setSelectedRange('week')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRange === 'week' }}
                accessibilityLabel="Last 7 days completed tasks"
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    selectedRange === 'week' && styles.segmentBtnTextActive,
                  ]}
                >
                  7 days
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, selectedRange === 'all' && styles.segmentBtnActive]}
                onPress={() => setSelectedRange('all')}
                accessible={true}
                accessibilityRole="tab"
                accessibilityState={{ selected: selectedRange === 'all' }}
                accessibilityLabel="All completed tasks"
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    selectedRange === 'all' && styles.segmentBtnTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section Heading */}
            <Text style={styles.sectionHeaderTitle}>Completed Log ({visibleHistory.length})</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        renderItem={({ item }) => (
          <Card
            mode="elevated"
            style={[styles.taskCard, styles.cardElevation]}
            onPress={() =>
              navigation.navigate('TaskDetail', { taskId: item.id })
            }
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${getRestroomLabel(item)}, Completed`}
            accessibilityHint="Double tap to view before and after proof and 10-point checklist"
          >
            <Card.Content style={styles.cardContent}>
              {/* Header Status & Finished Timestamp */}
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  {item.inspectionStatus === 'approved' ? (
                    <OperationBadge label="Approved" tone={statusTone('completed')} />
                  ) : item.inspectionStatus === 'flagged' || item.status === 'flagged' ? (
                    <OperationBadge label="Flagged" tone={statusTone('flagged')} />
                  ) : item.status === 'rechecking' ? (
                    <OperationBadge label="Rechecking" tone={statusTone('rechecking')} />
                  ) : (
                    <OperationBadge
                      label={formatTaskStatus(item.status)}
                      tone={statusTone(item.status)}
                    />
                  )}
                  {item.biometricVerified ? (
                    <View style={styles.biometricBadge}>
                      <MaterialCommunityIcons
                        name="shield-check"
                        size={13}
                        color="#16A34A"
                      />
                      <Text style={styles.biometricBadgeText}>
                        Biometric Verified
                      </Text>
                    </View>
                  ) : null}
                </View>
                <MetaPill
                  icon="timer-check-outline"
                  label={formatDuration(item.workDuration)}
                />
              </View>

              {/* Restroom Title & Location Breadcrumb */}
              <View style={styles.titleBlock}>
                <Text style={styles.cardHeadline}>
                  {getRestroomLabel(item)}
                </Text>
                <Text style={styles.locationBreadcrumb}>
                  {`${item.floor} • ${item.location} • ${item.building}`}
                </Text>
                <Text style={styles.timeLabel}>
                  Finished {formatDate(item.completedAt ?? item.createdAt)}
                </Text>
              </View>

              <Text variant="bodyMedium" style={styles.noteText}>
                {item.message}
              </Text>

              {/* Before / After Photo Comparison Preview */}
              {item.beforePhotoUrl || item.afterPhotoUrl ? (
                <View style={styles.previewThumbnailContainer}>
                  <View style={styles.previewThumbWrapper}>
                    {item.beforePhotoUrl ? (
                      <View style={styles.thumbImageFrame}>
                        <Image
                          source={{ uri: item.beforePhotoUrl }}
                          style={styles.previewThumbnail}
                        />
                        <View style={styles.thumbOverlayTag}>
                          <Text style={styles.thumbOverlayText}>Before</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.previewThumbEmpty}>
                        <Text style={styles.previewThumbEmptyText}>No photo</Text>
                      </View>
                    )}
                  </View>

                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={16}
                    color="#94A3B8"
                  />

                  <View style={styles.previewThumbWrapper}>
                    {item.afterPhotoUrl ? (
                      <View style={styles.thumbImageFrame}>
                        <Image
                          source={{ uri: item.afterPhotoUrl }}
                          style={styles.previewThumbnail}
                        />
                        <View style={styles.thumbOverlayTag}>
                          <Text style={styles.thumbOverlayText}>After</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.previewThumbEmpty}>
                        <Text style={styles.previewThumbEmptyText}>No photo</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <MetaPill
                  icon={getComponentMeta(item.component).icon}
                  label={formatTaskComponent(item.component)}
                />
                <MetaPill icon="image-check-outline" label="Proof submitted" />
                {item.additionalPhotos && item.additionalPhotos.length > 0 ? (
                  <MetaPill
                    icon="camera-burst"
                    label={`+${item.additionalPhotos.length} areas`}
                  />
                ) : null}
                {item.offlineSynced ? (
                  <MetaPill icon="cloud-check-outline" label="Offline synced" />
                ) : null}
              </View>

              <View style={{ marginTop: 4 }}>
                <AssigneeAvatarCluster
                  task={item}
                  currentUserId={user?.uid}
                  currentUserName={user?.name}
                />
              </View>

              <View style={styles.inspectProofPrompt}>
                <MaterialCommunityIcons name="magnify" size={14} color={KLIR_COLORS.primary} />
                <Text style={styles.inspectProofText}>Tap to view checklist & photos →</Text>
              </View>
            </Card.Content>
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
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: KLIR_SPACING.lg,
    paddingBottom: 32,
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

  // Bento Performance Grid
  performanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  metricContent: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  metricLabel: {
    fontFamily: INTER_FONT,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  standardMetricValue: {
    fontFamily: INTER_FONT,
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginVertical: 1,
  },
  metricFooterText: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
  },

  // Segmented Range Control
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
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
  titleBlock: {
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
  timeLabel: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  noteText: {
    fontFamily: INTER_FONT,
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  // Photo Preview
  previewThumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  previewThumbWrapper: {
    flex: 1,
    height: 90,
  },
  thumbImageFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  previewThumbnail: {
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
  previewThumbEmpty: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewThumbEmptyText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
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
});
