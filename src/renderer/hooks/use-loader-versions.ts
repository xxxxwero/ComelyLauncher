import { useEffect, useState } from 'react';
import type { LoaderType } from '../../shared/types/instances';
import type { LoaderVersionEntry } from '../../shared/types/versions';
import { invoke } from '../api/launcher-api';

export type LoaderVersionsState =
  | { status: 'idle'; versions: LoaderVersionEntry[] }
  | { status: 'loading'; versions: LoaderVersionEntry[] }
  | { status: 'ready'; versions: LoaderVersionEntry[] }
  | { status: 'error'; versions: LoaderVersionEntry[]; error: unknown };

const cache = new Map<string, LoaderVersionEntry[]>();

export function useLoaderVersions(loader: LoaderType, gameVersion: string | null): LoaderVersionsState {
  const key = `${loader}|${gameVersion}`;
  const [state, setState] = useState<LoaderVersionsState>(() =>
    cache.has(key) ? { status: 'ready', versions: cache.get(key) ?? [] } : { status: 'idle', versions: [] }
  );

  useEffect(() => {
    if (loader === 'vanilla' || !gameVersion) {
      setState({ status: 'idle', versions: [] });
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setState({ status: 'ready', versions: cached });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading', versions: [] });
    invoke('versions:loaderVersions', loader, gameVersion)
      .then((versions) => {
        cache.set(key, versions);
        if (!cancelled) setState({ status: 'ready', versions });
      })
      .catch((error) => !cancelled && setState({ status: 'error', versions: [], error }));
    return () => {
      cancelled = true;
    };
  }, [key, loader, gameVersion]);

  return state;
}

export function isLoaderAvailable(loader: LoaderType, state: LoaderVersionsState): boolean {
  return loader === 'vanilla' || (state.status === 'ready' && state.versions.length > 0);
}
