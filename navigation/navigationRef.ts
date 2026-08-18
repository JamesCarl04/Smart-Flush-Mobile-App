import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingTaskId: string | null = null;

function queueTaskNavigation(taskId: string): void {
  pendingTaskId = taskId;
}

function flushPendingTaskNavigation(userRole?: string | null): void {
  if (!pendingTaskId || !navigationRef.isReady()) {
    return;
  }

  const taskId = pendingTaskId;
  pendingTaskId = null;

  if (userRole === 'supervisor') {
    navigationRef.navigate('Main', {
      screen: 'SupervisorTaskDetail',
      params: { taskId },
    } as never);
  } else {
    navigationRef.navigate('Main', {
      screen: 'InboxTab',
      params: {
        screen: 'TaskDetail',
        params: { taskId },
      },
    } as never);
  }
}

export { navigationRef, queueTaskNavigation, flushPendingTaskNavigation };
