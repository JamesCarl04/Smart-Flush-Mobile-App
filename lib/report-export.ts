import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  generateReportHTML,
  generateAuditLogHTML,
  type ReportPDFInput,
  type AuditLogPDFInput,
  type AuditComplianceKPIs,
} from './report-pdf-template';
import type { MaintenancePerson } from './supervisor-api';
import type { Task } from '../types';
import type { AuditLogEntry } from './audit-logger';

export interface AuditLogCSVInput {
  timeframe: string;
  timeframeLabel: string;
  logs: AuditLogEntry[];
}

export interface ReportCSVInput {
  timeframe: string;
  timeframeLabel: string;
  tasks: Task[];
  people: MaintenancePerson[];
}

function getAssigneeName(
  assignedUid: string | null | undefined,
  people: MaintenancePerson[],
  task?: Task | null,
): string {
  const resolvePersonName = (idOrEmail: string): string => {
    const found = people.find(
      (p) =>
        p.id === idOrEmail ||
        p.email === idOrEmail ||
        (p.displayName && p.displayName.toLowerCase() === idOrEmail.toLowerCase()),
    );
    return found?.displayName ?? idOrEmail;
  };

  const validIds = task?.assignedToIds?.filter(
    (id) => Boolean(id) && id !== 'unassigned',
  );

  if (validIds && validIds.length > 0) {
    const names = validIds.map(resolvePersonName);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} +${names.length - 2} others`;
  }

  if (!assignedUid || assignedUid === 'unassigned') return 'Unassigned';
  return resolvePersonName(assignedUid);
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
    'Reassign Count',
    'Reassigned By',
    'Reassignment Reason',
    'Remarks',
  ];

  const rows = tasks.map((t) => {
    const assignee = getAssigneeName(t.completedBy ?? t.assignedTo, people, t);
    const createdAtStr = t.createdAt ? t.createdAt.toISOString() : 'N/A';
    const completedAtStr = t.completedAt ? t.completedAt.toISOString() : 'N/A';
    const remarksClean = `"${(t.remarks || '').replace(/"/g, '""')}"`;
    const locClean = `"${(t.location || t.restroomName || '').replace(/"/g, '""')}"`;
    const inspStatus = t.inspectionStatus ?? (t.status === 'flagged' ? 'flagged' : 'pending_review');
    const inspByName = `"${(t.inspectedByName || t.inspectedBy || 'N/A').replace(/"/g, '""')}"`;
    const inspAtStr = t.inspectedAt ? t.inspectedAt.toISOString() : 'N/A';
    const flagReasonClean = `"${(t.flagReason || '').replace(/"/g, '""')}"`;
    const reassignCount = t.reassignCount ?? 0;
    const reassignedByName = `"${(t.reassignedByName || (reassignCount > 0 || t.reassignReason ? 'Supervisor' : 'N/A')).replace(/"/g, '""')}"`;
    const reassignReasonClean = `"${(t.reassignReason || 'N/A').replace(/"/g, '""')}"`;

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
      reassignCount,
      reassignedByName,
      reassignReasonClean,
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

