import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Card, Divider, Snackbar, Text, TextInput } from 'react-native-paper';

import {
  EmptyOperationState,
  KLIR_RADII,
  MetaPill,
  OperationBadge,
  SegmentedFilterControl,
  UI_COLORS,
  getComponentMeta,
  sharedShadow,
  statusTone,
} from '../components/MaintenanceUI';
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
  if (!seconds) {
    return 'N/A';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} sec`;
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
    <View style={styles.seamlessEmptyContainer}>
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons
          name="clipboard-check-multiple-outline"
          size={32}
          color={UI_COLORS.primary}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
      </View>
      <Text style={styles.emptyTitle}>
        No completed tasks yet
      </Text>
      <Text style={styles.emptyBody}>
        Completed restroom work will appear here after proof photos and checklist submissions are closed out.
      </Text>
    </View>
  );
}

export function HistoryScreen({ navigation }: Props): React.JSX.Element {
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

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleHistory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleSection}>
              <Text variant="headlineSmall" style={styles.headerTitle}>
                Completed Work
              </Text>
              <Text variant="bodyMedium" style={styles.headerDescription}>
                Search verified restroom jobs and review submitted proof.
              </Text>
            </View>

            {/* Shift Performance Summary Header: Standardized 3-card grid */}
            <View style={styles.performanceGrid}>
              <Card mode="contained" style={styles.metricCard}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Tasks Completed</Text>
                  <Text style={styles.standardMetricValue}>{completedCount}</Text>
                </Card.Content>
              </Card>

              <Card mode="contained" style={styles.metricCard}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Avg Turnaround</Text>
                  <Text style={styles.standardMetricValue}>{avgTurnaround}</Text>
                </Card.Content>
              </Card>

              <Card mode="contained" style={styles.metricCard}>
                <Card.Content style={styles.metricContent}>
                  <Text style={styles.metricLabel}>Compliance</Text>
                  <Text style={styles.standardMetricValue}>{complianceRate}</Text>
                </Card.Content>
              </Card>
            </View>

            {/* Search Input */}
            <TextInput
              testID="text-input-outlined"
              label="Search completed jobs"
              value={searchQuery}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />

            {/* Range Filter Segmented Control */}
            <SegmentedFilterControl<HistoryRange>
              items={[
                { key: 'today', label: 'Today' },
                { key: 'week', label: '7 days' },
                { key: 'all', label: 'All' },
              ]}
              activeKey={selectedRange}
              onChange={setSelectedRange}
            />
          </View>
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
        renderItem={({ item }) => (
          <Card
            mode="contained"
            style={styles.taskCard}
            onPress={() =>
              navigation.navigate('TaskDetail', { taskId: item.id })
            }
          >
            <Card.Content style={styles.cardContent}>
              {/* Header Status & Finished Timestamp */}
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <OperationBadge
                    label={formatTaskStatus(item.status)}
                    tone={statusTone(item.status)}
                  />
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
                    <Text style={styles.previewThumbLabel}>BEFORE</Text>
                    {item.beforePhotoUrl ? (
                      <Image
                        source={{ uri: item.beforePhotoUrl }}
                        style={styles.previewThumbnail}
                      />
                    ) : (
                      <View style={styles.previewThumbEmpty}>
                        <Text style={styles.previewThumbEmptyText}>No photo</Text>
                      </View>
                    )}
                  </View>

                  <MaterialCommunityIcons
                    name="arrow-right-thin"
                    size={20}
                    color="#94A3B8"
                  />

                  <View style={styles.previewThumbWrapper}>
                    <Text style={[styles.previewThumbLabel, { color: UI_COLORS.primary }]}>
                      AFTER
                    </Text>
                    {item.afterPhotoUrl ? (
                      <Image
                        source={{ uri: item.afterPhotoUrl }}
                        style={styles.previewThumbnail}
                      />
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
                {item.offlineSynced ? (
                  <MetaPill icon="cloud-check-outline" label="Offline synced" />
                ) : null}
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
    backgroundColor: UI_COLORS.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: UI_COLORS.background,
    flexGrow: 1,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 8,
  },
  titleSection: {
    gap: 4,
  },
  headerTitle: {
    color: UI_COLORS.text,
    fontWeight: '900',
  },
  headerDescription: {
    color: UI_COLORS.muted,
    lineHeight: 22,
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  metricContent: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metricLabel: {
    color: UI_COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  standardMetricValue: {
    color: UI_COLORS.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: UI_COLORS.surface,
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
  seamlessEmptyContainer: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: UI_COLORS.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 22,
    color: UI_COLORS.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  taskCard: {
    borderRadius: KLIR_RADII.card,
    backgroundColor: UI_COLORS.surface,
    borderWidth: 1,
    borderColor: UI_COLORS.border,
    ...sharedShadow,
  },
  cardContent: {
    padding: 16,
    gap: 12,
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
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: KLIR_RADII.tag,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  biometricBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: UI_COLORS.successText,
  },
  titleBlock: {
    gap: 4,
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
  timeLabel: {
    fontSize: 12,
    color: UI_COLORS.muted,
    fontWeight: '500',
  },
  noteText: {
    color: UI_COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  previewThumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: KLIR_RADII.chip,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewThumbWrapper: {
    flex: 1,
    gap: 4,
  },
  previewThumbLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: UI_COLORS.muted,
    letterSpacing: 0.5,
  },
  previewThumbnail: {
    width: '100%',
    height: 76,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
  },
  previewThumbEmpty: {
    width: '100%',
    height: 76,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewThumbEmptyText: {
    fontSize: 11,
    color: UI_COLORS.muted,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
