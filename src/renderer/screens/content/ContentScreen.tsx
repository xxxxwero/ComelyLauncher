import { useEffect, useRef, useState } from 'react';
import type { ContentProject, ContentProjectType, ContentSort } from '../../../shared/types/content';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { Checkbox, SearchBox, SelectInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Segmented } from '../../components/ui/Segmented';
import { useDebounced } from '../../hooks/use-debounced';
import { formatCompactNumber } from '../../i18n/format';
import { errorMessage, useI18n, type TranslationKey } from '../../i18n/i18n';
import { useInstances, useSelectedInstance } from '../../state/instances-store';
import { navigate } from '../../state/navigation-store';
import { useTasks } from '../../state/tasks-store';
import { showError, showToast } from '../../state/toast-store';
import { instanceVersionLabel } from '../../utils/loader-names';
import styles from './ContentScreen.module.css';

const TYPES: Array<{ value: ContentProjectType; label: TranslationKey; search: TranslationKey; page: string }> = [
  { value: 'mod', label: 'content.typeMod', search: 'content.searchMod', page: 'mod' },
  { value: 'modpack', label: 'content.typeModpack', search: 'content.searchModpack', page: 'modpack' },
  { value: 'resourcepack', label: 'content.typeResourcepack', search: 'content.searchResourcepack', page: 'resourcepack' },
  { value: 'shader', label: 'content.typeShader', search: 'content.searchShader', page: 'shader' }
];

const SORTS: Array<{ value: ContentSort; label: TranslationKey }> = [
  { value: 'relevance', label: 'content.sortRelevance' },
  { value: 'downloads', label: 'content.sortDownloads' },
  { value: 'newest', label: 'content.sortNewest' },
  { value: 'updated', label: 'content.sortUpdated' }
];

function isContentType(value: string | undefined): value is ContentProjectType {
  return TYPES.some((type) => type.value === value);
}

