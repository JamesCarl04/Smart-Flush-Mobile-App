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
  parseTimestampMap,
  toDate,
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
      const validTriggers: TaskTriggerType[] = [
        'manual',
        'hardware_failure',
        'sensor_fault',
        'maintenance',
        'flush_count',
        'water_overuse',
        'water_no_flow',
        'uv_complete',
        'student_report',
      ];
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
      expect(formatTaskTrigger('hardware_failure')).toBe('Hardware Issue');
      expect(formatTaskTrigger('sensor_fault')).toBe('Occupancy Sensor Issue');
      expect(formatTaskTrigger('maintenance')).toBe('Maintenance');
      expect(formatTaskTrigger('flush_count')).toBe('High Usage Check');
      expect(formatTaskTrigger('water_overuse')).toBe('High Water Usage');
      expect(formatTaskTrigger('water_no_flow')).toBe('No water after flush');
      expect(formatTaskTrigger('uv_complete')).toBe('UV Cleaning Check');
      expect(formatTaskTrigger('student_report')).toBe('Student report');
      expect(formatTaskTrigger('manual')).toBe('Manual Request');
      expect(formatTaskTrigger('maintenance', 'maintenance_due')).toBe('Routine Toilet Check');
    });

    it('parses automation metadata for a no-water task', () => {
      const task = parseTaskDocument('task-dry-flow', {
        deviceId: 'toilet-01',
        message: 'No water detected after flush.',
        createdAt: new Date('2026-08-15T08:00:00.000Z'),
        triggerType: 'water_no_flow',
        status: 'unassigned',
        assignedTo: null,
        assignedToIds: [],
        isBroadcast: false,
        automationRuleId: 'rule-dry-flow',
        automationTrigger: 'no_water_after_flush',
        assignmentSource: 'initial_auto',
        requiresSupervisorAssignment: true,
        autoAssignmentEligibleAt: Timestamp.fromDate(new Date('2026-08-15T08:01:00.000Z')),
        cycleCountAtTrigger: 2,
      });

      expect(task).toEqual(expect.objectContaining({
        triggerType: 'water_no_flow',
        isBroadcast: false,
        automationRuleId: 'rule-dry-flow',
        automationTrigger: 'no_water_after_flush',
        assignmentSource: 'initial_auto',
        requiresSupervisorAssignment: true,
        autoAssignmentEligibleAt: new Date('2026-08-15T08:01:00.000Z'),
        cycleCountAtTrigger: 2,
      }));
    });

    it('parses an unassigned student_report task from public issue reports', () => {
      const task = parseTaskDocument('task-report-01', {
        deviceId: 'toilet-01',
        message: 'Clogged drain reported by student.',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
        triggerType: 'student_report',
        status: 'unassigned',
        assignedTo: null,
        assignedToIds: [],
        isBroadcast: false,
        requiresSupervisorAssignment: true,
      });

      expect(task).not.toBeNull();
      expect(task).toEqual(expect.objectContaining({
        id: 'task-report-01',
        triggerType: 'student_report',
        status: 'unassigned',
        requiresSupervisorAssignment: true,
      }));
    });
  });

  describe('formatTaskComponent and isHardwareFailureComponent', () => {
    it('should correctly format hardware failure components to descriptive names', () => {
      expect(formatTaskComponent('pump')).toBe('Water Pump');
      expect(formatTaskComponent('water_leak')).toBe('Water Leak Detector');
      expect(formatTaskComponent('sensor_ultrasonic')).toBe('Occupancy Sensor');
      expect(formatTaskComponent('servo_lid')).toBe('Automatic Lid Mechanism');
      expect(formatTaskComponent('waterflow')).toBe('Water Flow Meter');
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

    it('parses native React Native Firebase timestamp objects structurally', () => {
      const date = new Date('2026-08-15T08:00:00.000Z');
      const task = parseTaskDocument('task-native-timestamp', {
        ...baseValidDoc,
        createdAt: { toDate: () => date } as any,
      });

      expect(task?.createdAt).toEqual(date);
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

    it('should parse reassignment fields and reassignmentHistory correctly', () => {
      const now = new Date();
      const task = parseTaskDocument('task-reassign', {
        ...baseValidDoc,
        reassignReason: 'Technician unavailable due to urgent callout',
        reassignedByName: 'Supervisor Lead Sarah',
        reassignmentHistory: [
          {
            reassignedAt: Timestamp.fromDate(now),
            previousAssigneeUids: ['tech-1'],
            newAssigneeUids: ['tech-2'],
            reason: 'Technician unavailable due to urgent callout',
            reassignedByUid: 'sup-1',
            reassignedByName: 'Supervisor Lead Sarah',
          },
        ],
      });

      expect(task?.reassignReason).toBe('Technician unavailable due to urgent callout');
      expect(task?.reassignedByName).toBe('Supervisor Lead Sarah');
      expect(task?.reassignmentHistory).toHaveLength(1);
      expect(task?.reassignmentHistory?.[0]).toEqual({
        reassignedAt: now,
        previousAssigneeUids: ['tech-1'],
        newAssigneeUids: ['tech-2'],
        reason: 'Technician unavailable due to urgent callout',
        reassignedByUid: 'sup-1',
        reassignedByName: 'Supervisor Lead Sarah',
      });
    });

    it('correctly parses acknowledgedBy and completedBy when provided with millisecond timestamps from API', () => {
      const task = parseTaskDocument('task-api-timestamps', {
        ...baseValidDoc,
        assignedToIds: ['tech-1', 'tech-2'],
        status: 'assigned',
        acknowledgedBy: {
          'tech-1': 1725712345678,
        },
        completedBy: {
          'tech-1': 1725712365678,
        },
      });

      expect(task).not.toBeNull();
      expect(task?.acknowledgedBy?.['tech-1']).toBeInstanceOf(Date);
      expect(task?.acknowledgedBy?.['tech-1']?.getTime()).toBe(1725712345678);
      expect(task?.completedByMap?.['tech-1']).toBeInstanceOf(Date);
      expect(task?.completedByMap?.['tech-1']?.getTime()).toBe(1725712365678);
      expect(task?.status).toBe('acknowledged');
    });

    it('parses status as flagged when inspectionStatus is flagged even if all assignees completed', () => {
      const task = parseTaskDocument('task-flagged-multi', {
        ...baseValidDoc,
        status: 'completed',
        inspectionStatus: 'flagged',
        flagReason: 'Leak was not completely resolved',
        assignedToIds: ['tech-1', 'tech-2'],
        completedBy: {
          'tech-1': 1725712365678,
          'tech-2': 1725712375678,
        },
      });

      expect(task).not.toBeNull();
      expect(task?.status).toBe('flagged');
      expect(task?.inspectionStatus).toBe('flagged');
      expect(task?.flagReason).toBe('Leak was not completely resolved');
    });

    it('parses flaggedAt and flagPhotoUrls correctly', () => {
      const task = parseTaskDocument('task-flagged-details', {
        ...baseValidDoc,
        status: 'flagged',
        inspectionStatus: 'flagged',
        flagReason: 'Water running',
        flagPhotoUrls: ['https://example.com/flag1.jpg', 'https://example.com/flag2.jpg'],
        flaggedAt: 1725712365678,
      });

      expect(task).not.toBeNull();
      expect(task?.status).toBe('flagged');
      expect(task?.flaggedAt).toBeInstanceOf(Date);
      expect(task?.flaggedAt?.getTime()).toBe(1725712365678);
      expect(task?.flagPhotoUrls).toEqual([
        'https://example.com/flag1.jpg',
        'https://example.com/flag2.jpg',
      ]);
    });

    it('parses status as rechecking when rawStatus or inspectionStatus is rechecking', () => {
      const task = parseTaskDocument('task-rechecking-details', {
        ...baseValidDoc,
        status: 'rechecking',
        recheckCount: 1,
        recheckedBy: 'tech-1',
        recheckedAt: 1725712399000,
      });

      expect(task).not.toBeNull();
      expect(task?.status).toBe('rechecking');
      expect(task?.recheckCount).toBe(1);
      expect(task?.recheckedBy).toBe('tech-1');
      expect(task?.recheckedAt).toBeInstanceOf(Date);
    });
  });

  describe('toDate', () => {
    it('returns the same Date for valid Date instances', () => {
      const date = new Date('2026-09-07T12:00:00.000Z');
      expect(toDate(date)).toBe(date);
    });

    it('returns null for invalid Date instances', () => {
      expect(toDate(new Date('invalid'))).toBeNull();
    });

    it('converts Firestore Timestamp instances to Date', () => {
      const date = new Date('2026-09-07T12:00:00.000Z');
      const timestamp = Timestamp.fromDate(date);
      expect(toDate(timestamp)).toEqual(date);
    });

    it('converts numeric millisecond timestamps to Date', () => {
      const millis = 1725712345678;
      const result = toDate(millis);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(millis);
    });

    it('returns null for non-finite numbers', () => {
      expect(toDate(NaN)).toBeNull();
      expect(toDate(Infinity)).toBeNull();
      expect(toDate(-Infinity)).toBeNull();
    });

    it('converts valid ISO date strings to Date', () => {
      const isoStr = '2026-09-07T12:00:00.000Z';
      const result = toDate(isoStr);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(isoStr);
    });

    it('converts numeric strings (epoch millis) to Date', () => {
      const millis = 1725712345678;
      const result = toDate(String(millis));
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(millis);
    });

    it('returns null for empty or invalid strings', () => {
      expect(toDate('')).toBeNull();
      expect(toDate('   ')).toBeNull();
      expect(toDate('not-a-valid-date')).toBeNull();
    });

    it('handles objects with toDate() method', () => {
      const date = new Date('2026-09-07T12:00:00.000Z');
      expect(toDate({ toDate: () => date })).toEqual(date);
      expect(toDate({ toDate: () => new Date('invalid') })).toBeNull();
      expect(toDate({ toDate: () => { throw new Error('fail'); } })).toBeNull();
    });

    it('handles objects with toMillis() method', () => {
      const millis = 1725712345678;
      const result = toDate({ toMillis: () => millis });
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(millis);
      expect(toDate({ toMillis: () => NaN })).toBeNull();
    });

    it('handles serialized Firestore Timestamp objects with seconds and nanoseconds', () => {
      const sec = 1725712345;
      const nano = 500000000;
      const expected = new Date(sec * 1000 + 500);
      expect(toDate({ seconds: sec, nanoseconds: nano })).toEqual(expected);
      expect(toDate({ _seconds: sec, _nanoseconds: nano })).toEqual(expected);
      expect(toDate({ seconds: sec })).toEqual(new Date(sec * 1000));
    });

    it('converts numeric timestamps in seconds to Date (10-digit epoch)', () => {
      const sec = 1725712345;
      const result = toDate(sec);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(sec * 1000);
    });

    it('converts decimal strings to Date', () => {
      const result = toDate('1725712345.5');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(1725712345500);
    });

    it('handles cross-realm Date-like objects', () => {
      const date = new Date('2026-09-07T12:00:00.000Z');
      const foreignDate = Object.create(Date.prototype);
      Object.assign(foreignDate, { getTime: () => date.getTime() });
      expect(toDate(foreignDate)?.getTime()).toBe(date.getTime());
    });

    it('handles serialized records with numeric string seconds and nanoseconds', () => {
      const result = toDate({ seconds: '1725712345', nanoseconds: '500000000' });
      expect(result).toEqual(new Date(1725712345500));
    });

    it('returns null for null, undefined, boolean, and empty objects', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
      expect(toDate(true)).toBeNull();
      expect(toDate(false)).toBeNull();
      expect(toDate({})).toBeNull();
      expect(toDate([])).toBeNull();
    });
  });

  describe('parseTimestampMap', () => {
    it('parses numeric epoch millisecond payloads as returned by the REST API', () => {
      const input = {
        'tech-user-1': 1725712345678,
        'tech-user-2': 1725712355678,
      };
      const result = parseTimestampMap(input);
      expect(result['tech-user-1']).toBeInstanceOf(Date);
      expect(result['tech-user-1']?.getTime()).toBe(1725712345678);
      expect(result['tech-user-2']).toBeInstanceOf(Date);
      expect(result['tech-user-2']?.getTime()).toBe(1725712355678);
    });

    it('parses native ES6 Map instances', () => {
      const map = new Map<string, unknown>([
        ['tech-1', 1725712345678],
        ['tech-2', '2026-09-07T12:00:00.000Z'],
      ]);
      const result = parseTimestampMap(map);
      expect(result['tech-1']).toBeInstanceOf(Date);
      expect(result['tech-1']?.getTime()).toBe(1725712345678);
      expect(result['tech-2']).toBeInstanceOf(Date);
      expect(result['tech-2']?.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });

    it('parses ISO date strings into Date objects', () => {
      const input = {
        'tech-user-1': '2026-09-07T12:00:00.000Z',
      };
      const result = parseTimestampMap(input);
      expect(result['tech-user-1']).toBeInstanceOf(Date);
      expect(result['tech-user-1']?.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });

    it('parses Firestore Timestamp and serialized records', () => {
      const date = new Date('2026-09-07T12:00:00.000Z');
      const input = {
        fromTs: Timestamp.fromDate(date),
        fromSerialized: { seconds: 1725712345, nanoseconds: 0 },
      };
      const result = parseTimestampMap(input);
      expect(result.fromTs).toEqual(date);
      expect(result.fromSerialized).toEqual(new Date(1725712345000));
    });

    it('ignores invalid values and gracefully handles non-object inputs', () => {
      expect(parseTimestampMap(null)).toEqual({});
      expect(parseTimestampMap(undefined)).toEqual({});
      expect(parseTimestampMap('invalid')).toEqual({});
      expect(parseTimestampMap(123)).toEqual({});
      expect(parseTimestampMap([])).toEqual({});

      const partial = {
        valid: 1725712345678,
        invalidStr: 'not-a-date',
        emptyStr: '',
        nullVal: null,
        undefVal: undefined,
        invalidNum: NaN,
      };
      const result = parseTimestampMap(partial);
      expect(Object.keys(result)).toEqual(['valid']);
      expect(result.valid.getTime()).toBe(1725712345678);
    });
  });

  describe('deterministic task ordering tie-breakers', () => {
    it('breaks ties using b.id.localeCompare(a.id) when createdAt timestamps are identical', () => {
      const timestamp = new Date('2026-09-07T10:00:00.000Z');
      const taskA = { id: 'task-aaa', createdAt: timestamp };
      const taskB = { id: 'task-zzz', createdAt: timestamp };

      const sorted = [taskA, taskB].sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      );

      // 'task-zzz' comes before 'task-aaa' descending by id
      expect(sorted.map((t) => t.id)).toEqual(['task-zzz', 'task-aaa']);
    });

    it('orders history tasks deterministically with 3-tier comparator', () => {
      const completedSameTime = new Date('2026-09-07T12:00:00.000Z');
      const createdEarly = new Date('2026-09-07T08:00:00.000Z');
      const createdLate = new Date('2026-09-07T09:00:00.000Z');

      const task1 = { id: 'task-1', completedAt: completedSameTime, createdAt: createdEarly };
      const task2 = { id: 'task-2', completedAt: completedSameTime, createdAt: createdLate };
      const task3 = { id: 'task-3', completedAt: completedSameTime, createdAt: createdLate };

      const comparator = (a: any, b: any) => {
        const aTime = a.completedAt?.getTime() ?? a.createdAt.getTime();
        const bTime = b.completedAt?.getTime() ?? b.createdAt.getTime();
        return (
          bTime - aTime ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id)
        );
      };

      const sorted = [task1, task2, task3].sort(comparator);

      // task2 and task3 have same completedAt and createdAt, so task3 precedes task2 (3 > 2), and both precede task1 (createdLate > createdEarly)
      expect(sorted.map((t) => t.id)).toEqual(['task-3', 'task-2', 'task-1']);
    });

    it('orders submissions deterministically by completedAt ascending with technicianUid tie-breaker', () => {
      const sameTime = new Date('2026-09-07T14:00:00.000Z');
      const subA = { technicianUid: 'tech-a', completedAt: sameTime };
      const subB = { technicianUid: 'tech-b', completedAt: sameTime };

      const comparator = (a: any, b: any) => {
        const aTime =
          a.completedAt instanceof Date
            ? a.completedAt.getTime()
            : new Date(a.completedAt ?? 0).getTime();
        const bTime =
          b.completedAt instanceof Date
            ? b.completedAt.getTime()
            : new Date(b.completedAt ?? 0).getTime();
        return (
          aTime - bTime ||
          (a.technicianUid || '').localeCompare(b.technicianUid || '')
        );
      };

      const sorted = [subB, subA].sort(comparator);
      expect(sorted.map((s) => s.technicianUid)).toEqual(['tech-a', 'tech-b']);
    });

    it('orders assignee avatar IDs deterministically: current user first, assigned order, then UID', () => {
      const currentUserId = 'user-current';
      const assignedToIds = ['user-assigned-1', 'user-assigned-2'];
      const rawIds = ['user-other-z', 'user-assigned-2', 'user-current', 'user-other-a', 'user-assigned-1'];

      const sorted = [...rawIds].sort((a, b) => {
        if (currentUserId && a === currentUserId) return -1;
        if (currentUserId && b === currentUserId) return 1;

        const assigned = assignedToIds ?? [];
        const indexA = assigned.indexOf(a);
        const indexB = assigned.indexOf(b);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return a.localeCompare(b);
      });

      expect(sorted).toEqual([
        'user-current',
        'user-assigned-1',
        'user-assigned-2',
        'user-other-a',
        'user-other-z',
      ]);
    });

    it('prioritizes single assignedTo before auxiliary contributors when assignedToIds is empty', () => {
      const currentUserId = 'user-viewer';
      const assignedIds = ['tech-9'];
      const rawIds = ['tech-2', 'tech-9', 'tech-5'];

      const sorted = [...rawIds].sort((a, b) => {
        if (a === b) return 0;
        if (currentUserId && a === currentUserId) return -1;
        if (currentUserId && b === currentUserId) return 1;

        const assigned = assignedIds;
        const indexA = assigned.indexOf(a);
        const indexB = assigned.indexOf(b);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return a.localeCompare(b);
      });

      // tech-9 is the assigned tech, so it must precede tech-2 and tech-5 even though 'tech-2' < 'tech-9'
      expect(sorted).toEqual(['tech-9', 'tech-2', 'tech-5']);
    });

    it('handles malformed and non-finite completedAt dates in submissionsList without NaN poisoning', () => {
      const subs = [
        { technicianUid: 'tech-z', completedAt: 'invalid-date-string' as any },
        { technicianUid: 'tech-a', completedAt: new Date('2026-09-07T12:00:00.000Z') },
        { technicianUid: 'tech-b', completedAt: null as any },
      ];

      const getMillis = (dateVal: unknown): number => {
        if (dateVal instanceof Date) {
          const t = dateVal.getTime();
          return Number.isFinite(t) ? t : 0;
        }
        if (dateVal) {
          const t = new Date(dateVal as string | number).getTime();
          return Number.isFinite(t) ? t : 0;
        }
        return 0;
      };

      const sorted = [...subs].sort((a, b) => {
        const aTime = getMillis(a.completedAt);
        const bTime = getMillis(b.completedAt);
        return (
          aTime - bTime ||
          (a.technicianUid || '').localeCompare(b.technicianUid || '')
        );
      });

      // 0-timestamp items (tech-b and tech-z) sorted by technicianUid ('tech-b', 'tech-z'), followed by valid date ('tech-a')
      expect(sorted.map((s) => s.technicianUid)).toEqual(['tech-b', 'tech-z', 'tech-a']);
    });
  });
});
