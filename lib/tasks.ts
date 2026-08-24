import { Timestamp } from 'firebase/firestore';

import type {
  AreaPhoto,
  ChecklistValue,
  Task,
  TaskChecklist,
  TaskStatus,
  TaskSubmission,
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
  assignedToIds?: unknown;
  isBroadcast?: unknown;
  assignmentType?: unknown;
  createdAt?: FirestoreDateValue;
  assignedAt?: FirestoreDateValue;
  acknowledgedAt?: FirestoreDateValue;
  completedAt?: FirestoreDateValue;
  acknowledgedBy?: unknown;
  completedBy?: unknown;
  submissions?: unknown;
  responseTime?: unknown;
  workDuration?: unknown;
  totalTime?: unknown;
  checklist?: unknown;
  remarks?: unknown;
  beforePhotoUrl?: unknown;
  beforePhotoCapturedAt?: FirestoreDateValue;
  afterPhotoUrl?: unknown;
  afterPhotoCapturedAt?: FirestoreDateValue;
  additionalPhotos?: unknown;
  biometricVerified?: unknown;
  offlineSynced?: unknown;
  reassignCount?: unknown;
  supervisorUid?: unknown;
  createdBy?: unknown;
  inspectionStatus?: unknown;
  inspectedBy?: unknown;
  inspectedByName?: unknown;
  inspectedAt?: FirestoreDateValue;
  flagReason?: unknown;
  flagPhotoUrls?: unknown;
  recheckCount?: unknown;
  recheckedBy?: unknown;
  recheckedAt?: FirestoreDateValue;
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0),
    ),
  );
}

function parseTimestampMap(value: unknown): Record<string, Date> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, Date> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsedDate = toDate(raw as FirestoreDateValue);
    if (parsedDate) {
      result[key] = parsedDate;
    }
  }
  return result;
}

function parseAreaPhotos(value: unknown): AreaPhoto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const photoUrl = stringOrNull(item.photoUrl);
      if (!photoUrl) return null;
      return {
        id: typeof item.id === 'string' ? item.id : `photo_${index}`,
        areaTag: typeof item.areaTag === 'string' ? item.areaTag : 'Other Area',
        photoUrl,
        capturedAt: toDate(item.capturedAt as FirestoreDateValue) ?? new Date(),
      };
    })
    .filter((p): p is AreaPhoto => p !== null);
}

function parseSubmissions(value: unknown): Record<string, TaskSubmission> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, TaskSubmission> = {};
  for (const [uid, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const sub = raw as Record<string, unknown>;
    const completedAt = toDate(sub.completedAt as FirestoreDateValue) ?? new Date();
    result[uid] = {
      technicianUid: typeof sub.technicianUid === 'string' ? sub.technicianUid : uid,
      technicianName: typeof sub.technicianName === 'string' ? sub.technicianName : 'Technician',
      checklist: parseChecklist(sub.checklist),
      beforePhotoUrl: stringOrNull(sub.beforePhotoUrl),
      beforePhotoCapturedAt: toDate(sub.beforePhotoCapturedAt as FirestoreDateValue),
      afterPhotoUrl: stringOrNull(sub.afterPhotoUrl),
      afterPhotoCapturedAt: toDate(sub.afterPhotoCapturedAt as FirestoreDateValue),
      additionalPhotos: parseAreaPhotos(sub.additionalPhotos),
      remarks: typeof sub.remarks === 'string' ? sub.remarks : '',
      workDuration: numberOrNull(sub.workDuration),
      completedAt,
      biometricVerified: sub.biometricVerified === true,
    };
  }
  return result;
}

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
    value === 'flagged' ||
    value === 'rechecking'
  );
}

export function isTaskTriggerType(value: unknown): value is TaskTriggerType {
  return (
    value === 'manual' ||
    value === 'hardware_failure' ||
    value === 'maintenance' ||
    value === 'flush_count' ||
    value === 'uv_complete'
  );
}

export function isBroadcastTask(task: Task | null | undefined): boolean {
  if (!task) {
    return false;
  }
  if (
    task.isBroadcast === true ||
    task.assignmentType === 'broadcast' ||
    task.assignedTo === 'broadcast' ||
    task.assignedTo === 'all'
  ) {
    return true;
  }
  const assignedIds =
    task.assignedToIds && task.assignedToIds.length > 0
      ? task.assignedToIds
      : task.assignedTo
        ? [task.assignedTo]
        : [];
  if (
    assignedIds.length === 0 &&
    task.status !== 'unassigned' &&
    task.status !== 'reassignment_needed'
  ) {
    return true;
  }
  return false;
}

