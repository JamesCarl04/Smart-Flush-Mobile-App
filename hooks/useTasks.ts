import { useContext } from 'react';

import { TasksContext } from '../contexts/TasksContext';
import type { TasksContextValue } from '../types';

export function useTasks(): TasksContextValue {
  const context = useContext(TasksContext);

  if (!context) {
    throw new Error('useTasks must be used within a TasksProvider.');
  }

  return context;
}
