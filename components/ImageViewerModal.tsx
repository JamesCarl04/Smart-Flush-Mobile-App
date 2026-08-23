import React from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';

import { INTER_FONT } from './MaintenanceUI';

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl: string | null;
  caption?: string | null;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ImageViewerModal({
  visible,
  imageUrl,
  caption,
  onDismiss,
}: ImageViewerModalProps): React.JSX.Element | null {
  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        {/* Top Header Row with Close Button */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Zoomable Scrollable Image Container */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent={true}
          bouncesZoom={true}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
            accessible={true}
            accessibilityLabel={caption ?? 'Supervisor inspection photo'}
          />
        </ScrollView>

        {/* Bottom Caption Pill */}
        {caption ? (
          <View style={styles.captionWrap}>
            <Text style={styles.captionText} numberOfLines={2}>
              {caption}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 50,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  captionWrap: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 50,
  },
  captionText: {
    fontFamily: INTER_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
});
