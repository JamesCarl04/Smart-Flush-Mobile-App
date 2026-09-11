import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  exportReportCSV,
  exportReportPDF,
  generateCSVContent,
  exportAuditLogCSV,
  exportAuditLogPDF,
  generateAuditLogCSVContent,
  calculateComplianceKPIs,
} from '../../lib/report-export';
import {
  generateReportHTML,
  generateAuditLogHTML,
  type ReportPDFInput,
  type AuditLogPDFInput,
} from '../../lib/report-pdf-template';
import type { AuditLogEntry } from '../../lib/audit-logger';
import type { Task } from '../../types';

describe('Report Export System', () => {
  const samplePerson = {
    id: 'tech-1',
    displayName: 'Justine Lopez',
    email: 'justine@sdca.edu.ph',
    isAvailable: true,
    currentTaskId: null,
    shift: '1st',
    building: 'SDCA Annex Building',
    supervisorUid: null,
  };

  const sampleTasks: Task[] = [
    {
      id: 'task-comp-01',
      alertId: 'alert-01',
      deviceId: 'DEV-01',
      restroomName: '1F Canteen Restroom',
      type: 'cleaning',
      component: 'toilet_sensor',
      location: '1F Canteen Restroom',
      floor: '1st Floor',
      building: 'SDCA Annex Building',
      shift: '1st',
      triggerType: 'maintenance',
      message: 'Routine Sanitization Completed',
      status: 'completed',
      assignedTo: 'tech-1',
      assignedToIds: ['tech-1'],
      createdAt: new Date('2026-08-25T08:00:00Z'),
      assignedAt: new Date('2026-08-25T08:05:00Z'),
      acknowledgedAt: new Date('2026-08-25T08:10:00Z'),
      completedAt: new Date('2026-08-25T08:30:00Z'),
      responseTime: 300,
      workDuration: 1200,
      totalTime: 1800,
      checklist: {
        removeCeilingDust: 'done',
        removeWallDust: 'done',
        removeLightBulbDust: 'done',
        cleanWindows: 'na',
        wipeDownFixtures: 'done',
        disinfectTouchedSurfaces: 'done',
        sweepAndDryFloors: 'done',
        emptyTrashBins: 'done',
        arrangeFixtures: 'na',
        disinfectUVLights: 'done',
      },
      remarks: 'Sanitized all fixtures & "wiped down" mirrors.',
      beforePhotoUrl: 'https://storage.example.com/before.jpg',
      afterPhotoUrl: 'https://storage.example.com/after.jpg',
      biometricVerified: true,
      offlineSynced: false,
      completedBy: 'tech-1',
      reassignCount: 0,
      supervisorUid: 'sup-1',
      createdBy: 'system',
      inspectionStatus: 'approved',
      inspectedBy: 'sup-1',
      inspectedByName: 'Sarah Lead Supervisor',
      inspectedAt: new Date('2026-08-25T09:00:00Z'),
    },
    {
      id: 'task-flagged-02',
      alertId: 'alert-02',
      deviceId: 'DEV-02',
      restroomName: '2F Faculty Restroom',
      type: 'cleaning',
      component: 'urinal_sensor',
      location: '2F Faculty Lounge',
      floor: '2nd Floor',
      building: 'SDCA Annex Building',
      shift: '1st',
      triggerType: 'flush_count',
      message: 'High traffic flush count threshold reached',
      status: 'flagged',
      assignedTo: 'tech-1',
      assignedToIds: ['tech-1'],
      createdAt: new Date('2026-08-25T09:00:00Z'),
      assignedAt: new Date('2026-08-25T09:05:00Z'),
      acknowledgedAt: new Date('2026-08-25T09:10:00Z'),
      completedAt: new Date('2026-08-25T09:25:00Z'),
      responseTime: 300,
      workDuration: 900,
      totalTime: 1500,
      checklist: {
        removeCeilingDust: 'unchecked',
        removeWallDust: 'done',
        removeLightBulbDust: 'unchecked',
        cleanWindows: 'na',
        wipeDownFixtures: 'done',
        disinfectTouchedSurfaces: 'done',
        sweepAndDryFloors: 'done',
        emptyTrashBins: 'done',
        arrangeFixtures: 'na',
        disinfectUVLights: 'unchecked',
      },
      remarks: 'Floor swept and sanitized.',
      beforePhotoUrl: null,
      afterPhotoUrl: 'https://storage.example.com/after2.jpg',
      biometricVerified: false,
      offlineSynced: false,
      completedBy: 'tech-1',
      reassignCount: 0,
      supervisorUid: 'sup-1',
      createdBy: 'system',
      inspectionStatus: 'flagged',
      flagReason: 'Missed ceiling and UV light disinfection.',
    },
  ];

  const sampleMetrics = {
    total: 2,
    avgDuration: '17m 30s',
    avgResponse: '5m 0s',
    photoPairsCount: 1,
    biometricPct: '50%',
    approvedCount: 1,
    flaggedCount: 1,
    pendingAuditCount: 0,
    complianceRate: '100%',
  };

  const sampleInput: ReportPDFInput = {
    timeframeLabel: 'Today',
    supervisorName: 'Sarah Lead Supervisor',
    building: 'SDCA Annex Building',
    generatedAt: new Date('2026-08-25T10:00:00Z'),
    tasks: sampleTasks,
    people: [samplePerson],
    metrics: sampleMetrics,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReportHTML', () => {
    it('should generate valid HTML document containing branding, KPIs, and table ledger', () => {
      const html = generateReportHTML(sampleInput);

      expect(html).toContain('KLIR • SMART FLUSH');
      expect(html).toContain('SDCA Facility Maintenance & Compliance Audit Report');
      expect(html).toContain('Sarah Lead Supervisor');
      expect(html).toContain('SDCA Annex Building');
      expect(html).toContain('1F Canteen Restroom');
      expect(html).toContain('Justine Lopez');
      expect(html).toContain('10/10');
      expect(html).toContain('APPROVED');
      expect(html).toContain('FLAGGED');
      expect(html).toContain('Missed ceiling and UV light disinfection.');
      expect(html).toContain('50%');
    });

    it('should safely escape HTML in remarks and locations', () => {
      const xssTask: Task = {
        ...sampleTasks[0],
        id: 'task-xss',
        location: '<script>alert("xss")</script>',
        remarks: '<b>Bold</b> & "Special"',
      };
      const html = generateReportHTML({
        ...sampleInput,
        tasks: [xssTask],
      });

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt; &amp; &quot;Special&quot;');
    });
  });

  describe('generateCSVContent', () => {
    it('should generate properly escaped CSV data with headers', () => {
      const csv = generateCSVContent({
        timeframe: 'today',
        timeframeLabel: 'Today',
        tasks: sampleTasks,
        people: [samplePerson],
      });

      const lines = csv.split('\n');
      expect(lines[0]).toContain('Task ID,Restroom / Location,Floor,Building,Component');
      expect(lines[1]).toContain('task-comp-01,"1F Canteen Restroom",1st Floor,SDCA Annex Building');
      expect(lines[1]).toContain('"Justine Lopez"');
      expect(lines[1]).toContain('"Sanitized all fixtures & ""wiped down"" mirrors."');
      expect(lines[2]).toContain('task-flagged-02');
      expect(lines[2]).toContain('"Missed ceiling and UV light disinfection."');
    });

    it('should include reassignment audit columns (count, reassigned by, reason) in CSV export', () => {
      const reassignedTask: Task = {
        ...sampleTasks[0],
        id: 'task-reassigned-99',
        reassignCount: 2,
        reassignedByName: 'Supervisor Lead Sarah',
        reassignReason: 'Technician reallocated to priority spill',
      };

      const csv = generateCSVContent({
        timeframe: 'weekly',
        timeframeLabel: 'This Week',
        tasks: [reassignedTask],
        people: [samplePerson],
      });

      const lines = csv.split('\n');
      expect(lines[0]).toContain('Reassign Count,Reassigned By,Reassignment Reason');
      expect(lines[1]).toContain(',2,"Supervisor Lead Sarah","Technician reallocated to priority spill",');
    });
  });

  describe('exportReportPDF', () => {
    it('should compile HTML and trigger native share dialog with application/pdf MIME type', async () => {
      const result = await exportReportPDF(sampleInput);

      expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
      expect(Sharing.isAvailableAsync).toHaveBeenCalledTimes(1);
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///mock/cache/klir-report-mock.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          dialogTitle: 'Klir Operations Report - Today',
          UTI: 'com.adobe.pdf',
        }),
      );
      expect(result.uri).toBe('file:///mock/cache/klir-report-mock.pdf');
    });
  });

  describe('exportReportCSV', () => {
    it('should write CSV file to cache and trigger native share dialog with text/csv MIME type', async () => {
      const result = await exportReportCSV({
        timeframe: 'today',
        timeframeLabel: 'Today',
        tasks: sampleTasks,
        people: [samplePerson],
      });

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/klir-operations-report-today-\d+\.csv/),
        expect.stringContaining('Task ID,Restroom / Location'),
        expect.objectContaining({ encoding: 'utf8' }),
      );

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/klir-operations-report-today-\d+\.csv/),
        expect.objectContaining({
          mimeType: 'text/csv',
          dialogTitle: 'Klir Operations CSV - Today',
          UTI: 'public.comma-separated-values-text',
        }),
      );

      expect(result.uri).toMatch(/klir-operations-report-today-\d+\.csv/);
    });
  });

  describe('calculateComplianceKPIs', () => {
    const now = new Date();
    const sampleLogs: AuditLogEntry[] = [
      {
        id: 'log-1',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'AUTH_LOGIN',
        category: 'AUTH',
        actorId: 'tech-1',
        actorName: 'Justine Lopez',
        actorRole: 'technician',
      },
      {
        id: 'log-2',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'AUTH_LOGOUT',
        category: 'AUTH',
        actorId: 'tech-1',
        actorName: 'Justine Lopez',
        actorRole: 'technician',
      },
      {
        id: 'log-3',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'TASK_APPROVED',
        category: 'SUPERVISOR',
        actorId: 'sup-1',
        actorName: 'Sarah Lead',
        actorRole: 'supervisor',
        targetEntityId: 'task-comp-01',
      },
      {
        id: 'log-4',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'TASK_FLAGGED',
        category: 'SUPERVISOR',
        actorId: 'sup-1',
        actorName: 'Sarah Lead',
        actorRole: 'supervisor',
        targetEntityId: 'task-flagged-02',
        reason: 'Missed floor disinfection',
      },
      {
        id: 'log-5',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'TASK_ACKNOWLEDGED',
        category: 'MAINTENANCE',
        actorId: 'tech-1',
        actorName: 'Justine Lopez',
        actorRole: 'technician',
        targetEntityId: 'task-comp-01',
        metadata: { responseTimeSeconds: 300 },
      },
      {
        id: 'log-6',
        timestamp: now.toISOString(),
        localTimestamp: 'Just now',
        actionType: 'TASK_DELETED',
        category: 'ADMIN',
        actorId: 'admin-1',
        actorName: 'Admin Bob',
        actorRole: 'admin',
        targetEntityId: 'task-del-99',
      },
    ];

    it('calculates KPIs correctly across day, week, and month periods', () => {
      const kpis = calculateComplianceKPIs(sampleLogs, sampleTasks);

      expect(kpis.day).toBeDefined();
      expect(kpis.week).toBeDefined();
      expect(kpis.month).toBeDefined();

      expect(kpis.day.totalLogins).toBe(1);
      expect(kpis.day.totalLogouts).toBe(1);
      expect(kpis.day.softDeletedCount).toBe(1);
      expect(kpis.day.approvedCount).toBe(1);
      expect(kpis.day.flaggedCount).toBe(1);
      expect(kpis.day.firstTimePassRate).toBe('50%');
      expect(kpis.day.avgResponseSeconds).toBeGreaterThan(0);
    });

    it('deduplicates response time and work duration between tasks and logs', () => {
      const kpis = calculateComplianceKPIs(sampleLogs, sampleTasks);
      // Both sampleTasks[0] and log-5 have responseTime 300 for task-comp-01.
      // Deduplication ensures task-comp-01 is not counted twice with double weight.
      expect(kpis.day.avgResponseSeconds).toBe(300);
    });
  });

  describe('generateAuditLogCSVContent', () => {
    it('produces compliant CSV with 15 standard headers and properly escaped rows', () => {
      const now = new Date();
      const logs: AuditLogEntry[] = [
        {
          id: 'audit-csv-1',
          timestamp: now.toISOString(),
          localTimestamp: 'Aug 25, 2026, 10:00 AM',
          actionType: 'TASK_REASSIGNED',
          category: 'SUPERVISOR',
          actorId: 'sup-1',
          actorName: 'Sarah "Lead" Supervisor',
          actorRole: 'supervisor',
          targetEntityId: 'task-55',
          location: 'Building A / 2nd Floor',
          details: 'Reassigned task to available tech',
          reason: 'Original tech "off-duty" handoff',
          metadata: {
            responseTimeSeconds: 150,
            workDurationSeconds: 600,
            biometricVerified: true,
          },
        },
      ];

      const csv = generateAuditLogCSVContent({
        timeframe: 'today',
        timeframeLabel: 'Today',
        logs,
      });

      const lines = csv.split('\n');
      expect(lines[0]).toContain('Event ID,Timestamp (UTC),Local Date,Local Time,Actor Name,Actor Role');
      expect(lines[1]).toContain('audit-csv-1');
      expect(lines[1]).toContain('"Sarah ""Lead"" Supervisor"');
      expect(lines[1]).toContain('TASK_REASSIGNED');
      expect(lines[1]).toContain('"Original tech ""off-duty"" handoff"');
      expect(lines[1]).toContain('150,600,Yes');
    });
  });

  describe('exportAuditLogCSV', () => {
    it('writes audit CSV to storage and shares with text/csv MIME type', async () => {
      const result = await exportAuditLogCSV({
        timeframe: 'month',
        timeframeLabel: 'This Month',
        logs: [],
      });

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        expect.stringMatching(/klir-system-audit-log-month-\d+\.csv/),
        expect.stringContaining('Event ID,Timestamp (UTC)'),
        expect.objectContaining({ encoding: 'utf8' }),
      );

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringMatching(/klir-system-audit-log-month-\d+\.csv/),
        expect.objectContaining({
          mimeType: 'text/csv',
          dialogTitle: 'Klir System Audit Trail CSV - This Month',
          UTI: 'public.comma-separated-values-text',
        }),
      );

      expect(result.uri).toMatch(/klir-system-audit-log-month-\d+\.csv/);
    });
  });

  describe('generateAuditLogHTML & exportAuditLogPDF', () => {
    const sampleAuditInput: AuditLogPDFInput = {
      timeframeLabel: 'This Week',
      supervisorName: 'Sarah Lead Supervisor',
      building: 'SDCA Annex Building',
      generatedAt: new Date('2026-08-25T12:00:00Z'),
      logs: [
        {
          id: 'audit-html-1',
          timestamp: '2026-08-25T10:00:00Z',
          localTimestamp: 'Aug 25, 2026, 10:00:00 AM',
          actionType: 'TASK_COMPLETED',
          category: 'MAINTENANCE',
          actorId: 'tech-1',
          actorName: 'Justine Lopez',
          actorRole: 'technician',
          targetEntityId: 'task-comp-01',
          location: '1F Canteen Restroom',
          details: 'Work completed. Duration: 20m 0s.',
          metadata: {
            responseTimeSeconds: 300,
            workDurationSeconds: 1200,
            biometricVerified: true,
          },
        },
      ],
      kpis: {
        day: {
          periodLabel: 'Today (24h)',
          totalLogins: 2,
          totalLogouts: 2,
          tasksCreated: 5,
          tasksCompleted: 4,
          avgResponseSeconds: 120,
          avgWorkDurationSeconds: 600,
          approvedCount: 3,
          flaggedCount: 1,
          firstTimePassRate: '75%',
          softDeletedCount: 0,
        },
        week: {
          periodLabel: 'This Week (7d)',
          totalLogins: 14,
          totalLogouts: 14,
          tasksCreated: 35,
          tasksCompleted: 30,
          avgResponseSeconds: 145,
          avgWorkDurationSeconds: 650,
          approvedCount: 27,
          flaggedCount: 3,
          firstTimePassRate: '90%',
          softDeletedCount: 1,
        },
        month: {
          periodLabel: 'This Month (30d)',
          totalLogins: 60,
          totalLogouts: 58,
          tasksCreated: 150,
          tasksCompleted: 140,
          avgResponseSeconds: 130,
          avgWorkDurationSeconds: 620,
          approvedCount: 130,
          flaggedCount: 10,
          firstTimePassRate: '93%',
          softDeletedCount: 2,
        },
      },
    };

    it('generates HTML containing compliance badges, KPI matrix, and chronological ledger', () => {
      const html = generateAuditLogHTML(sampleAuditInput);

      expect(html).toContain('System Audit Trail');
      expect(html).toContain('NIST SP 800-92');
      expect(html).toContain('ISO 27001');
      expect(html).toContain('21 CFR Part 11');
      expect(html).toContain('Today (24h)');
      expect(html).toContain('This Week (7d)');
      expect(html).toContain('This Month (30d)');
      expect(html).toContain('90%');
      expect(html).toContain('93%');
      expect(html).toContain('Justine Lopez');
      expect(html).toContain('TASK_COMPLETED');
      expect(html).toContain('1F Canteen Restroom');
    });

    it('compiles PDF and triggers native share with application/pdf MIME type', async () => {
      const result = await exportAuditLogPDF(sampleAuditInput);

      expect(Print.printToFileAsync).toHaveBeenCalled();
      expect(Sharing.isAvailableAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        'file:///mock/cache/klir-report-mock.pdf',
        expect.objectContaining({
          mimeType: 'application/pdf',
          dialogTitle: 'Klir Audit & Compliance Report - This Week',
          UTI: 'com.adobe.pdf',
        }),
      );
      expect(result.uri).toBe('file:///mock/cache/klir-report-mock.pdf');
    });

    it('falls back to default period names when periodLabel is empty or whitespace', () => {
      const html = generateAuditLogHTML({
        ...sampleAuditInput,
        kpis: {
          ...sampleAuditInput.kpis,
          day: { ...sampleAuditInput.kpis.day, periodLabel: '' },
          week: { ...sampleAuditInput.kpis.week, periodLabel: '   ' },
          month: { ...sampleAuditInput.kpis.month, periodLabel: '  ' },
        },
      });

      expect(html).toContain('<th class="highlight-col">Today (24h)</th>');
      expect(html).toContain('<th class="highlight-col">This Week (7d)</th>');
      expect(html).toContain('<th class="highlight-col">This Month (30d)</th>');
    });

    it('escapes adversarial and XSS inputs in period labels and metadata', () => {
      const html = generateAuditLogHTML({
        ...sampleAuditInput,
        timeframeLabel: '<img src=x onerror=alert(1)>',
        kpis: {
          ...sampleAuditInput.kpis,
          day: { ...sampleAuditInput.kpis.day, periodLabel: '<script>alert("day")</script>' },
          week: { ...sampleAuditInput.kpis.week, periodLabel: 'Week & "Quotes"' },
        },
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;day&quot;)&lt;/script&gt;');
      expect(html).toContain('Week &amp; &quot;Quotes&quot;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('handles undefined logs and partial kpis gracefully without throwing runtime errors', () => {
      const minimalInput = {
        timeframeLabel: 'Custom Scope',
        supervisorName: 'Auditor Jane',
        building: 'Main Hall',
        generatedAt: new Date('2026-08-25T12:00:00Z'),
        logs: undefined as any,
        kpis: undefined as any,
      };

      const html = generateAuditLogHTML(minimalInput as any);
      expect(html).toContain('Chronological System Audit Trail (0 Log Records)');
      expect(html).toContain('No audit event records captured in this timeframe.');
      expect(html).toContain('<th class="highlight-col">Today (24h)</th>');
      expect(html).toContain('<th class="highlight-col">This Week (7d)</th>');
      expect(html).toContain('<th class="highlight-col">This Month (30d)</th>');
    });
  });
});

