import type { NavigatorScreenParams } from '@react-navigation/native';

export type TaskStatus =
  | 'unassigned'
  | 'assigned'
  | 'acknowledged'
  | 'completed'
  | 'reassignment_needed'
  | 'flagged'
  | 'rechecking';

export type TaskTriggerType =
  | 'manual'
  | 'hardware_failure'
  | 'maintenance'
  | 'flush_count'
  | 'uv_complete';

export type UserRole = 'maintenance' | 'supervisor';
export type ChecklistValue = 'unchecked' | 'done' | 'na';

export interface TaskChecklist {
  removeCeilingDust: ChecklistValue;
  removeWallDust: ChecklistValue;
  removeLightBulbDust: ChecklistValue;
  cleanWindows: ChecklistValue;
  wipeDownFixtures: ChecklistValue;
  disinfectTouchedSurfaces: ChecklistValue;
  sweepAndDryFloors: ChecklistValue;
  emptyTrashBins: ChecklistValue;
  arrangeFixtures: ChecklistValue;
  disinfectUVLights: ChecklistValue;
}

export interface TaskSubmission {
  technicianUid: string;
  technicianName: string;
  checklist: TaskChecklist;
  beforePhotoUrl?: string | null;
  beforePhotoCapturedAt?: Date | null;
  afterPhotoUrl?: string | null;
  afterPhotoCapturedAt?: Date | null;
  remarks?: string;
  workDuration?: number | null;
  completedAt: Date;
  biometricVerified?: boolean;
}

export interface Task {
  id: string;
  alertId?: string | null;
  deviceId: string;
  restroomName?: string | null;
  type: 'maintenance' | 'cleaning';
  component: string;
  location: string;
  floor: string;
  building: string;
  shift: '1st' | '2nd';
  triggerType: TaskTriggerType;
  message: string;
  assignedTo: string | null;
  assignedToIds?: string[];
  isBroadcast?: boolean;
  assignmentType?: 'broadcast' | 'individual' | 'team';
  status: TaskStatus;
  createdAt: Date;
  assignedAt?: Date | null;
  acknowledgedAt?: Date | null;
  completedAt?: Date | null;
  acknowledgedBy?: Record<string, Date>;
  completedByMap?: Record<string, Date>;
  submissions?: Record<string, TaskSubmission>;
  responseTime?: number | null;
  workDuration?: number | null;
  totalTime?: number | null;
  checklist?: TaskChecklist;
  remarks?: string;
  beforePhotoUrl?: string | null;
  beforePhotoCapturedAt?: Date | null;
  afterPhotoUrl?: string | null;
  afterPhotoCapturedAt?: Date | null;
  biometricVerified?: boolean;
  offlineSynced?: boolean;
  completedBy?: string | null;
  reassignCount?: number;
  supervisorUid?: string | null;
  createdBy: string;

  // QA & Supervisor Audit Fields
  inspectionStatus?: 'pending_review' | 'approved' | 'flagged';
  inspectedBy?: string | null;
  inspectedByName?: string | null;
  inspectedAt?: Date | null;
  flagReason?: string | null;
  flagPhotoUrls?: string[];
  recheckCount?: number;
  recheckedBy?: string | null;
  recheckedAt?: Date | null;
}

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  building?: string | null;
  shift?: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  role: AuthUser['role'] | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export interface TasksContextValue {
  tasks: Task[];
  inboxTasks: Task[];
  historyTasks: Task[];
  pendingCount: number;
  loading: boolean;
  errorMessage: string | null;
  refreshTasks: () => Promise<void>;
  clearError: () => void;
  simulateHardwareFailureAlert?: () => Task;
}

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type InboxStackParamList = {
  InboxHome: undefined;
  TaskDetail: { taskId: string };
};

export type HistoryStackParamList = {
  HistoryHome: undefined;
  TaskDetail: { taskId: string };
};

export type TaskStackParamList = {
  ActiveTask: { taskId?: string } | undefined;
  TaskDetail: { taskId: string };
};

export type SupervisorStackParamList = {
  SupervisorDashboard: undefined;
  TeamAvailability: undefined;
  SupervisorTasks: undefined;
  SupervisorTaskDetail: { taskId: string };
  CompletedReviews: undefined;
  CompletedReviewDetail: { taskId: string };
  SupervisorReports: undefined;
};

export type MainTabParamList = {
  InboxTab: NavigatorScreenParams<InboxStackParamList>;
  TaskTab: NavigatorScreenParams<TaskStackParamList> | undefined;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
  SupervisorTab: NavigatorScreenParams<SupervisorStackParamList> | undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};
