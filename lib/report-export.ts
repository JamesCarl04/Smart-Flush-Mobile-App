import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { generateReportHTML, type ReportPDFInput } from './report-pdf-template';
import type { MaintenancePerson } from './supervisor-api';
import type { Task } from '../types';

export interface ReportCSVInput {
  timeframe: string;
  timeframeLabel: string;
  tasks: Task[];
  people: MaintenancePerson[];
}

function getAssigneeName(
  assignedUid: string | null | undefined,
  people: MaintenancePerson[],
): string {
  if (!assignedUid) return 'Unassigned';
  const found = people.find(
    (p) =>
      p.id === assignedUid ||
      p.email === assignedUid ||
      (p.displayName && p.displayName.toLowerCase() === assignedUid.toLowerCase()),
  );
  return found?.displayName ?? assignedUid;
}

export function generateCSVContent(input: ReportCSVInput): string {
  const { tasks, people } = input;

  const headers = [
    'Task ID',
    'Restroom / Location',
    'Floor',
    'Building',
    'Component',
    'Trigger Type',
    'Technician(s)',
    'Created At',
    'Completed At',
    'Work Duration (Seconds)',
    'Biometric Verified',
    'Inspection Status',
    'Inspected By',
    'Inspected At',
    'Flag Reason',
    'Recheck Count',
    'Remarks',
  ];

  const rows = tasks.map((t) => {
    const assignee = getAssigneeName(t.completedBy ?? t.assignedTo, people);
    const createdAtStr = t.createdAt ? t.createdAt.toISOString() : 'N/A';
    const completedAtStr = t.completedAt ? t.completedAt.toISOString() : 'N/A';
    const remarksClean = `"${(t.remarks || '').replace(/"/g, '""')}"`;
    const locClean = `"${(t.location || t.restroomName || '').replace(/"/g, '""')}"`;
    const inspStatus = t.inspectionStatus ?? (t.status === 'flagged' ? 'flagged' : 'pending_review');
    const inspByName = `"${(t.inspectedByName || t.inspectedBy || 'N/A').replace(/"/g, '""')}"`;
    const inspAtStr = t.inspectedAt ? t.inspectedAt.toISOString() : 'N/A';
    const flagReasonClean = `"${(t.flagReason || '').replace(/"/g, '""')}"`;

    return [
      t.id,
      locClean,
      t.floor || 'Ground',
      t.building || 'SDCA Annex Building',
      t.component || 'Restroom',
      t.triggerType || 'manual',
      `"${assignee.replace(/"/g, '""')}"`,
      createdAtStr,
      completedAtStr,
      t.workDuration ?? 0,
      t.biometricVerified ? 'Yes' : 'No',
      inspStatus,
      inspByName,
      inspAtStr,
      flagReasonClean,
      t.recheckCount ?? 0,
      remarksClean,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export async function exportReportPDF(input: ReportPDFInput): Promise<{ uri: string }> {
  const html = generateReportHTML(input);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Klir Operations Report - ${input.timeframeLabel}`,
      UTI: 'com.adobe.pdf',
    });
  }

  return { uri };
}

export async function exportReportCSV(input: ReportCSVInput): Promise<{ uri: string }> {
  const csvContent = generateCSVContent(input);
  const safeTimeframe = input.timeframe.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filename = `klir-operations-report-${safeTimeframe}-${Date.now()}.csv`;
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const fileUri = `${baseDir}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Klir Operations CSV - ${input.timeframeLabel}`,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return { uri: fileUri };
}
