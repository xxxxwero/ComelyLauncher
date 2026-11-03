import { useCallback, useEffect, useState } from 'react';
import type { ServerDraft, ServerEntry } from '../../shared/types/media';
import { invoke } from '../api/launcher-api';
import { showError } from '../state/toast-store';

export interface InstanceServers {
  servers: ServerEntry[];
  loading: boolean;
  reload: () => Promise<void>;
  save: (index: number | null, draft: ServerDraft) => Promise<boolean>;
  remove: (index: number) => Promise<void>;
}

export function useInstanceServers(instanceId: string | null): InstanceServers {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!instanceId) {
      setServers([]);
      return;
    }
    setLoading(true);
    try {
      setServers(await invoke('instances:servers', instanceId));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (index: number | null, draft: ServerDraft) => {
      if (!instanceId) return false;
      try {
        setServers(await invoke('instances:saveServer', instanceId, index, draft));
        return true;
      } catch (error) {
        showError(error);
        return false;
      }
    },
    [instanceId]
  );

  const remove = useCallback(
    async (index: number) => {
      if (!instanceId) return;
      try {
        setServers(await invoke('instances:removeServer', instanceId, index));
      } catch (error) {
        showError(error);
      }
    },
    [instanceId]
  );

  return { servers, loading, reload, save, remove };
}
