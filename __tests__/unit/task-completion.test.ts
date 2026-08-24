import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, storage } from '../../lib/firebase';
import {
  completeTaskOnline,
  currentUserId,
  queueOfflineCompletion,
  readOfflineCompletions,
  secondsBetween,
  uploadTaskPhoto,
  type CompletionBundle,
  type OnlineCompletionInput,
} from '../../lib/task-completion';
import { EMPTY_CHECKLIST } from '../../lib/tasks';
import { mockFirestoreDoc, mockStorageRef } from '../../jest.setup';

describe('task-completion utility', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('secondsBetween', () => {
    it('should return null when start date is null', () => {
      const end = new Date('2026-08-15T10:30:00Z');
      expect(secondsBetween(null, end)).toBeNull();
    });

    it('should calculate seconds correctly for normal date ranges', () => {
      const start = new Date('2026-08-15T10:00:00.000Z');
      const end = new Date('2026-08-15T10:05:30.000Z');
      expect(secondsBetween(start, end)).toBe(330);
    });

    it('should round to nearest whole second', () => {
      const start = new Date('2026-08-15T10:00:00.000Z');
      const end = new Date('2026-08-15T10:00:01.600Z');
      expect(secondsBetween(start, end)).toBe(2);
    });

    it('should return 0 when start date is in the future relative to end date (inverted)', () => {
      const start = new Date('2026-08-15T10:10:00Z');
      const end = new Date('2026-08-15T10:00:00Z');
      expect(secondsBetween(start, end)).toBe(0);
    });

    it('should return 0 when start and end dates are equal', () => {
      const date = new Date('2026-08-15T10:00:00Z');
      expect(secondsBetween(date, date)).toBe(0);
    });
  });

  describe('readOfflineCompletions and queueOfflineCompletion', () => {
    const sampleBundle1: CompletionBundle = {
      taskId: 'task-101',
      completedAt: '2026-08-15T10:00:00.000Z',
      acknowledgedAt: '2026-08-15T09:50:00.000Z',
      checklist: { ...EMPTY_CHECKLIST, cleanWindows: 'done' },
      remarks: 'Cleaned and inspected',
      beforePhotoLocalUri: 'file:///mock/before.jpg',
      afterPhotoLocalUri: 'file:///mock/after.jpg',
      biometricVerified: true,
      completedBy: 'user-123',
      offlineSynced: false,
    };

    const sampleBundle2: CompletionBundle = {
      taskId: 'task-102',
      completedAt: '2026-08-15T11:00:00.000Z',
      acknowledgedAt: null,
      checklist: { ...EMPTY_CHECKLIST },
      remarks: 'Fixed pipe',
      beforePhotoLocalUri: 'file:///mock/before2.jpg',
      afterPhotoLocalUri: 'file:///mock/after2.jpg',
      biometricVerified: false,
      completedBy: 'user-123',
      offlineSynced: false,
    };

    it('should return an empty array if no offline tasks are stored', () => {
      return expect(readOfflineCompletions()).resolves.toEqual([]);
    });

    it('should return an empty array if storage contains non-array or invalid JSON', async () => {
      await AsyncStorage.setItem('offline_tasks', 'invalid-json');
      expect(await readOfflineCompletions().catch(() => 'error_caught')).toBe('error_caught');

      await AsyncStorage.setItem('offline_tasks', JSON.stringify({ notAnArray: true }));
      expect(await readOfflineCompletions()).toEqual([]);
    });

    it('should filter out invalid items without a string taskId', async () => {
      const corruptedData = [
        sampleBundle1,
        { missingTaskId: true, completedAt: '2026-08-15' },
        null,
        'string-item',
      ];
      await AsyncStorage.setItem('offline_tasks', JSON.stringify(corruptedData));

      const result = await readOfflineCompletions();
      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('task-101');
    });

    it('should queue offline tasks and retrieve them', async () => {
      await queueOfflineCompletion(sampleBundle1);
      const listAfterOne = await readOfflineCompletions();
      expect(listAfterOne).toHaveLength(1);
      expect(listAfterOne[0]).toEqual(sampleBundle1);

      await queueOfflineCompletion(sampleBundle2);
      const listAfterTwo = await readOfflineCompletions();
      expect(listAfterTwo).toHaveLength(2);
      expect(listAfterTwo[0]).toEqual(sampleBundle1);
      expect(listAfterTwo[1]).toEqual(sampleBundle2);
    });

    it('should deduplicate tasks by taskId when queueing an update for an existing task', async () => {
      await queueOfflineCompletion(sampleBundle1);
      await queueOfflineCompletion(sampleBundle2);

      const updatedBundle1: CompletionBundle = {
        ...sampleBundle1,
        remarks: 'Updated remarks after re-check',
      };

      await queueOfflineCompletion(updatedBundle1);

      const list = await readOfflineCompletions();
      expect(list).toHaveLength(2);
      // Ensure only one entry exists for task-101 and has updated remarks
      const found = list.find((item) => item.taskId === 'task-101');
      expect(found?.remarks).toBe('Updated remarks after re-check');
    });
  });

  describe('currentUserId', () => {
    it('should return the current user UID when signed in', () => {
      (auth as any).currentUser = { uid: 'user-456' };
      expect(currentUserId()).toBe('user-456');
    });

    it('should throw an error when signed out (auth.currentUser is null)', () => {
      (auth as any).currentUser = null;
      expect(() => currentUserId()).toThrow('You must be signed in to complete this task.');
    });
  });

  describe('completeTaskOnline', () => {
    const input: OnlineCompletionInput = {
      taskId: 'task-online-1',
      acknowledgedAt: new Date('2026-08-15T08:10:00Z'),
      createdAt: new Date('2026-08-15T08:00:00Z'),
      checklist: { ...EMPTY_CHECKLIST },
      remarks: 'All resolved',
      beforePhotoLocalUri: 'file:///photo/before.jpg',
      beforePhotoCapturedAt: new Date('2026-08-15T08:12:00Z'),
      afterPhotoLocalUri: 'file:///photo/after.jpg',
      afterPhotoCapturedAt: new Date('2026-08-15T08:20:00Z'),
      biometricVerified: true,
      completedAt: new Date('2026-08-15T08:25:00Z'),
      completedBy: 'user-tech-1',
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        blob: jest.fn().mockResolvedValue({ close: jest.fn() }),
      });
    });

    it('should complete task online and call update for task and user documents', async () => {
      mockFirestoreDoc.update.mockResolvedValue(undefined);
      mockFirestoreDoc.set.mockResolvedValue(undefined);

      await expect(completeTaskOnline(input)).resolves.toBeUndefined();
      expect(mockFirestoreDoc.update).toHaveBeenCalledTimes(1);
      expect(mockFirestoreDoc.set).toHaveBeenCalledTimes(1);
    });

    it('should catch, log, and throw error when task update fails (permission-denied)', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const permError = Object.assign(new Error('Missing or insufficient permissions.'), {
        code: 'permission-denied',
      });
      mockFirestoreDoc.update.mockRejectedValueOnce(permError);

      await expect(completeTaskOnline(input)).rejects.toThrow(
        '[Firestore Task Update] Error: Missing or insufficient permissions.',
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Firestore Task Update] Error: Failed to update task document task-online-1 (permission-denied):'),
        'Missing or insufficient permissions.',
      );

      errorSpy.mockRestore();
    });

    it('should catch, log, and throw error when personnel update fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const permError = Object.assign(new Error('Permission denied on personnel doc.'), {
        code: 'permission-denied',
      });
      // First update (task) succeeds, set (personnel) fails
      mockFirestoreDoc.update.mockResolvedValueOnce(undefined);
      mockFirestoreDoc.set.mockRejectedValueOnce(permError);

      await expect(completeTaskOnline(input)).rejects.toThrow(
        '[Firestore Task Update] Error: Permission denied on personnel doc.',
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Firestore Task Update] Error: Failed to update personnel document user-tech-1 (permission-denied):'),
        'Permission denied on personnel doc.',
      );

      errorSpy.mockRestore();
    });
  });

  describe('uploadTaskPhoto', () => {
    const taskId = 'task-photo-test-1';
    const capturedAt = new Date('2026-08-15T14:30:00.000Z');

    it('should upload photo using native storage putFile and return download URL', async () => {
      mockStorageRef.putFile.mockResolvedValueOnce({ state: 'success' });
      mockStorageRef.getDownloadURL.mockResolvedValueOnce('https://storage.example.com/uploaded.jpg');

      const url = await uploadTaskPhoto(
        taskId,
        'file:///cache/photo.jpg',
        'before',
        capturedAt,
      );

      expect(storage.ref).toHaveBeenCalledWith(
        `tasks/${taskId}/before_${capturedAt.getTime()}.jpg`,
      );
      expect(mockStorageRef.putFile).toHaveBeenCalledWith('file:///cache/photo.jpg');
      expect(url).toBe('https://storage.example.com/uploaded.jpg');
    });

    it('should prefix uri with file:// if missing', async () => {
      mockStorageRef.putFile.mockResolvedValueOnce({ state: 'success' });
      mockStorageRef.getDownloadURL.mockResolvedValueOnce('https://storage.example.com/uploaded.jpg');

      await uploadTaskPhoto(
        taskId,
        '/data/user/0/com.james.klir/cache/photo.jpg',
        'after',
        capturedAt,
      );

      expect(mockStorageRef.putFile).toHaveBeenCalledWith(
        'file:///data/user/0/com.james.klir/cache/photo.jpg',
      );
    });

    it('should catch, log, and throw formatted error when putFile fails', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const storageError = Object.assign(new Error('User does not have permission.'), {
        code: 'storage/unauthorized',
      });
      mockStorageRef.putFile.mockRejectedValueOnce(storageError);

      await expect(
        uploadTaskPhoto(taskId, 'file:///cache/photo.jpg', 'before', capturedAt),
      ).rejects.toThrow('Photo upload failed (storage/unauthorized): User does not have permission.');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UploadTaskPhoto] Error uploading before photo for task task-photo-test-1 (storage/unauthorized):'),
        'User does not have permission.',
      );

      errorSpy.mockRestore();
    });
  });
});
