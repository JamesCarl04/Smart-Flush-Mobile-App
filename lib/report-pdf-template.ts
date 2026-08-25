import type { MaintenancePerson } from './supervisor-api';
import type { Task, TaskChecklist } from '../types';

export interface ReportPDFInput {
  timeframeLabel: string;
  supervisorName: string;
  building: string;
  generatedAt: Date;
  tasks: Task[];
  people: MaintenancePerson[];
  metrics: {
    total: number;
    avgDuration: string;
    avgResponse: string;
    photoPairsCount: number;
    biometricPct: string;
    approvedCount: number;
    flaggedCount: number;
    pendingAuditCount: number;
    complianceRate: string;
  };
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatDurationSeconds(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.round(seconds % 60);
  if (mins > 0) return `${mins}m ${remSecs}s`;
  return `${remSecs}s`;
}

function getChecklistSummary(checklist?: TaskChecklist | null): { done: number; total: number; score: string } {
  if (!checklist || typeof checklist !== 'object') {
    return { done: 0, total: 10, score: '0/10' };
  }
  const keys: Array<keyof TaskChecklist> = [
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

  let doneCount = 0;
  for (const key of keys) {
    const val = checklist[key];
    if (val === 'done' || val === 'na') {
      doneCount++;
    }
  }
  return { done: doneCount, total: 10, score: `${doneCount}/10` };
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

export function generateReportHTML(input: ReportPDFInput): string {
  const {
    timeframeLabel,
    supervisorName,
    building,
    generatedAt,
    tasks,
    people,
    metrics,
  } = input;

  const generatedDateFormatted = formatDate(generatedAt);

  const taskRowsHTML = tasks
    .map((t, index) => {
      const assignee = getAssigneeName(t.completedBy ?? t.assignedTo, people);
      const loc = t.location || t.restroomName || t.deviceId;
      const createdStr = formatDate(t.createdAt);
      const completedStr = formatDate(t.completedAt);
      const durationStr = formatDurationSeconds(t.workDuration);
      const checklistInfo = getChecklistSummary(t.checklist);
      const inspStatus = t.inspectionStatus ?? (t.status === 'flagged' ? 'flagged' : 'pending_review');

      let statusBadge = '';
      if (inspStatus === 'approved') {
        statusBadge = '<span class="badge badge-approved">✓ APPROVED</span>';
      } else if (inspStatus === 'flagged' || t.status === 'flagged') {
        statusBadge = '<span class="badge badge-flagged">⚑ FLAGGED</span>';
      } else {
        statusBadge = '<span class="badge badge-pending">⏳ PENDING AUDIT</span>';
      }

      const biometricBadge = t.biometricVerified
        ? '<span class="badge badge-bio">✓ VERIFIED</span>'
        : '<span class="badge badge-standard">STANDARD</span>';

      const photoBadge = t.beforePhotoUrl && t.afterPhotoUrl
        ? '<span class="badge badge-photo">📷 PAIR SAVED</span>'
        : t.afterPhotoUrl
          ? '<span class="badge badge-photo">📷 1 PHOTO</span>'
          : '<span class="badge badge-no-photo">NO PHOTO</span>';

      let remarksHtml = '';
      if (t.remarks) {
        remarksHtml += `<div class="task-note"><strong>Tech Remarks:</strong> ${escapeHtml(t.remarks)}</div>`;
      }
      if (t.flagReason) {
        remarksHtml += `<div class="task-flag-reason"><strong>Supervisor Flag:</strong> ${escapeHtml(t.flagReason)}</div>`;
      }

      return `
        <tr class="${index % 2 === 1 ? 'even-row' : ''}">
          <td class="col-index">${index + 1}</td>
          <td class="col-location">
            <div class="primary-text">${escapeHtml(loc)}</div>
            <div class="secondary-text">${escapeHtml(t.floor || 'Ground')} • ${escapeHtml(t.building || building)}</div>
            <div class="task-id-tag">ID: ${escapeHtml(t.id)}</div>
          </td>
          <td class="col-component">
            <div class="primary-text">${escapeHtml(t.component || 'Restroom')}</div>
            <div class="secondary-text">Trigger: ${escapeHtml(t.triggerType || 'manual')}</div>
          </td>
          <td class="col-tech">
            <div class="primary-text">${escapeHtml(assignee)}</div>
            <div class="secondary-text">Checklist: ${checklistInfo.score}</div>
          </td>
          <td class="col-timeline">
            <div><span class="timeline-label">Start:</span> ${createdStr}</div>
            <div><span class="timeline-label">End:</span> ${completedStr}</div>
            <div class="duration-highlight">Duration: ${durationStr}</div>
          </td>
          <td class="col-compliance">
            <div class="badge-stack">
              ${biometricBadge}
              ${photoBadge}
            </div>
          </td>
          <td class="col-status">
            ${statusBadge}
            ${remarksHtml}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Flush - Operations Compliance Report</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      padding: 24px;
      font-size: 11px;
      line-height: 1.4;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none;
      }
      tr {
        page-break-inside: avoid;
      }
      .summary-grid {
        page-break-inside: avoid;
      }
    }

    /* Header Styling */
    .header-container {
      border-bottom: 3px solid #8B0000;
      padding-bottom: 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-section h1 {
      font-size: 20px;
      font-weight: 800;
      color: #8B0000;
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    .brand-section h2 {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-box {
      text-align: right;
      font-size: 10.5px;
      color: #475569;
      background-color: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .meta-box strong {
      color: #0f172a;
    }

    /* Executive KPI Grid */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-title::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 14px;
      background-color: #8B0000;
      border-radius: 2px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
    }
    .kpi-card.highlight {
      background-color: #fff5f5;
      border-color: #fed7d7;
    }
    .kpi-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 2px;
    }
    .kpi-card.highlight .kpi-value {
      color: #8B0000;
    }
    .kpi-label {
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.3px;
    }

    /* Table Styling */
    .table-container {
      width: 100%;
      margin-bottom: 20px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    thead th {
      background-color: #8B0000;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border: none;
    }
    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tbody tr.even-row {
      background-color: #f8fafc;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }

    .col-index { width: 4%; text-align: center; color: #64748b; font-weight: 600; }
    .col-location { width: 22%; }
    .col-component { width: 14%; }
    .col-tech { width: 15%; }
    .col-timeline { width: 20%; font-size: 10px; }
    .col-compliance { width: 12%; }
    .col-status { width: 13%; }

    .primary-text {
      font-weight: 600;
      color: #0f172a;
    }
    .secondary-text {
      font-size: 9.5px;
      color: #64748b;
    }
    .task-id-tag {
      font-family: monospace;
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .timeline-label {
      color: #64748b;
      font-size: 9px;
    }
    .duration-highlight {
      font-weight: 600;
      color: #0369a1;
      margin-top: 2px;
    }

    /* Badges */
    .badge-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-align: center;
    }
    .badge-approved { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-flagged { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .badge-pending { background-color: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .badge-bio { background-color: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
    .badge-standard { background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .badge-photo { background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-no-photo { background-color: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .task-note {
      font-size: 9px;
      color: #334155;
      background-color: #f1f5f9;
      padding: 3px 5px;
      border-radius: 3px;
      margin-top: 4px;
    }
    .task-flag-reason {
      font-size: 9px;
      color: #991b1b;
      background-color: #fee2e2;
      padding: 3px 5px;
      border-radius: 3px;
      margin-top: 4px;
    }

    /* Footer */
    .report-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header-container">
    <div class="brand-section">
      <h1>KLIR • SMART FLUSH</h1>
      <h2>SDCA Facility Maintenance & Compliance Audit Report</h2>
    </div>
    <div class="meta-box">
      <div><strong>Period:</strong> ${escapeHtml(timeframeLabel)}</div>
      <div><strong>Facility:</strong> ${escapeHtml(building)}</div>
      <div><strong>Auditor:</strong> ${escapeHtml(supervisorName)}</div>
      <div><strong>Generated:</strong> ${generatedDateFormatted}</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="section-title">Executive Quality & Performance Summary</div>
  <div class="summary-grid">
    <div class="kpi-card highlight">
      <div class="kpi-value">${metrics.total}</div>
      <div class="kpi-label">Completed Work Orders</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.avgDuration}</div>
      <div class="kpi-label">Avg Work Duration</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.complianceRate}</div>
      <div class="kpi-label">Supervisor QA Rate</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.biometricPct}</div>
      <div class="kpi-label">Biometric Verification</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="kpi-card">
      <div class="kpi-value">${metrics.approvedCount}</div>
      <div class="kpi-label">Approved Tasks</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.flaggedCount}</div>
      <div class="kpi-label">Flagged Rechecks</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.photoPairsCount}</div>
      <div class="kpi-label">Photo Evidence Pairs</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${metrics.pendingAuditCount}</div>
      <div class="kpi-label">Pending QA Review</div>
    </div>
  </div>

  <!-- Work Orders Ledger -->
  <div class="section-title">Work Order & Inspection Ledger (${metrics.total} Records)</div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="col-index">#</th>
          <th class="col-location">Location & Facility</th>
          <th class="col-component">Component / Alert</th>
          <th class="col-tech">Technician & Score</th>
          <th class="col-timeline">Execution Timeline</th>
          <th class="col-compliance">Verification</th>
          <th class="col-status">Audit Status</th>
        </tr>
      </thead>
      <tbody>
        ${taskRowsHTML || '<tr><td colspan="7" style="text-align:center; padding: 20px; color: #64748b;">No completed tasks recorded in this period.</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <div>KLIR Smart Restroom System • St. Dominic College of Asia Facility Operations</div>
    <div>Confidential Operational Audit Record • Generated via Mobile Executive Suite</div>
  </div>

</body>
</html>`;
}
