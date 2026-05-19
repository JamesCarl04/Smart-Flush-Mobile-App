import { apiFetch } from './api';

export async function acknowledgeTask(taskId: string): Promise<void> {
  const response = await apiFetch<{ taskId?: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/acknowledge`,
    { method: 'POST' },
  );

  if (!response.success) {
    throw new Error(response.error ?? 'Failed to acknowledge task.');
  }
}

export async function completeTask(taskId: string): Promise<void> {
  const response = await apiFetch<{ taskId?: string }>(
    `/api/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST' },
  );

  if (!response.success) {
    throw new Error(response.error ?? 'Failed to complete task.');
  }
}
