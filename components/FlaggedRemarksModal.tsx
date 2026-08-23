import React, { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';

import {
  INTER_FONT,
  KLIR_COLORS,
  KLIR_RADII,
  KLIR_TYPOGRAPHY,
} from './MaintenanceUI';
import { KlirButton } from './KlirButton';
import { ImageViewerModal } from './ImageViewerModal';
import type { Task } from '../types';

interface FlaggedRemarksModalProps {
  visible: boolean;
  task: Task | null;
  loading?: boolean;
  onDismiss: () => void;
  onAcceptRecheck: (task: Task) => Promise<void> | void;
}

function formatRelativeTime(date?: Date | string | number | null): string {
  if (!date) return 'Recently';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

export function FlaggedRemarksModal({
  visible,
  task,
  loading = false,
  onDismiss,
  onAcceptRecheck,
}: FlaggedRemarksModalProps): React.JSX.Element | null {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!visible || !task) return null;

  const photoUrls = task.flagPhotoUrls ?? [];
  const supervisorName = task.inspectedByName ?? 'Lead Supervisor';

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onDismiss}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetContainer}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.flagIconWrap}>
                  <MaterialCommunityIcons
                    name="flag-variant"
                    size={20}
                    color="#DC2626"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Flagged for Re-inspection</Text>
                  <Text style={styles.sheetSubtitle} numberOfLines={1}>
                    {task.location} • {task.deviceId}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.headerCloseBtn}
                onPress={onDismiss}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close remarks modal"
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Supervisor Info Banner */}
              <View style={styles.supervisorInfoCard}>
                <MaterialCommunityIcons
                  name="account-tie-outline"
                  size={20}
                  color="#2563EB"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supervisorNameText}>{supervisorName}</Text>
                  <Text style={styles.supervisorTimeText}>
                    Flagged {formatRelativeTime(task.inspectedAt)}
                  </Text>
                </View>
                {task.recheckCount && task.recheckCount > 1 ? (
                  <View style={styles.recheckBadge}>
                    <Text style={styles.recheckBadgeText}>
                      Recheck #{task.recheckCount}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Supervisor Reason Callout */}
              <View style={styles.reasonCard}>
                <Text style={styles.reasonSectionTitle}>Supervisor Remarks</Text>
                <Text style={styles.reasonBodyText}>
                  {task.flagReason || 'No specific explanation provided.'}
                </Text>
              </View>

              {/* Attached Photos Gallery */}
              {photoUrls.length > 0 ? (
                <View style={styles.photosSection}>
                  <Text style={styles.photosSectionTitle}>
                    Supervisor Reference Photos ({photoUrls.length})
                  </Text>
                  <Text style={styles.photosSectionSubtitle}>
                    Tap a photo to zoom and inspect flagged details
                  </Text>

                  <View style={styles.photoGrid}>
                    {photoUrls.map((url, idx) => (
                      <TouchableOpacity
                        key={`${url}-${idx}`}
                        style={styles.photoThumbWrap}
                        onPress={() => setSelectedPhoto(url)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`View supervisor reference photo ${idx + 1}`}
                      >
                        <Image
                          source={{ uri: url }}
                          style={styles.photoThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.zoomBadge}>
                          <MaterialCommunityIcons
                            name="magnify-plus-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Action Footer */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onDismiss}
                disabled={loading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <KlirButton
                  title="Accept Recheck"
                  variant="primary"
                  onPress={() => void onAcceptRecheck(task)}
                  loading={loading}
                  disabled={loading}
                  icon="check-circle-outline"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lightbox Pinch-to-Zoom Modal */}
      <ImageViewerModal
        visible={selectedPhoto !== null}
        imageUrl={selectedPhoto}
        caption={`Supervisor Reference Photo • ${task.location}`}
        onDismiss={() => setSelectedPhoto(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  flagIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: INTER_FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  headerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingVertical: 16,
    gap: 14,
  },
  supervisorInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  supervisorNameText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  supervisorTimeText: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#60A5FA',
  },
  recheckBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: KLIR_RADII.tag,
  },
  recheckBadgeText: {
    fontFamily: INTER_FONT,
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  reasonCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  reasonSectionTitle: {
    fontFamily: INTER_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reasonBodyText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: '#78350F',
    lineHeight: 20,
  },
  photosSection: {
    gap: 6,
  },
  photosSectionTitle: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  photosSectionSubtitle: {
    fontFamily: INTER_FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbWrap: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: INTER_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
