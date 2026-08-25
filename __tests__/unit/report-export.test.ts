import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  exportReportCSV,
  exportReportPDF,
  generateCSVContent,
} from '../../lib/report-export';
import { generateReportHTML, type ReportPDFInput } from '../../lib/report-pdf-template';
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
});
