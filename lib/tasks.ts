import { Timestamp } from 'firebase/firestore';

import type {
  ChecklistValue,
  Task,
  TaskChecklist,
  TaskStatus,
  TaskTriggerType,
} from '../types';

type FirestoreDateValue = Date | Timestamp | null | undefined;

type TaskDocumentShape = {
  deviceId?: unknown;
  restroomName?: unknown;
  deviceName?: unknown;
  alertId?: unknown;
  type?: unknown;
  component?: unknown;
  location?: unknown;
  floor?: unknown;
  building?: unknown;
  shift?: unknown;
  triggerType?: unknown;
  message?: unknown;
  status?: unknown;
  assignedTo?: unknown;
  createdAt?: FirestoreDateValue;
  assignedAt?: FirestoreDateValue;
  acknowledgedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
  responseTime?: unknown;
  workDuration?: unknown;
  totalTime?: unknown;
  checklist?: unknown;
  remarks?: unknown;
  beforePhotoUrl?: unknown;
  beforePhotoCapturedAt?: FirestoreDateValue;
  afterPhotoUrl?: unknown;
  afterPhotoCapturedAt?: FirestoreDateValue;
  biometricVerified?: unknown;
  offlineSynced?: unknown;
  completedBy?: unknown;
  reassignCount?: unknown;
  supervisorUid?: unknown;
  createdBy?: unknown;
};

function toDate(value: FirestoreDateValue): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  return null;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === 'unassigned' ||
    value === 'assigned' ||
    value === 'acknowledged' ||
    value === 'completed' ||
    value === 'reassignment_needed' ||
    value === 'flagged'
  );
}

export function isTaskTriggerType(value: unknown): value is TaskTriggerType {
  return (
    value === 'manual' ||
    value === 'hardware_failure' ||
    value === 'maintenance'
  );
}

export function formatTaskStatus(status: TaskStatus): string {
  if (status === 'unassigned') {
    return 'Unassigned';
  }

  if (status === 'assigned') {
    return 'Assigned';
  }

  if (status === 'acknowledged') {
    return 'Acknowledged';
  }

  if (status === 'completed') {
    return 'Completed';
  }

  if (status === 'flagged') {
    return 'Flagged';
  }

  return 'Reassignment needed';
}

export function formatTaskTrigger(triggerType: TaskTriggerType): string {
  if (triggerType === 'hardware_failure') {
    return 'Hardware failure';
  }

  if (triggerType === 'maintenance') {
    return 'Maintenance';
  }

  return 'Manual';
}

export const HARDWARE_FAILURE_COMPONENTS = [
  'pump',
  'water_leak',
  'sensor_ultrasonic',
  'servo_lid',
  'waterflow',
  'water_flow',
  'connectivity',
  'flush_valve',
  'urinal_sensor',
  'pipe',
  'faucet',
] as const;

export const COMPONENT_LABELS: Record<string, string> = {
  pump: 'Water Pump',
  water_leak: 'Water Leak Detector',
  leak: 'Water Leak Detector',
  sensor_ultrasonic: 'Ultrasonic Distance Sensor',
  ultrasonic: 'Ultrasonic Distance Sensor',
  servo_lid: 'Servo Lid Mechanism',
  servo: 'Servo Lid Mechanism',
  waterflow: 'Water Flow Sensor',
  water_flow: 'Water Flow Sensor',
  connectivity: 'Device Connectivity',
  offline: 'Device Connectivity',
  flush_valve: 'Flush Valve',
  valve: 'Flush Valve',
  faucet: 'Faucet',
  toilet_bowl: 'Toilet Bowl',
  pipe: 'Plumbing Pipe',
  soap_dispenser: 'Soap Dispenser',
  urinal_sensor: 'Urinal Sensor',
  sanitary_bin: 'Sanitary Bin',
  grab_bar_and_sink: 'Grab Bar & Sink',
  mirror: 'Mirror',
  floor: 'Restroom Floor',
  uv_light: 'UV Disinfection Light',
  maintenance: 'General Maintenance',
  cleaning: 'General Cleaning',
};

export function isHardwareFailureComponent(component: unknown): boolean {
  if (typeof component !== 'string') {
    return false;
  }
  const normalized = component.trim().toLowerCase();
  return (
    HARDWARE_FAILURE_COMPONENTS.includes(
      normalized as (typeof HARDWARE_FAILURE_COMPONENTS)[number],
    ) ||
    normalized.includes('pump') ||
    normalized.includes('leak') ||
    normalized.includes('ultrasonic') ||
    normalized.includes('servo') ||
    normalized.includes('flow') ||
    normalized.includes('connectivity') ||
    normalized.includes('valve') ||
    normalized.includes('sensor')
  );
}

