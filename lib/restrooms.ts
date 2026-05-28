import type { Task } from '../types';

const RESTROOM_LABELS_BY_DEVICE_ID: Record<string, string> = {
  FShQvy5eRcTVcREcNbns: 'Restroom 1',
  'toilet-01': 'Restroom 2',
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
