import type { Task } from '../types';

const RESTROOM_LABELS_BY_DEVICE_ID: Record<string, string> = {
  // Legacy / Test IDs
  FShQvy5eRcTVcREcNbns: 'Restroom 1',
  'toilet-01': 'Restroom 2',

  // 1st Floor (Canteen + Faculty Restrooms)
  'SDCA-FL1-CANTEEN-M': 'SDCA Annex 1F Canteen Male Restroom',
  'SDCA-FL1-CANTEEN-F': 'SDCA Annex 1F Canteen Female Restroom',
  'SDCA-FL1-FACULTY-M': 'SDCA Annex 1F Faculty Male Restroom',
  'SDCA-FL1-FACULTY-F': 'SDCA Annex 1F Faculty Female Restroom',
  'SDCA-FL1-M': 'SDCA Annex 1F Canteen Male Restroom',
  'SDCA-FL1-F': 'SDCA Annex 1F Canteen Female Restroom',

  // 2nd Floor (2 Male, 2 Female, 1 PWD)
  'SDCA-FL2-M1': 'SDCA Annex 2F Male Restroom 1',
  'SDCA-FL2-M2': 'SDCA Annex 2F Male Restroom 2',
  'SDCA-FL2-F1': 'SDCA Annex 2F Female Restroom 1',
  'SDCA-FL2-F2': 'SDCA Annex 2F Female Restroom 2',
  'SDCA-FL2-PWD': 'SDCA Annex 2F PWD Restroom',
  'SDCA-FL2-M': 'SDCA Annex 2F Male Restroom 1',
  'SDCA-FL2-F': 'SDCA Annex 2F Female Restroom 1',

  // 3rd Floor (2 Male, 2 Female, 1 PWD)
  'SDCA-FL3-M1': 'SDCA Annex 3F Male Restroom 1',
  'SDCA-FL3-M2': 'SDCA Annex 3F Male Restroom 2',
  'SDCA-FL3-F1': 'SDCA Annex 3F Female Restroom 1',
  'SDCA-FL3-F2': 'SDCA Annex 3F Female Restroom 2',
  'SDCA-FL3-PWD': 'SDCA Annex 3F PWD Restroom',
  'SDCA-FL3-M': 'SDCA Annex 3F Male Restroom 1',
  'SDCA-FL3-F': 'SDCA Annex 3F Female Restroom 1',

  // 4th Floor (2 Male, 2 Female, 1 PWD)
  'SDCA-FL4-M1': 'SDCA Annex 4F Male Restroom 1',
  'SDCA-FL4-M2': 'SDCA Annex 4F Male Restroom 2',
  'SDCA-FL4-F1': 'SDCA Annex 4F Female Restroom 1',
  'SDCA-FL4-F2': 'SDCA Annex 4F Female Restroom 2',
  'SDCA-FL4-PWD': 'SDCA Annex 4F PWD Restroom',
  'SDCA-FL4-M': 'SDCA Annex 4F Male Restroom 1',
  'SDCA-FL4-F': 'SDCA Annex 4F Female Restroom 1',
};

export function getRestroomLabel(
  task: Pick<Task, 'deviceId' | 'restroomName'>,
): string {
  const restroomName = task.restroomName?.trim();

  if (restroomName) {
    return restroomName;
  }

  return RESTROOM_LABELS_BY_DEVICE_ID[task.deviceId] ?? task.deviceId;
}
