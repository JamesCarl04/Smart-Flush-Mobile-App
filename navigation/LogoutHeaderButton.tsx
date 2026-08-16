import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { KLIR_COLORS } from '../components/MaintenanceUI';
import { ProfileSheetModal } from '../components/ProfileSheetModal';
import { useAuth } from '../hooks/useAuth';
import { useOfflineSync } from '../hooks/useOfflineSync';

export function ProfileHeaderButton(): React.JSX.Element {
  const { user } = useAuth();
  const { syncing } = useOfflineSync();
  const [modalVisible, setModalVisible] = useState(false);

  const getInitials = (name?: string): string => {
    if (!name) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={styles.container}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open user profile and account options"
      >
        {syncing ? (
          <ActivityIndicator
            size={14}
            color={KLIR_COLORS.primary}
            style={styles.syncSpinner}
          />
        ) : null}

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: KLIR_COLORS.success,
              },
            ]}
          />
        </View>
      </TouchableOpacity>

      <ProfileSheetModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
      />
    </>
  );
}

// Backward-compatible alias
export const LogoutHeaderButton = ProfileHeaderButton;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  syncSpinner: {
    marginRight: 6,
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: KLIR_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
});
