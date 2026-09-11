import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import type { Task } from '../types';

export type AuditActionType =
  // Authentication & Session
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'SHIFT_END'
  // Supervisor Governance
  | 'TASK_REASSIGNED'
  | 'TASK_APPROVED'
  | 'TASK_FLAGGED'
  // Maintenance Lifecycle
  | 'TASK_ACKNOWLEDGED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'RECHECK_STARTED'
  // Admin & System Governance
  | 'TASK_CREATED'
  | 'TASK_DELETED'
  | 'CONFIG_UPDATED'
  | 'USER_ACCOUNT_CREATED'
  | 'PASSWORD_RESET_DISPATCHED';

export type AuditCategory =
  | 'AUTH'
  | 'SUPERVISOR'
  | 'MAINTENANCE'
  | 'ADMIN'
  | 'SYSTEM';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 UTC
  localTimestamp: string; // Formatted local time (en-PH)
  actorId: string;
  actorName: string;
  actorRole: 'admin' | 'supervisor' | 'maintenance' | 'technician' | 'system';
  actionType: AuditActionType;
  category: AuditCategory;
  targetEntityId?: string;
  targetEntityType?: 'task' | 'user' | 'config' | 'device' | 'session';
  location?: string;
  details?: string;
  reason?: string;
  metadata?: {
    responseTimeSeconds?: number;
    workDurationSeconds?: number;
    biometricVerified?: boolean;
    checklistScore?: string;
    photoCount?: number;
    clientPlatform?: string;
    floor?: string;
    building?: string;
    assigneeName?: string;
    previousAssignee?: string;
    newAssignee?: string;
    flagReason?: string;
    [key: string]: unknown;
  };
}

const AUDIT_LOG_STORAGE_KEY = '@klir:audit_logs_cache';
const MEMORY_AUDIT_LOGS: AuditLogEntry[] = [];

