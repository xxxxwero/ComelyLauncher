import type { TaskSnapshot } from '../../shared/types/tasks';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export const tasksStore = createStore<TaskSnapshot[]>([]);

export function useTasks(): TaskSnapshot[] {
  return useStore(tasksStore);
}

export function useTask(taskId: string | null): TaskSnapshot | null {
  const tasks = useTasks();
  return tasks.find((task) => task.id === taskId) ?? null;
}

export async function loadTasks(): Promise<void> {
  tasksStore.set(await invoke('tasks:list'));
}

export async function cancelTask(taskId: string): Promise<void> {
  await invoke('tasks:cancel', taskId);
}

export async function dismissTask(taskId: string): Promise<void> {
  tasksStore.set(await invoke('tasks:dismiss', taskId));
}
