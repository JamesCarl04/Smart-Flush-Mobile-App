import { Timestamp } from 'firebase/firestore';

import {
  CHECKLIST_LABELS,
  COMPONENT_LABELS,
  EMPTY_CHECKLIST,
  formatTaskComponent,
  formatTaskStatus,
  formatTaskTrigger,
  HARDWARE_FAILURE_COMPONENTS,
  isHardwareFailureComponent,
  isTaskStatus,
  isTaskTriggerType,
  parseTaskDocument,
} from '../../lib/tasks';
import type { TaskChecklist, TaskStatus, TaskTriggerType } from '../../types';

describe('tasks utility', () => {
  describe('EMPTY_CHECKLIST and CHECKLIST_LABELS', () => {
    it('should have EMPTY_CHECKLIST with all 10 items defaulted to "unchecked"', () => {
      const expectedKeys: Array<keyof TaskChecklist> = [
        'removeCeilingDust',
        'removeWallDust',
        'removeLightBulbDust',
        'cleanWindows',
        'wipeDownFixtures',
        'disinfectTouchedSurfaces',
        'sweepAndDryFloors',
        'emptyTrashBins',
        'arrangeFixtures',
        'disinfectUVLights',
      ];

      expect(Object.keys(EMPTY_CHECKLIST)).toHaveLength(10);
      expectedKeys.forEach((key) => {
        expect(EMPTY_CHECKLIST[key]).toBe('unchecked');
      });
    });

    it('should have CHECKLIST_LABELS with 10 labeled items matching checklist keys', () => {
      expect(CHECKLIST_LABELS).toHaveLength(10);

      const labelKeys = CHECKLIST_LABELS.map((item) => item.key);
      expect(labelKeys).toEqual(Object.keys(EMPTY_CHECKLIST));

      const optionalItems = CHECKLIST_LABELS.filter((item) => item.optional);
      const optionalKeys = optionalItems.map((item) => item.key);
      expect(optionalKeys).toEqual(['cleanWindows', 'wipeDownFixtures', 'arrangeFixtures']);
    });
  });

  describe('isTaskStatus', () => {
    it('should return true for all valid task statuses', () => {
      const validStatuses: TaskStatus[] = [
        'unassigned',
        'assigned',
        'acknowledged',
        'completed',
        'reassignment_needed',
        'flagged',
      ];

      validStatuses.forEach((status) => {
        expect(isTaskStatus(status)).toBe(true);
      });
    });

    it('should return false for invalid statuses or non-string values', () => {
      const invalidValues = ['pending', 'in_progress', 'cancelled', '', null, undefined, 123, {}, []];
      invalidValues.forEach((val) => {
        expect(isTaskStatus(val)).toBe(false);
      });
    });
  });

  describe('isTaskTriggerType', () => {
    it('should return true for all valid trigger types', () => {
      const validTriggers: TaskTriggerType[] = ['manual', 'hardware_failure', 'maintenance'];
      validTriggers.forEach((trigger) => {
        expect(isTaskTriggerType(trigger)).toBe(true);
      });
    });

    it('should return false for invalid trigger types or non-string values', () => {
      const invalidValues = ['sensor', 'automatic', 'scheduled', '', null, undefined, 0, {}];
      invalidValues.forEach((val) => {
        expect(isTaskTriggerType(val)).toBe(false);
      });
    });
  });

  describe('formatTaskStatus', () => {
    it('should format all statuses into human-readable labels', () => {
      expect(formatTaskStatus('unassigned')).toBe('Unassigned');
      expect(formatTaskStatus('assigned')).toBe('Assigned');
      expect(formatTaskStatus('acknowledged')).toBe('Acknowledged');
      expect(formatTaskStatus('completed')).toBe('Completed');
      expect(formatTaskStatus('flagged')).toBe('Flagged');
      expect(formatTaskStatus('reassignment_needed')).toBe('Reassignment needed');
    });
  });

  describe('formatTaskTrigger', () => {
    it('should format trigger types into human-readable labels', () => {
      expect(formatTaskTrigger('hardware_failure')).toBe('Hardware failure');
      expect(formatTaskTrigger('maintenance')).toBe('Maintenance');
      expect(formatTaskTrigger('manual')).toBe('Manual');
    });
  });

  describe('formatTaskComponent and isHardwareFailureComponent', () => {
    it('should correctly format hardware failure components to descriptive names', () => {
      expect(formatTaskComponent('pump')).toBe('Water Pump');
      expect(formatTaskComponent('water_leak')).toBe('Water Leak Detector');
      expect(formatTaskComponent('sensor_ultrasonic')).toBe('Ultrasonic Distance Sensor');
      expect(formatTaskComponent('servo_lid')).toBe('Servo Lid Mechanism');
      expect(formatTaskComponent('waterflow')).toBe('Water Flow Sensor');
      expect(formatTaskComponent('connectivity')).toBe('Device Connectivity');
      expect(formatTaskComponent('flush_valve')).toBe('Flush Valve');
      expect(formatTaskComponent('pipe')).toBe('Plumbing Pipe');
      expect(formatTaskComponent('faucet')).toBe('Faucet');
    });

    it('should identify hardware failure components', () => {
      expect(isHardwareFailureComponent('pump')).toBe(true);
      expect(isHardwareFailureComponent('water_leak')).toBe(true);
      expect(isHardwareFailureComponent('sensor_ultrasonic')).toBe(true);
      expect(isHardwareFailureComponent('servo_lid')).toBe(true);
      expect(isHardwareFailureComponent('waterflow')).toBe(true);
      expect(isHardwareFailureComponent('connectivity')).toBe(true);
      expect(isHardwareFailureComponent('flush_valve')).toBe(true);
      expect(isHardwareFailureComponent('floor')).toBe(false);
      expect(isHardwareFailureComponent(null)).toBe(false);
      expect(isHardwareFailureComponent(123)).toBe(false);
    });

    it('should handle unlisted components with formatted capitalization and empty fallbacks', () => {
      expect(formatTaskComponent('door_handle_lock')).toBe('Door Handle Lock');
      expect(formatTaskComponent('')).toBe('General Maintenance');
      expect(formatTaskComponent(null)).toBe('General Maintenance');
    });
  });

  describe('parseTaskDocument', () => {
    const validCreatedAt = new Date('2026-08-15T08:00:00.000Z');

    const baseValidDoc = {
      deviceId: 'toilet-01',
      triggerType: 'hardware_failure',
      message: 'Flush valve jammed',
      status: 'assigned',
      createdAt: validCreatedAt,
    };

    it('should return null if required fields are missing or invalid', () => {
      // Invalid deviceId
      expect(parseTaskDocument('task-1', { ...baseValidDoc, deviceId: '' })).toBeNull();
      expect(parseTaskDocument('task-1', { ...baseValidDoc, deviceId: null })).toBeNull();
      expect(parseTaskDocument('task-1', { ...baseValidDoc, deviceId: 123 })).toBeNull();

      // Invalid triggerType
      expect(parseTaskDocument('task-1', { ...baseValidDoc, triggerType: 'invalid_trigger' })).toBeNull();

      // Invalid message
      expect(parseTaskDocument('task-1', { ...baseValidDoc, message: null })).toBeNull();
      expect(parseTaskDocument('task-1', { ...baseValidDoc, message: 42 })).toBeNull();

      // Invalid status
      expect(parseTaskDocument('task-1', { ...baseValidDoc, status: 'invalid_status' })).toBeNull();

      // Invalid or missing createdAt
      expect(parseTaskDocument('task-1', { ...baseValidDoc, createdAt: null })).toBeNull();
      expect(parseTaskDocument('task-1', { ...baseValidDoc, createdAt: undefined })).toBeNull();
      expect(parseTaskDocument('task-1', { ...baseValidDoc, createdAt: 'not-a-date' as any })).toBeNull();
    });

    it('should correctly parse Firestore Timestamp instances for all date fields', () => {
      const createdTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:00:00.000Z'));
      const assignedTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:05:00.000Z'));
      const ackTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:10:00.000Z'));
      const completedTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:30:00.000Z'));
      const beforePhotoTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:12:00.000Z'));
      const afterPhotoTimestamp = Timestamp.fromDate(new Date('2026-08-15T08:28:00.000Z'));

      const task = parseTaskDocument('task-ts', {
        ...baseValidDoc,
        createdAt: createdTimestamp,
        assignedAt: assignedTimestamp,
        acknowledgedAt: ackTimestamp,
        completedAt: completedTimestamp,
        beforePhotoCapturedAt: beforePhotoTimestamp,
        afterPhotoCapturedAt: afterPhotoTimestamp,
      });

      expect(task).not.toBeNull();
      expect(task?.createdAt).toEqual(createdTimestamp.toDate());
      expect(task?.assignedAt).toEqual(assignedTimestamp.toDate());
      expect(task?.acknowledgedAt).toEqual(ackTimestamp.toDate());
      expect(task?.completedAt).toEqual(completedTimestamp.toDate());
      expect(task?.beforePhotoCapturedAt).toEqual(beforePhotoTimestamp.toDate());
      expect(task?.afterPhotoCapturedAt).toEqual(afterPhotoTimestamp.toDate());
    });

    it('should correctly parse JS Date instances for all date fields', () => {
      const createdDate = new Date('2026-08-15T08:00:00.000Z');
      const assignedDate = new Date('2026-08-15T08:05:00.000Z');
      const ackDate = new Date('2026-08-15T08:10:00.000Z');
      const completedDate = new Date('2026-08-15T08:30:00.000Z');

      const task = parseTaskDocument('task-js', {
        ...baseValidDoc,
        createdAt: createdDate,
        assignedAt: assignedDate,
        acknowledgedAt: ackDate,
        completedAt: completedDate,
      });

      expect(task).not.toBeNull();
      expect(task?.createdAt).toBe(createdDate);
      expect(task?.assignedAt).toBe(assignedDate);
      expect(task?.acknowledgedAt).toBe(ackDate);
      expect(task?.completedAt).toBe(completedDate);
    });

    it('should apply correct fallbacks for null/missing fields (location, building, floor, shift, component, reassignCount, createdBy)', () => {
      const task = parseTaskDocument('task-fallbacks', {
        deviceId: 'device-abc',
        triggerType: 'maintenance',
        message: 'Routine check',
        status: 'unassigned',
        createdAt: validCreatedAt,
      });

      expect(task).not.toBeNull();
      expect(task?.id).toBe('task-fallbacks');
      expect(task?.alertId).toBeNull();
      expect(task?.restroomName).toBeNull();
      expect(task?.type).toBe('maintenance');
      expect(task?.component).toBe('maintenance');
      expect(task?.location).toBe('device-abc'); // falls back to deviceId
      expect(task?.floor).toBe('Ground'); // falls back to Ground
      expect(task?.building).toBe('GB3'); // falls back to GB3
      expect(task?.shift).toBe('1st'); // falls back to 1st
      expect(task?.assignedTo).toBeNull();
      expect(task?.assignedAt).toBeNull();
      expect(task?.acknowledgedAt).toBeNull();
      expect(task?.completedAt).toBeNull();
      expect(task?.responseTime).toBeNull();
      expect(task?.workDuration).toBeNull();
      expect(task?.totalTime).toBeNull();
      expect(task?.remarks).toBe('');
      expect(task?.beforePhotoUrl).toBeNull();
      expect(task?.afterPhotoUrl).toBeNull();
      expect(task?.biometricVerified).toBe(false);
      expect(task?.offlineSynced).toBe(false);
      expect(task?.completedBy).toBeNull();
      expect(task?.reassignCount).toBe(0);
      expect(task?.supervisorUid).toBeNull();
      expect(task?.createdBy).toBe('unknown');
    });

    it('should fallback location to restroomName when present, and deviceName to restroomName when restroomName is absent', () => {
      // 1. restroomName provided, location absent
      const task1 = parseTaskDocument('task-loc-1', {
        ...baseValidDoc,
        restroomName: '2F Restroom A',
      });
      expect(task1?.location).toBe('2F Restroom A');
      expect(task1?.restroomName).toBe('2F Restroom A');

      // 2. deviceName provided, restroomName absent
      const task2 = parseTaskDocument('task-loc-2', {
        ...baseValidDoc,
        deviceName: 'Device Display Name',
      });
      expect(task2?.restroomName).toBe('Device Display Name');
      expect(task2?.location).toBe('toilet-01');

      // 3. explicit location provided
      const task3 = parseTaskDocument('task-loc-3', {
        ...baseValidDoc,
        location: 'Custom Location 3F',
        restroomName: '2F Restroom A',
      });
      expect(task3?.location).toBe('Custom Location 3F');
      expect(task3?.restroomName).toBe('2F Restroom A');
    });

    it('should parse shift "2nd" and type "cleaning" correctly', () => {
      const task = parseTaskDocument('task-shift', {
        ...baseValidDoc,
        shift: '2nd',
        type: 'cleaning',
      });

      expect(task?.shift).toBe('2nd');
      expect(task?.type).toBe('cleaning');
    });

    it('should parse checklist values handling boolean true, string "done", "na", "N/A", "unchecked", and missing keys', () => {
      const task = parseTaskDocument('task-chk', {
        ...baseValidDoc,
        checklist: {
          removeCeilingDust: true,
          removeWallDust: 'done',
          removeLightBulbDust: 'na',
          cleanWindows: 'N/A',
          wipeDownFixtures: 'unchecked',
          disinfectTouchedSurfaces: false,
          sweepAndDryFloors: 'invalid_value',
          // emptyTrashBins, arrangeFixtures, disinfectUVLights missing
        },
      });

      expect(task?.checklist).toEqual({
        removeCeilingDust: 'done',
        removeWallDust: 'done',
        removeLightBulbDust: 'na',
        cleanWindows: 'na',
        wipeDownFixtures: 'unchecked',
        disinfectTouchedSurfaces: 'unchecked',
        sweepAndDryFloors: 'unchecked',
        emptyTrashBins: 'unchecked',
        arrangeFixtures: 'unchecked',
        disinfectUVLights: 'unchecked',
      });
    });

    it('should parse non-object checklist into EMPTY_CHECKLIST', () => {
      const task = parseTaskDocument('task-null-chk', {
        ...baseValidDoc,
        checklist: null,
      });

      expect(task?.checklist).toEqual(EMPTY_CHECKLIST);
    });

    it('should parse numbers and ignore non-finite numbers', () => {
      const task = parseTaskDocument('task-nums', {
        ...baseValidDoc,
        responseTime: 120,
        workDuration: 300,
        totalTime: 420,
        reassignCount: 2,
      });

      expect(task?.responseTime).toBe(120);
      expect(task?.workDuration).toBe(300);
      expect(task?.totalTime).toBe(420);
      expect(task?.reassignCount).toBe(2);

      const taskNan = parseTaskDocument('task-nan', {
        ...baseValidDoc,
        responseTime: NaN,
        workDuration: Infinity,
        reassignCount: 'three' as any,
      });

      expect(taskNan?.responseTime).toBeNull();
      expect(taskNan?.workDuration).toBeNull();
      expect(taskNan?.reassignCount).toBe(0);
    });
  });
});