export function formatLocalTimestamp(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

export function clearAuditLogMemoryCache(): void {
  MEMORY_AUDIT_LOGS.length = 0;
}

export function getAuditLogMemoryCache(): AuditLogEntry[] {
  return [...MEMORY_AUDIT_LOGS];
}

export async function logAuditEvent(
  input: Omit<AuditLogEntry, 'id' | 'timestamp' | 'localTimestamp' | 'category'> &
    Partial<Pick<AuditLogEntry, 'id' | 'timestamp' | 'localTimestamp' | 'category'>>,
): Promise<AuditLogEntry> {
  const now = new Date();
  const id =
    input.id ||
    `audit_${now.getTime()}_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = input.timestamp || now.toISOString();
  const localTimestamp = input.localTimestamp || formatLocalTimestamp(now);

  const entry: AuditLogEntry = {
    ...input,
    id,
    timestamp,
    localTimestamp,
    category: input.category || determineCategory(input.actionType),
    actorRole: input.actorRole || 'system',
  };

  // 1. Maintain in-memory and local AsyncStorage queue/cache for offline resilience
  MEMORY_AUDIT_LOGS.unshift(entry);
  if (MEMORY_AUDIT_LOGS.length > 500) {
    MEMORY_AUDIT_LOGS.pop();
  }

  AsyncStorage.getItem(AUDIT_LOG_STORAGE_KEY)
    .then((cachedStr) => {
      const list: AuditLogEntry[] = cachedStr ? JSON.parse(cachedStr) : [];
      list.unshift(entry);
      return AsyncStorage.setItem(
        AUDIT_LOG_STORAGE_KEY,
        JSON.stringify(list.slice(0, 300)),
      );
    })
    .catch(() => {
      // ignore storage errors
    });

  // 2. Persist to Firestore append-only collection
  try {
    if (typeof db?.collection === 'function') {
      await db.collection('auditLogs').doc(id).set(entry);
    }
  } catch (error) {
    console.warn('[audit-logger] Failed to write auditLog to Firestore (cached locally):', error);
  }

  return entry;
}

function determineCategory(action: AuditActionType): AuditCategory {
  switch (action) {
    case 'AUTH_LOGIN':
    case 'AUTH_LOGOUT':
    case 'SHIFT_END':
      return 'AUTH';
    case 'TASK_REASSIGNED':
    case 'TASK_APPROVED':
    case 'TASK_FLAGGED':
      return 'SUPERVISOR';
    case 'TASK_ACKNOWLEDGED':
    case 'TASK_STARTED':
    case 'TASK_COMPLETED':
    case 'RECHECK_STARTED':
      return 'MAINTENANCE';
    case 'TASK_CREATED':
    case 'TASK_DELETED':
    case 'CONFIG_UPDATED':
    case 'USER_ACCOUNT_CREATED':
    case 'PASSWORD_RESET_DISPATCHED':
      return 'ADMIN';
    default:
      return 'SYSTEM';
  }
}

export async function logAuthAudit(
  action: 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'SHIFT_END',
  actor: {
    uid: string;
    name?: string | null;
    role?: string | null;
    email?: string | null;
    building?: string | null;
  },
  details?: string,
): Promise<AuditLogEntry> {
  const role = (actor.role?.toLowerCase() ?? 'system') as AuditLogEntry['actorRole'];
  return logAuditEvent({
    actionType: action,
    category: 'AUTH',
    actorId: actor.uid,
    actorName: actor.name || actor.email || 'Staff Member',
    actorRole: role,
    targetEntityId: actor.uid,
    targetEntityType: 'session',
    location: actor.building || 'Campus Facilities',
    details:
      details ||
      (action === 'AUTH_LOGIN'
        ? `Authenticated session established for ${actor.name || actor.email}`
        : `User ended shift and logged out successfully`),
    metadata: {
      clientPlatform: 'Mobile (React Native)',
      email: actor.email || undefined,
      building: actor.building || undefined,
    },
  });
}

export async function logTaskAudit(
  action: AuditActionType,
  taskOrId: (Partial<Task> & { id: string }) | string,
  actor: {
    uid: string;
    name?: string | null;
    role?: string | null;
  },
  extra?: {
    reason?: string;
    responseTime?: number;
    duration?: number;
    biometricVerified?: boolean;
    newAssignee?: string;
    previousAssignee?: string;
    checklistScore?: string;
    [key: string]: unknown;
  },
): Promise<AuditLogEntry> {
  const task: Partial<Task> & { id: string } =
    typeof taskOrId === 'string' ? { id: taskOrId } : taskOrId;
  const role = (actor.role?.toLowerCase() ?? 'system') as AuditLogEntry['actorRole'];
  const loc = task.location || task.restroomName || `${task.floor ?? ''} ${task.building ?? ''}`.trim() || 'Facility';

  let details = '';
  switch (action) {
    case 'TASK_ACKNOWLEDGED':
      details = `Task acknowledged by technician. Response SLA: ${extra?.responseTime ?? task.responseTime ?? 0}s`;
      break;
    case 'TASK_STARTED':
    case 'RECHECK_STARTED':
      details = `On-site inspection started for ${task.component || 'facility issue'}`;
      break;
    case 'TASK_COMPLETED':
      details = `Work completed. Duration: ${extra?.duration ?? task.workDuration ?? 0}s. Biometric: ${extra?.biometricVerified ?? task.biometricVerified ? 'Verified' : 'Standard'}. Checklist: ${extra?.checklistScore ?? '10/10'}`;
      break;
    case 'TASK_APPROVED':
      details = `Supervisor approved work order proof and quality verification.`;
      break;
    case 'TASK_FLAGGED':
      details = `Supervisor flagged task for rework. Reason: ${extra?.reason || task.flagReason || 'Quality non-conformance'}`;
      break;
    case 'TASK_REASSIGNED':
      details = `Supervisor reassigned task. Reason: ${extra?.reason || 'Shift Handoff'}`;
      break;
    case 'TASK_CREATED':
      details = `Task created. Floor: ${task.floor}, Building: ${task.building}, Trigger: ${task.triggerType || 'manual'}`;
      break;
    case 'TASK_DELETED':
      details = `Task soft-deleted. Status marked cancelled / archived. Reason: ${extra?.reason || 'Administrative soft-deletion'}`;
      break;
    default:
      details = `Action ${action} recorded for task ${task.id}`;
  }

  return logAuditEvent({
    actionType: action,
    category: determineCategory(action),
    actorId: actor.uid,
    actorName: actor.name || 'Staff Member',
    actorRole: role,
    targetEntityId: task.id,
    targetEntityType: 'task',
    location: loc,
    details,
    reason: extra?.reason || undefined,
    metadata: {
      ...(extra || {}),
      responseTimeSeconds: (extra?.responseTime ?? task.responseTime) ?? undefined,
      workDurationSeconds: (extra?.duration ?? task.workDuration) ?? undefined,
      biometricVerified: (extra?.biometricVerified ?? task.biometricVerified) ?? undefined,
      checklistScore: extra?.checklistScore,
      floor: task.floor || undefined,
      building: task.building || undefined,
      newAssignee: extra?.newAssignee,
      previousAssignee: extra?.previousAssignee,
      flagReason: (extra?.reason || task.flagReason) || undefined,
    },
  });
}

export async function fetchAuditLogs(filter?: {
  timeframe?: 'today' | 'week' | 'month' | 'year' | 'all';
  category?: AuditCategory;
  actorRole?: string;
}): Promise<AuditLogEntry[]> {
  const records: AuditLogEntry[] = [];

  // 1. Fetch from Firestore if accessible
  try {
    if (typeof db?.collection === 'function') {
      const snapshot = await db.collection('auditLogs').get();
      if (snapshot && !snapshot.empty) {
        snapshot.docs.forEach((doc) => {
          records.push(doc.data() as AuditLogEntry);
        });
      }
    }
  } catch (err) {
    console.warn('[audit-logger] Direct Firestore read failed, using local cache:', err);
  }

  // 2. Supplement with in-memory logs
  MEMORY_AUDIT_LOGS.forEach((m) => {
    if (!records.some((r) => r.id === m.id)) {
      records.push(m);
    }
  });

  // 3. Supplement with AsyncStorage cache
  try {
    const cachedStr = await AsyncStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (cachedStr) {
      const parsed: AuditLogEntry[] = JSON.parse(cachedStr);
      parsed.forEach((c) => {
        if (!records.some((r) => r.id === c.id)) {
          records.push(c);
        }
      });
    }
  } catch {
    // ignore
  }

  // Sort by timestamp descending
  records.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Filter according to timeframe and categories
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return records.filter((rec) => {
    const recDate = new Date(rec.timestamp);

    if (filter?.timeframe) {
      switch (filter.timeframe) {
        case 'today':
          if (recDate < startOfToday) return false;
          break;
        case 'week':
          if (recDate < startOfWeek) return false;
          break;
        case 'month':
          if (recDate < startOfMonth) return false;
          break;
        case 'year':
          if (recDate < startOfYear) return false;
          break;
        case 'all':
        default:
          break;
      }
    }

    if (filter?.category && rec.category !== filter.category) {
      return false;
    }

    if (filter?.actorRole && rec.actorRole !== filter.actorRole) {
      return false;
    }

    return true;
  });
}
