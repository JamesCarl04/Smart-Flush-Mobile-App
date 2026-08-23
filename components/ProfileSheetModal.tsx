import React, { useContext } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Divider } from 'react-native-paper';

import {
  KLIR_COLORS,
  KLIR_RADII,
  MetaPill,
  sharedShadow,
  getInitials,
} from './MaintenanceUI';
import { TasksContext } from '../contexts/TasksContext';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { emitLocalNotification } from '../lib/notifications';

interface ProfileSheetModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ProfileSheetModal({
  visible,
  onDismiss,
}: ProfileSheetModalProps): React.JSX.Element {
  const { user, role, logout } = useAuth();
  const { syncing } = useOfflineSync();
  const tasksCtx = useContext(TasksContext);

  const handleSimulateHardwareAlert = (): void => {
    const fakeTask = tasksCtx?.simulateHardwareFailureAlert?.();
    if (fakeTask) {
      emitLocalNotification({
        title: 'Hardware Failure: Restroom 2 • toilet-01',
        body: 'Continuous water running detected in flush valve (Critical Flow Leak).',
        taskId: fakeTask.id,
      });
    }
    onDismiss();
  };

  const handleLogout = (): void => {
    Alert.alert(
      'End Shift & Log Out?',
      'Are you sure you want to end your shift and log out of Klir Mobile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            onDismiss();
            void logout();
          },
        },
      ],
    );
  };

  const roleLabel =
    role === 'supervisor' ? 'Facility Supervisor' : 'Facility Technician';
  const buildingLabel = user?.building || 'Main Campus / All Buildings';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Grab Handle */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              {/* Close Button */}
              <TouchableOpacity
                onPress={onDismiss}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close profile"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={KLIR_COLORS.slateMuted}
                />
              </TouchableOpacity>

              {/* Worker Profile Header */}
              <View style={styles.profileHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {getInitials(user?.name)}
                  </Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: KLIR_COLORS.success,
                      },
                    ]}
                  />
                </View>

                <Text style={styles.workerName}>
                  {user?.name || 'Maintenance Personnel'}
                </Text>

                <View style={styles.roleRow}>
                  <MetaPill
                    label={roleLabel}
                    icon={
                      role === 'supervisor'
                        ? 'shield-crown-outline'
                        : 'shield-check-outline'
                    }
                  />
                </View>

                <Text style={styles.workerEmail}>
                  {user?.email || 'technician@sdca.edu.ph'}
                </Text>
              </View>

              <Divider style={styles.divider} />

              {/* Duty & Shift Meta */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>SHIFT & STATUS</Text>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconBox}>
                    <MaterialCommunityIcons
                      name="office-building-outline"
                      size={18}
                      color={KLIR_COLORS.primary}
                    />
                  </View>
                  <View style={styles.detailTextBox}>
                    <Text style={styles.detailLabel}>Assigned Facility</Text>
                    <Text style={styles.detailValue}>{buildingLabel}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconBox}>
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={18}
                      color={KLIR_COLORS.gold}
                    />
                  </View>
                  <View style={styles.detailTextBox}>
                    <Text style={styles.detailLabel}>Current Shift</Text>
                    <Text style={styles.detailValue}>
                      1st Shift • Active Duty
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIconBox}>
                    {syncing ? (
                      <ActivityIndicator
                        size={16}
                        color={KLIR_COLORS.primary}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="cloud-check-outline"
                        size={18}
                        color={KLIR_COLORS.success}
                      />
                    )}
                  </View>
                  <View style={styles.detailTextBox}>
                    <Text style={styles.detailLabel}>Sync Status</Text>
                    <Text style={styles.detailValue}>
                      {syncing
                        ? 'Synchronizing offline tasks...'
                        : 'All data synchronized'}
                    </Text>
                  </View>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* QA / Diagnostics Simulation Section */}
              <View style={styles.simulationSection}>
                <Text style={styles.simulationHeader}>SYSTEM SIMULATOR</Text>
                <TouchableOpacity
                  onPress={handleSimulateHardwareAlert}
                  style={styles.simulateAlertCard}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Simulate Hardware Failure Alert"
                >
                  <View style={styles.simulateIconBox}>
                    <MaterialCommunityIcons
                      name="alert-decagram"
                      size={22}
                      color="#B5121B"
                    />
                  </View>
                  <View style={styles.simulateTextBox}>
                    <Text style={styles.simulateTitle}>
                      Test Hardware Alert
                    </Text>
                    <Text style={styles.simulateSubtitle}>
                      Fires top push banner & creates urgent priority card
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color="#B5121B"
                  />
                </TouchableOpacity>
              </View>

              <Divider style={styles.divider} />

              {/* App Meta Footer */}
              <View style={styles.appMetaRow}>
                <Text style={styles.appMetaText}>
                  Klir Facility Ops • v1.0.0
                </Text>
                <Text style={styles.appMetaSub}>SDCA Smart Flush System</Text>
              </View>

              {/* End Shift & Log Out Button */}
              <TouchableOpacity
                onPress={handleLogout}
                style={styles.logoutButton}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="End shift and log out"
              >
                <MaterialCommunityIcons
                  name="logout-variant"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.logoutButtonText}>End Shift & Log Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    ...sharedShadow,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 6,
    borderRadius: 16,
    backgroundColor: KLIR_COLORS.canvas,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: KLIR_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  workerName: {
    fontSize: 18,
    fontWeight: '800',
    color: KLIR_COLORS.charcoal,
    marginTop: 10,
  },
  roleRow: {
    marginTop: 6,
  },
  workerEmail: {
    fontSize: 13,
    color: KLIR_COLORS.slateMuted,
    marginTop: 4,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#E5E5E5',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: KLIR_COLORS.slateMuted,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: KLIR_COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextBox: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: KLIR_COLORS.charcoal,
    marginTop: 1,
  },
  simulationSection: {
    gap: 8,
  },
  simulationHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: KLIR_COLORS.slateMuted,
  },
  simulateAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: KLIR_RADII.card,
    padding: 12,
    gap: 12,
  },
  simulateIconBox: {
    width: 38,
    height: 38,
    borderRadius: KLIR_RADII.chip,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simulateTextBox: {
    flex: 1,
  },
  simulateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
  },
  simulateSubtitle: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  appMetaRow: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 14,
  },
  appMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: KLIR_COLORS.slateMuted,
  },
  appMetaSub: {
    fontSize: 11,
    color: KLIR_COLORS.slateLight,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: KLIR_RADII.card,
    backgroundColor: KLIR_COLORS.primary,
    ...sharedShadow,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
