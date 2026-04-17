import type { NavigatorScreenParams } from '@react-navigation/native';

export type TaskStatus = 'pending' | 'acknowledged' | 'completed';

export interface Task {
  id: string;
  toiletId: string;
  triggeredBy: 'admin';
  triggeredAt: Date;
  assignedTo: string;
  status: TaskStatus;
  note?: string;
  acknowledgedAt?: Date | null;
  completedAt?: Date | null;
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
}

export type AuthStackParamList = {
  Login: undefined;
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
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};
