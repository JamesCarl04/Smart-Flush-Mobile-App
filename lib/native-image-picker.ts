import { requireNativeModule, UnavailabilityError } from 'expo-modules-core';

const ExponentImagePicker = requireNativeModule<{
  requestCameraPermissionsAsync: () => Promise<CameraPermissionResponse>;
  launchCameraAsync?: (options: ImagePickerOptions) => Promise<ImagePickerResult>;
}>('ExponentImagePicker');

export interface CameraPermissionResponse {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  expires: string | number;
}

export interface ImagePickerAsset {
  uri: string;
  width?: number;
  height?: number;
  type?: string;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string;
}

export type ImagePickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: ImagePickerAsset[] };

export interface ImagePickerOptions {
  mediaTypes?: 'Images' | 'Videos' | 'All';
  allowsEditing?: boolean;
  quality?: number;
  cameraType?: 'back' | 'front';
}

export const MediaTypeOptions = {
  Images: 'Images',
  Videos: 'Videos',
  All: 'All',
} as const;

export const CameraType = {
  back: 'back',
  front: 'front',
} as const;

export async function requestCameraPermissionsAsync(): Promise<CameraPermissionResponse> {
  return ExponentImagePicker.requestCameraPermissionsAsync();
}

export async function launchCameraAsync(options: ImagePickerOptions = {}): Promise<ImagePickerResult> {
  if (!ExponentImagePicker.launchCameraAsync) {
    throw new UnavailabilityError('ImagePicker', 'launchCameraAsync');
  }

  return ExponentImagePicker.launchCameraAsync(options);
}