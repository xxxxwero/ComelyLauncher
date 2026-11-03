import { useCallback, useEffect, useState } from 'react';
import type { WorldInfo } from '../../shared/types/worlds';
import { invoke } from '../api/launcher-api';
import { showError } from '../state/toast-store';
import { useTasks } from '../state/tasks-store';

export interface InstanceWorlds {
  worlds: WorldInfo[];
  loading: boolean;
  reload: () => void;
  backupsRevision: string;
}

const WORLD_TASK_KINDS = new Set(['world-backup', 'world-restore']);

export function useInstanceWorlds(instanceId: string): InstanceWorlds {
  const tasks = useTasks();
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const backupsRevision = tasks
    .filter((task) => task.instanceId === instanceId && WORLD_TASK_KINDS.has(task.kind) && task.state !== 'running')
    .map((task) => task.id)
    .join();

  const reload = useCallback(() => {
    invoke('worlds:list', instanceId)
      .then(setWorlds)
      .catch(showError)
      .finally(() => setLoading(false));
  }, [instanceId]);

  useEffect(reload, [reload, backupsRevision]);

  return { worlds, loading, reload, backupsRevision };
}
