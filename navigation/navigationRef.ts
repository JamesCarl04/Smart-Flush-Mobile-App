import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingTaskId: string | null = null;

function queueTaskNavigation(taskId: string): void {
  pendingTaskId = taskId;
}

function flushPendingTaskNavigation(): void {
  if (!pendingTaskId || !navigationRef.isReady()) {
    return;
  }

  const taskId = pendingTaskId;
  pendingTaskId = null;

  navigationRef.navigate('Main', {
    screen: 'TaskTab',
    params: {
      taskId,
    },
  });
}

export { navigationRef, queueTaskNavigation, flushPendingTaskNavigation };