export function getTaskDisplayStatus(task: Task | null | undefined): string {
  if (!task) {
    return 'Standard';
  }
  if (task.status === 'completed') {
    return 'Completed';
  }
  if (task.status === 'acknowledged') {
    return 'Acknowledged';
  }
  if (task.status === 'reassignment_needed') {
    return 'Reassignment needed';
  }
  if (task.status === 'flagged') {
    return 'Flagged';
  }
  if (task.status === 'rechecking') {
    return 'Rechecking';
  }
  if (isBroadcastTask(task)) {
    return 'Team Broadcast';
  }
  if (task.status === 'unassigned') {
    return 'Unassigned';
  }
  return 'Assigned';
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

  if (status === 'rechecking') {
    return 'Rechecking';
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

function extractUserUid(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > 0 && typeof keys[0] === 'string' && keys[0].trim()) {
      return keys[0].trim();
    }
  }
  return null;
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

  const assignedTo = typeof data.assignedTo === 'string' && data.assignedTo.trim() ? data.assignedTo.trim() : null;
  let rawStatus = data.status;
  if (rawStatus === 'pending') {
    rawStatus = assignedTo ? 'assigned' : 'unassigned';
  }

  if (!isTaskStatus(rawStatus)) {
    return null;
  }

  const createdAt = toDate(data.createdAt);

  if (!createdAt) {
    return null;
  }

  const completedBy = extractUserUid(data.completedBy);
  const completedAt = toDate(data.completedAt);
  const acknowledgedBy = parseTimestampMap(data.acknowledgedBy);
  const completedByMap = parseTimestampMap(data.completedBy);
  const submissions = parseSubmissions(data.submissions);
  const assignedToIds = stringArray(data.assignedToIds);

  let status: TaskStatus = 'unassigned';
  if (rawStatus === 'flagged') {
    status = 'flagged';
  } else if (rawStatus === 'rechecking') {
    status = 'rechecking';
  } else if (rawStatus === 'reassignment_needed') {
    status = 'reassignment_needed';
  } else if (rawStatus === 'completed') {
    status = 'completed';
  } else if (completedAt || completedBy || Object.keys(submissions).length > 0) {
    // If all assigned technicians have submitted, mark completed
    if (assignedToIds.length > 0 && assignedToIds.every((uid) => Boolean(submissions[uid] || completedByMap[uid]))) {
      status = 'completed';
    } else if (completedAt || completedBy) {
      status = 'completed';
    } else if (typeof rawStatus === 'string' && isTaskStatus(rawStatus)) {
      status = rawStatus;
    }
  } else if (typeof rawStatus === 'string' && isTaskStatus(rawStatus)) {
    status = rawStatus;
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
    assignedToIds,
    isBroadcast:
      data.isBroadcast === true ||
      data.assignmentType === 'broadcast' ||
      data.assignedTo === 'all' ||
      data.assignedTo === 'broadcast',
    assignmentType:
      data.assignmentType === 'broadcast' || data.isBroadcast === true
        ? 'broadcast'
        : data.assignmentType === 'team'
          ? 'team'
          : 'individual',
    status,
    createdAt,
    assignedAt: toDate(data.assignedAt),
    acknowledgedAt: toDate(data.acknowledgedAt),
    completedAt,
    acknowledgedBy,
    completedByMap,
    submissions,
    responseTime: numberOrNull(data.responseTime),
    workDuration: numberOrNull(data.workDuration),
    totalTime: numberOrNull(data.totalTime),
    checklist: parseChecklist(data.checklist),
    remarks: typeof data.remarks === 'string' ? data.remarks : '',
    beforePhotoUrl: stringOrNull(data.beforePhotoUrl),
    beforePhotoCapturedAt: toDate(data.beforePhotoCapturedAt),
    afterPhotoUrl: stringOrNull(data.afterPhotoUrl),
    afterPhotoCapturedAt: toDate(data.afterPhotoCapturedAt),
    additionalPhotos: parseAreaPhotos(data.additionalPhotos),
    biometricVerified: data.biometricVerified === true,
    offlineSynced: data.offlineSynced === true,
    completedBy,
    reassignCount: numberOrNull(data.reassignCount) ?? 0,
    supervisorUid: stringOrNull(data.supervisorUid),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'unknown',

    // QA & Supervisor Audit Fields
    inspectionStatus:
      data.inspectionStatus === 'approved' ||
      data.inspectionStatus === 'flagged' ||
      data.inspectionStatus === 'pending_review'
        ? data.inspectionStatus
        : undefined,
    inspectedBy: stringOrNull(data.inspectedBy),
    inspectedByName: stringOrNull(data.inspectedByName),
    inspectedAt: toDate(data.inspectedAt),
    flagReason: stringOrNull(data.flagReason),
    flagPhotoUrls: stringArray(data.flagPhotoUrls),
    recheckCount: numberOrNull(data.recheckCount) ?? 0,
    recheckedBy: stringOrNull(data.recheckedBy),
    recheckedAt: toDate(data.recheckedAt),
  };
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return 'N/A';
  }

  const totalSecs = Math.round(seconds);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const remainder = totalSecs % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes} min ${remainder} sec`;
  }
  return `${remainder} sec`;
}
