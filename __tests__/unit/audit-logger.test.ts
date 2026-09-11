import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAuditLogMemoryCache,
  fetchAuditLogs,
  formatLocalTimestamp,
  getAuditLogMemoryCache,
  logAuditEvent,
  logAuthAudit,
  logTaskAudit,
  type AuditLogEntry,
} from '../../lib/audit-logger';
import { db } from '../../lib/firebase';
import { mockFirestoreCollection, mockFirestoreDoc } from '../../jest.setup';

describe('Audit Logger Engine (NIST SP 800-92 / ISO 27001 / 21 CFR Part 11)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    clearAuditLogMemoryCache();
    await AsyncStorage.clear();
  });

  describe('formatLocalTimestamp', () => {
    it('formats date into readable local string', () => {
      const fixedDate = new Date('2026-08-25T14:30:00Z');
      const formatted = formatLocalTimestamp(fixedDate);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(5);
    });
  });

  describe('logAuditEvent', () => {
    it('creates an audit log entry with complete 5 Ws and writes to memory and Firestore', async () => {
      const entry = await logAuditEvent({
        actionType: 'TASK_APPROVED',
        actorId: 'sup-1',
        actorName: 'Supervisor Jane',
        actorRole: 'supervisor',
        targetEntityId: 'task-100',
        targetEntityType: 'task',
        location: '2F Male Restroom',
        details: 'Approved completed work order',
      });

      expect(entry.id).toMatch(/^audit_/);
      expect(entry.actionType).toBe('TASK_APPROVED');
      expect(entry.category).toBe('SUPERVISOR');
      expect(entry.actorId).toBe('sup-1');
      expect(entry.actorName).toBe('Supervisor Jane');
      expect(entry.actorRole).toBe('supervisor');
      expect(entry.targetEntityId).toBe('task-100');
      expect(entry.targetEntityType).toBe('task');
      expect(entry.location).toBe('2F Male Restroom');
      expect(entry.details).toBe('Approved completed work order');
      expect(entry.timestamp).toBeDefined();
      expect(entry.localTimestamp).toBeDefined();

      // Check memory cache
      const memLogs = getAuditLogMemoryCache();
      expect(memLogs).toHaveLength(1);
      expect(memLogs[0].id).toBe(entry.id);

      // Check Firestore doc set
      expect(mockFirestoreDoc.set).toHaveBeenCalledWith(entry);
    });

    it('falls back gracefully when Firestore write fails without throwing', async () => {
      mockFirestoreDoc.set.mockRejectedValueOnce(new Error('Firestore network error'));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const entry = await logAuditEvent({
        actionType: 'CONFIG_UPDATED',
        actorId: 'admin-1',
        actorName: 'Admin Bob',
        actorRole: 'admin',
        category: 'ADMIN',
      });

      expect(entry.id).toBeDefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[audit-logger] Failed to write auditLog to Firestore'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('logAuthAudit', () => {
    it('creates an AUTH_LOGIN entry with session metadata', async () => {
      const entry = await logAuthAudit('AUTH_LOGIN', {
        uid: 'tech-1',
        name: 'Alex Tech',
        role: 'maintenance',
        email: 'alex@klir.com',
        building: 'Main Campus',
      });

      expect(entry.actionType).toBe('AUTH_LOGIN');
      expect(entry.category).toBe('AUTH');
      expect(entry.actorId).toBe('tech-1');
      expect(entry.actorName).toBe('Alex Tech');
      expect(entry.actorRole).toBe('maintenance');
      expect(entry.targetEntityType).toBe('session');
      expect(entry.location).toBe('Main Campus');
      expect(entry.details).toContain('Authenticated session established');
      expect(entry.metadata?.email).toBe('alex@klir.com');
      expect(entry.metadata?.clientPlatform).toBe('Mobile (React Native)');
    });

    it('creates an AUTH_LOGOUT entry with appropriate details', async () => {
      const entry = await logAuthAudit('AUTH_LOGOUT', {
        uid: 'sup-2',
        name: 'Supervisor Sarah',
        role: 'supervisor',
      });

      expect(entry.actionType).toBe('AUTH_LOGOUT');
      expect(entry.category).toBe('AUTH');
      expect(entry.actorId).toBe('sup-2');
      expect(entry.details).toContain('logged out successfully');
    });
  });

  describe('logTaskAudit', () => {
    it('logs TASK_ACKNOWLEDGED with SLA response metrics', async () => {
      const entry = await logTaskAudit(
        'TASK_ACKNOWLEDGED',
        { id: 'task-55', location: '1F Female Restroom', floor: '1F', building: 'Tower A' },
        { uid: 'tech-1', name: 'John Doe', role: 'technician' },
        { responseTime: 120 },
      );

      expect(entry.actionType).toBe('TASK_ACKNOWLEDGED');
      expect(entry.category).toBe('MAINTENANCE');
      expect(entry.targetEntityId).toBe('task-55');
      expect(entry.details).toContain('Response SLA: 120s');
      expect(entry.metadata?.responseTimeSeconds).toBe(120);
    });

    it('logs TASK_FLAGGED with mandatory justification', async () => {
      const entry = await logTaskAudit(
        'TASK_FLAGGED',
        { id: 'task-66', flagReason: 'After photo blurry' },
        { uid: 'sup-1', name: 'Supervisor Mark', role: 'supervisor' },
        { reason: 'Checklist incomplete & blurry photo' },
      );

      expect(entry.actionType).toBe('TASK_FLAGGED');
      expect(entry.category).toBe('SUPERVISOR');
      expect(entry.targetEntityId).toBe('task-66');
      expect(entry.details).toContain('Checklist incomplete & blurry photo');
      expect(entry.reason).toBe('Checklist incomplete & blurry photo');
      expect(entry.metadata?.flagReason).toBe('Checklist incomplete & blurry photo');
    });

    it('logs TASK_REASSIGNED with override justification', async () => {
      const entry = await logTaskAudit(
        'TASK_REASSIGNED',
        { id: 'task-77' },
        { uid: 'sup-1', name: 'Supervisor Mark', role: 'supervisor' },
        {
          reason: 'Technician on medical leave',
          previousAssignee: 'tech-original',
          newAssignee: 'tech-replacement',
        },
      );

      expect(entry.actionType).toBe('TASK_REASSIGNED');
      expect(entry.category).toBe('SUPERVISOR');
      expect(entry.reason).toBe('Technician on medical leave');
      expect(entry.metadata?.previousAssignee).toBe('tech-original');
      expect(entry.metadata?.newAssignee).toBe('tech-replacement');
    });

    it('logs TASK_COMPLETED with duration, checklist, and biometric verification', async () => {
      const entry = await logTaskAudit(
        'TASK_COMPLETED',
        { id: 'task-88', workDuration: 450, biometricVerified: true },
        { uid: 'tech-1', name: 'John Doe', role: 'technician' },
        { duration: 450, biometricVerified: true, checklistScore: '10/10' },
      );

      expect(entry.actionType).toBe('TASK_COMPLETED');
      expect(entry.category).toBe('MAINTENANCE');
      expect(entry.metadata?.workDurationSeconds).toBe(450);
      expect(entry.metadata?.biometricVerified).toBe(true);
      expect(entry.metadata?.checklistScore).toBe('10/10');
      expect(entry.details).toContain('Biometric: Verified');
    });
  });

  describe('fetchAuditLogs', () => {
    it('retrieves and aggregates audit logs from Firestore, memory, and cache with filtering', async () => {
      const now = new Date();
      const pastWeek = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const pastMonth = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const firestoreEntries: AuditLogEntry[] = [
        {
          id: 'log-fs-1',
          timestamp: pastWeek.toISOString(),
          localTimestamp: formatLocalTimestamp(pastWeek),
          actionType: 'TASK_APPROVED',
          category: 'SUPERVISOR',
          actorId: 'sup-1',
          actorName: 'Supervisor Jane',
          actorRole: 'supervisor',
          targetEntityId: 'task-1',
        },
      ];

      mockFirestoreCollection.get.mockResolvedValue({
        empty: false,
        docs: firestoreEntries.map((e) => ({
          data: () => e,
        })),
      });

      // Add a recent log via logAuditEvent (writes to memory)
      await logAuditEvent({
        actionType: 'AUTH_LOGIN',
        actorId: 'tech-1',
        actorName: 'Alex Tech',
        actorRole: 'technician',
      });

      const allLogs = await fetchAuditLogs({ timeframe: 'all' });
      expect(allLogs.length).toBeGreaterThanOrEqual(2);

      // Test category filtering
      const supervisorLogs = await fetchAuditLogs({ category: 'SUPERVISOR', timeframe: 'all' });
      expect(supervisorLogs.every((l) => l.category === 'SUPERVISOR')).toBe(true);
      expect(supervisorLogs.some((l) => l.id === 'log-fs-1')).toBe(true);

      const authLogs = await fetchAuditLogs({ category: 'AUTH', timeframe: 'all' });
      expect(authLogs.every((l) => l.category === 'AUTH')).toBe(true);

      // Test timeframe filtering
      const todayLogs = await fetchAuditLogs({ timeframe: 'today' });
      expect(todayLogs.some((l) => l.id === 'log-fs-1')).toBe(false); // pastWeek is not today
    });
  });
});