export function calculateComplianceKPIs(
  logs: AuditLogEntry[],
  tasks: Task[] = [],
): { day: AuditComplianceKPIs; week: AuditComplianceKPIs; month: AuditComplianceKPIs } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

  const computeForPeriod = (label: string, startDate: Date): AuditComplianceKPIs => {
    const periodLogs = logs.filter((l) => new Date(l.timestamp) >= startDate);
    const periodTasks = tasks.filter((t) => {
      const d = t.completedAt ?? t.createdAt;
      return d ? new Date(d) >= startDate : false;
    });

    const totalLogins = periodLogs.filter((l) => l.actionType === 'AUTH_LOGIN').length;
    const totalLogouts = periodLogs.filter(
      (l) => l.actionType === 'AUTH_LOGOUT' || l.actionType === 'SHIFT_END',
    ).length;

    const tasksCreatedLogs = periodLogs.filter((l) => l.actionType === 'TASK_CREATED').length;
    const tasksCreated = Math.max(tasksCreatedLogs, periodTasks.length);

    const completedTasksList = periodTasks.filter(
      (t) => t.status === 'completed' || Boolean(t.completedAt),
    );
    const tasksCompletedLogs = periodLogs.filter((l) => l.actionType === 'TASK_COMPLETED').length;
    const tasksCompleted = Math.max(tasksCompletedLogs, completedTasksList.length);

    const seenResponseTaskIds = new Set<string>();
    let totalResponse = 0;
    let respCount = 0;
    periodTasks.forEach((t) => {
      if (t.responseTime) {
        seenResponseTaskIds.add(t.id);
        totalResponse += t.responseTime;
        respCount++;
      }
    });
    periodLogs.forEach((l) => {
      if (
        l.targetEntityId &&
        !seenResponseTaskIds.has(l.targetEntityId) &&
        l.metadata?.responseTimeSeconds &&
        typeof l.metadata.responseTimeSeconds === 'number'
      ) {
        seenResponseTaskIds.add(l.targetEntityId);
        totalResponse += l.metadata.responseTimeSeconds;
        respCount++;
      }
    });
    const avgResponseSeconds = respCount > 0 ? Math.round(totalResponse / respCount) : 0;

    const seenDurationTaskIds = new Set<string>();
    let totalDuration = 0;
    let durCount = 0;
    periodTasks.forEach((t) => {
      if (t.workDuration) {
        seenDurationTaskIds.add(t.id);
        totalDuration += t.workDuration;
        durCount++;
      }
    });
    periodLogs.forEach((l) => {
      if (
        l.targetEntityId &&
        !seenDurationTaskIds.has(l.targetEntityId) &&
        l.metadata?.workDurationSeconds &&
        typeof l.metadata.workDurationSeconds === 'number'
      ) {
        seenDurationTaskIds.add(l.targetEntityId);
        totalDuration += l.metadata.workDurationSeconds;
        durCount++;
      }
    });
    const avgWorkDurationSeconds = durCount > 0 ? Math.round(totalDuration / durCount) : 0;

    const approvedCount = Math.max(
      periodLogs.filter((l) => l.actionType === 'TASK_APPROVED').length,
      periodTasks.filter((t) => t.inspectionStatus === 'approved').length,
    );
    const flaggedCount = Math.max(
      periodLogs.filter((l) => l.actionType === 'TASK_FLAGGED').length,
      periodTasks.filter((t) => t.inspectionStatus === 'flagged' || t.status === 'flagged').length,
    );

    const totalAudited = approvedCount + flaggedCount;
    const firstTimePassRate =
      totalAudited > 0 ? `${Math.round((approvedCount / totalAudited) * 100)}%` : '100%';

    const softDeletedCount = Math.max(
      periodLogs.filter((l) => l.actionType === 'TASK_DELETED').length,
      periodTasks.filter((t) => (t as any).isDeleted || (t.status as string) === 'cancelled').length,
    );

    return {
      periodLabel: label,
      totalLogins,
      totalLogouts,
      tasksCreated,
      tasksCompleted,
      avgResponseSeconds,
      avgWorkDurationSeconds,
      approvedCount,
      flaggedCount,
      firstTimePassRate,
      softDeletedCount,
    };
  };

  return {
    day: computeForPeriod('Today (24h)', startOfToday),
    week: computeForPeriod('This Week (7d)', startOfWeek),
    month: computeForPeriod('This Month (30d)', startOfMonth),
  };
}

export function generateAuditLogCSVContent(input: AuditLogCSVInput): string {
  const { logs } = input;

  const headers = [
    'Event ID',
    'Timestamp (UTC)',
    'Local Date',
    'Local Time',
    'Actor Name',
    'Actor Role',
    'Event Category',
    'Action Type',
    'Target Entity ID',
    'Location (Building / Floor / Room)',
    'Details / Change Summary',
    'Justification / Reason',
    'Response Time (s)',
    'Work Duration (s)',
    'Biometric Verified',
  ];

  const rows = logs.map((l) => {
    const d = new Date(l.timestamp);
    const localDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-PH') : 'N/A';
    const localTime = !isNaN(d.getTime()) ? d.toLocaleTimeString('en-PH') : 'N/A';
    const actorClean = `"${(l.actorName || '').replace(/"/g, '""')}"`;
    const locClean = `"${(l.location || 'SDCA Campus').replace(/"/g, '""')}"`;
    const detailsClean = `"${(l.details || '').replace(/"/g, '""')}"`;
    const reasonClean = `"${(l.reason || 'N/A').replace(/"/g, '""')}"`;
    const respTime = l.metadata?.responseTimeSeconds ?? 'N/A';
    const duration = l.metadata?.workDurationSeconds ?? 'N/A';
    const biometric =
      l.metadata?.biometricVerified != null
        ? l.metadata.biometricVerified
          ? 'Yes'
          : 'No'
        : 'N/A';

    return [
      l.id,
      l.timestamp,
      localDate,
      localTime,
      actorClean,
      l.actorRole,
      l.category,
      l.actionType,
      l.targetEntityId || 'N/A',
      locClean,
      detailsClean,
      reasonClean,
      respTime,
      duration,
      biometric,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export async function exportAuditLogCSV(input: AuditLogCSVInput): Promise<{ uri: string }> {
  const csvContent = generateAuditLogCSVContent(input);
  const safeTimeframe = input.timeframe.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filename = `klir-system-audit-log-${safeTimeframe}-${Date.now()}.csv`;
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const fileUri = `${baseDir}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Klir System Audit Trail CSV - ${input.timeframeLabel}`,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return { uri: fileUri };
}

export async function exportAuditLogPDF(input: AuditLogPDFInput): Promise<{ uri: string }> {
  const html = generateAuditLogHTML(input);
  const { uri } = await Print.printToFileAsync({ html });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Klir Audit & Compliance Report - ${input.timeframeLabel}`,
      UTI: 'com.adobe.pdf',
    });
  }

  return { uri };
}

