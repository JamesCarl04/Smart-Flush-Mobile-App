import * as ExpoImagePicker from 'expo-image-picker';

export type CameraPermissionResponse = ExpoImagePicker.CameraPermissionResponse;
export type ImagePickerAsset = ExpoImagePicker.ImagePickerAsset;
export type ImagePickerResult = ExpoImagePicker.ImagePickerResult;
export type ImagePickerOptions = ExpoImagePicker.ImagePickerOptions;

export const MediaTypeOptions = ExpoImagePicker.MediaTypeOptions;
export const CameraType = ExpoImagePicker.CameraType;

export async function requestCameraPermissionsAsync(): Promise<ExpoImagePicker.CameraPermissionResponse> {
  return ExpoImagePicker.requestCameraPermissionsAsync();
}

export async function launchCameraAsync(
  options: ExpoImagePicker.ImagePickerOptions = {}
): Promise<ExpoImagePicker.ImagePickerResult> {
  return ExpoImagePicker.launchCameraAsync(options);
}

export async function launchImageLibraryAsync(
  options: ExpoImagePicker.ImagePickerOptions = {}
): Promise<ExpoImagePicker.ImagePickerResult> {
  return ExpoImagePicker.launchImageLibraryAsync(options);
}