export function formatTaskComponent(component: unknown): string {
  if (typeof component !== 'string' || !component.trim()) {
    return 'General Maintenance';
  }

  const normalized = component.trim().toLowerCase();
  if (COMPONENT_LABELS[normalized]) {
    return COMPONENT_LABELS[normalized];
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const CHECKLIST_LABELS: Array<{
  key: keyof TaskChecklist;
  label: string;
  optional?: boolean;
}> = [
  { key: 'removeCeilingDust', label: 'Remove dust/cobwebs on ceilings' },
  { key: 'removeWallDust', label: 'Remove dust/cobwebs on walls' },
  { key: 'removeLightBulbDust', label: 'Remove dust/cobwebs in light bulbs' },
  { key: 'cleanWindows', label: 'Clean windows (if any)', optional: true },
  {
    key: 'wipeDownFixtures',
    label: 'Wipe down fixtures (armchairs, etc.)',
    optional: true,
  },
  { key: 'disinfectTouchedSurfaces', label: 'Disinfect often touched surfaces' },
  { key: 'sweepAndDryFloors', label: 'Sweep and dry floors' },
  { key: 'emptyTrashBins', label: 'Empty and re-line trash bins' },
  { key: 'arrangeFixtures', label: 'Arrange fixtures (if any)', optional: true },
  { key: 'disinfectUVLights', label: 'Disinfect using UV lights, etc.' },
];

export const EMPTY_CHECKLIST: TaskChecklist = {
  removeCeilingDust: 'unchecked',
  removeWallDust: 'unchecked',
  removeLightBulbDust: 'unchecked',
  cleanWindows: 'unchecked',
  wipeDownFixtures: 'unchecked',
  disinfectTouchedSurfaces: 'unchecked',
  sweepAndDryFloors: 'unchecked',
  emptyTrashBins: 'unchecked',
  arrangeFixtures: 'unchecked',
  disinfectUVLights: 'unchecked',
};

function parseChecklistValue(value: unknown): ChecklistValue {
  if (value === true || value === 'done') {
    return 'done';
  }

  if (value === 'N/A' || value === 'na') {
    return 'na';
  }

  return 'unchecked';
}

function parseChecklist(value: unknown): TaskChecklist {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return CHECKLIST_LABELS.reduce<TaskChecklist>(
    (result, item) => ({
      ...result,
      [item.key]: parseChecklistValue(source[item.key]),
    }),
    { ...EMPTY_CHECKLIST },
  );
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseTaskDocument(
  id: string,
  data: TaskDocumentShape,
): Task | null {
  if (typeof data.deviceId !== 'string' || !data.deviceId.trim()) {
    return null;
  }

  if (!isTaskTriggerType(data.triggerType)) {
    return null;
  }

  if (typeof data.message !== 'string') {
    return null;
  }

  if (!isTaskStatus(data.status)) {
    return null;
  }

  const createdAt = toDate(data.createdAt);

  if (!createdAt) {
    return null;
  }

  return {
    id,
    alertId: stringOrNull(data.alertId),
    deviceId: data.deviceId,
    restroomName:
      typeof data.restroomName === 'string'
        ? data.restroomName
        : typeof data.deviceName === 'string'
          ? data.deviceName
          : null,
    type: data.type === 'cleaning' ? 'cleaning' : 'maintenance',
    component:
      typeof data.component === 'string' && data.component.trim()
        ? data.component
        : 'maintenance',
    location:
      typeof data.location === 'string' && data.location.trim()
        ? data.location
        : typeof data.restroomName === 'string'
          ? data.restroomName
          : data.deviceId,
    floor:
      typeof data.floor === 'string' && data.floor.trim()
        ? data.floor
        : 'Ground',
    building:
      typeof data.building === 'string' && data.building.trim()
        ? data.building
        : 'GB3',
    shift: data.shift === '2nd' ? '2nd' : '1st',
    triggerType: data.triggerType,
    message: data.message,
    assignedTo: typeof data.assignedTo === 'string' ? data.assignedTo : null,
    status: data.status,
    createdAt,
    assignedAt: toDate(data.assignedAt),
    acknowledgedAt: toDate(data.acknowledgedAt),
    completedAt: toDate(data.completedAt),
    responseTime: numberOrNull(data.responseTime),
    workDuration: numberOrNull(data.workDuration),
    totalTime: numberOrNull(data.totalTime),
    checklist: parseChecklist(data.checklist),
    remarks: typeof data.remarks === 'string' ? data.remarks : '',
    beforePhotoUrl: stringOrNull(data.beforePhotoUrl),
    beforePhotoCapturedAt: toDate(data.beforePhotoCapturedAt),
    afterPhotoUrl: stringOrNull(data.afterPhotoUrl),
    afterPhotoCapturedAt: toDate(data.afterPhotoCapturedAt),
    biometricVerified: data.biometricVerified === true,
    offlineSynced: data.offlineSynced === true,
    completedBy: stringOrNull(data.completedBy),
    reassignCount: numberOrNull(data.reassignCount) ?? 0,
    supervisorUid: stringOrNull(data.supervisorUid),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',
  };
}