export function ContentScreen({ params }: ScreenProps) {
  const { t, plural, language } = useI18n();
  const instances = useInstances();
  const selectedInstance = useSelectedInstance();
  const tasks = useTasks();
  const [type, setType] = useState<ContentProjectType>(isContentType(params.type) ? params.type : 'mod');
  const [instanceId, setInstanceId] = useState<string | null>(params.instance ?? selectedInstance?.id ?? null);
  const [text, setText] = useState('');
  const [sort, setSort] = useState<ContentSort>('relevance');
  const [compatibleOnly, setCompatibleOnly] = useState(true);
  const [hits, setHits] = useState<ContentProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const query = useDebounced(text, 350);
  const requestId = useRef(0);
  const instance = instances.find((entry) => entry.id === instanceId) ?? null;
  const typeInfo = TYPES.find((entry) => entry.value === type) ?? TYPES[0];

  const search = async (offset: number): Promise<void> => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('content:search', { text: query, type, sort, instanceId, compatibleOnly, offset });
      if (id !== requestId.current) return;
      setHits((current) => (offset === 0 ? result.hits : [...current, ...result.hits]));
      setTotal(result.total);
    } catch (searchError) {
      if (id === requestId.current) setError(searchError);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    void search(0);
  }, [query, type, sort, instanceId, compatibleOnly]);

  useEffect(() => {
    const finished = Object.entries(pending).filter(([, taskId]) => tasks.some((task) => task.id === taskId && task.state === 'done'));
    if (finished.length > 0) setCompleted((current) => ({ ...current, ...Object.fromEntries(finished.map(([projectId]) => [projectId, true])) }));
  }, [tasks, pending]);

  const taskState = (projectId: string): 'running' | 'done' | null => {
    if (completed[projectId]) return 'done';
    const task = tasks.find((entry) => entry.id === pending[projectId]);
    return task?.state === 'running' ? 'running' : null;
  };

  const install = async (project: ContentProject): Promise<void> => {
    try {
      if (type === 'modpack') {
        const taskId = await invoke('content:installModpack', project.projectId);
        setPending((current) => ({ ...current, [project.projectId]: taskId }));
        showToast(t('content.modpackStarted', { name: project.title }), 'info');
        return;
      }
      if (!instance) {
        showToast(t('content.noInstance'), 'info');
        return;
      }
      const taskId = await invoke('content:install', instance.id, project.projectId, type);
      setPending((current) => ({ ...current, [project.projectId]: taskId }));
      showToast(t('content.installStarted', { name: project.title }), 'info');
    } catch (installError) {
      showError(installError);
    }
  };

  const vanillaWarning = type === 'mod' && instance?.loader.type === 'vanilla';

  return (
    <Screen
      title={t('content.title')}
      subtitle={t('content.subtitle')}
      gap={14}
      actions={
        <label className={styles.installTo}>
          <span className={styles.installToLabel}>{t('content.installTo')}</span>
          <SelectInput value={instanceId ?? ''} disabled={type === 'modpack'} onChange={(event) => setInstanceId(event.target.value || null)} style={{ height: 42, fontSize: 14 }}>
            {instances.length === 0 && <option value="">{t('content.noInstance')}</option>}
            {instances.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · {instanceVersionLabel(entry)}
              </option>
            ))}
          </SelectInput>
        </label>
      }
    >
      <div className={styles.controls}>
        <Segmented
          label={t('content.typeLabel')}
          value={type}
          onChange={(value) => {
            setType(value);
            setHits([]);
          }}
          options={TYPES.map((entry) => ({ value: entry.value, label: t(entry.label) }))}
        />
        <span style={{ flex: 1 }} />
        <span className={styles.source}>
          <span className={styles.sourceDot} aria-hidden="true" />
          {t('content.source')}
        </span>
      </div>
      <div className={styles.searchRow}>
        <SearchBox value={text} onChange={setText} placeholder={t(typeInfo.search)} label={t(typeInfo.search)} />
        <SelectInput aria-label={t('content.sortLabel')} value={sort} className={styles.sortSelect} onChange={(event) => setSort(event.target.value as ContentSort)}>
          {SORTS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {t(entry.label)}
            </option>
          ))}
        </SelectInput>
        {type !== 'modpack' && <Checkbox checked={compatibleOnly} onChange={setCompatibleOnly} label={t('content.compatibleOnly')} className={styles.compat} />}
      </div>
      {vanillaWarning && (
        <div className={styles.warning}>
          <Icon name="warning" size={20} color="var(--accent-soft)" />
          <span style={{ flex: 1 }}>{t('content.vanillaWarning')}</span>
          <Button size="sm" variant="light" onClick={() => navigate('instances')}>
            {t('nav.instances')}
          </Button>
        </div>
      )}
      <div className={styles.results}>
        {hits.map((project) => {
          const state = taskState(project.projectId);
          const installed = project.installed || state === 'done';
          return (
            <div key={project.projectId} className={styles.result}>
              {project.iconUrl ? (
                <img src={project.iconUrl} alt="" className={styles.icon} loading="lazy" />
              ) : (
                <span className={styles.icon} aria-hidden="true">
                  {project.title.charAt(0).toUpperCase()}
                </span>
              )}
              <span className={styles.resultText}>
                <span className={styles.titleRow}>
                  <button type="button" className={styles.title} onClick={() => void invoke('shell:openExternal', `https://modrinth.com/${typeInfo.page}/${project.slug}`)}>
                    {project.title}
                  </button>
                  <span className={styles.author}>{project.author}</span>
                </span>
                <span className={styles.description}>{project.description}</span>
                <span className={styles.tags}>
                  {project.categories.slice(0, 3).map((category) => (
                    <span key={category} className={styles.tag}>
                      {category}
                    </span>
                  ))}
                  <span className={styles.metaTag}>
                    <Icon name="download" size={12} strokeWidth={3} />
                    {t('content.downloads', { count: formatCompactNumber(project.downloads, language), unit: plural('downloads', project.downloads) })}
                  </span>
                  {instance && type !== 'modpack' && compatibleOnly && (
                    <span className={styles.metaTag}>
                      <Icon name="check" size={12} strokeWidth={3} />
                      {t('content.compatible', { version: instance.gameVersion })}
                    </span>
                  )}
                </span>
              </span>
              <Button
                variant={installed ? 'secondary' : 'primary'}
                icon={installed ? 'check' : type === 'modpack' ? 'plus' : 'download'}
                loading={state === 'running'}
                disabled={installed || (type !== 'modpack' && (!instance || vanillaWarning))}
                onClick={() => void install(project)}
              >
                {installed ? t('content.installed') : type === 'modpack' ? t('content.createInstance') : t('content.install')}
              </Button>
            </div>
          );
        })}
        {loading && (
          <div className={styles.center}>
            <Spinner size={28} />
          </div>
        )}
        {!loading && error !== null && (
          <div className={styles.center}>
            {t('content.loadError')}: {errorMessage(error)}
            <Button icon="refresh" onClick={() => void search(0)}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {!loading && error === null && hits.length === 0 && <div className={styles.center}>{t('content.empty')}</div>}
        {!loading && hits.length > 0 && hits.length < total && (
          <Button style={{ alignSelf: 'center', margin: '6px 0 10px' }} onClick={() => void search(hits.length)}>
            {t('content.loadMore')}
          </Button>
        )}
      </div>
    </Screen>
  );
}
