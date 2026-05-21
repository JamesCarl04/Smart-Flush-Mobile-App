import type { NavigatorScreenParams } from '@react-navigation/native';

export type TaskStatus = 'pending' | 'acknowledged' | 'completed';

export type TaskTriggerType =
  | 'manual'
  | 'uv_complete'
  | 'flush_count'
  | 'maintenance';

export interface Task {
  id: string;
  deviceId: string;
  triggerType: TaskTriggerType;
  message: string;
  assignedTo: string | null;
  status: TaskStatus;
  createdAt: Date;
  acknowledgedAt?: Date | null;
  completedAt?: Date | null;
  createdBy: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  role: 'maintenance';
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
  clearError: () => void;
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

export type MainTabParamList = {
  InboxTab: NavigatorScreenParams<InboxStackParamList>;
  TaskTab: undefined;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};
