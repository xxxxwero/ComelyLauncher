import { useEffect, useMemo, useState } from 'react';
import type { LoaderType } from '../../../shared/types/instances';
import type { MinecraftVersionEntry } from '../../../shared/types/versions';
import { playInstance } from '../../actions/play';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { resolveBackground } from '../../assets/catalog';
import { LoaderPicker } from '../../components/instances/LoaderPicker';
import { Panel, Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { SearchBox } from '../../components/ui/Field';
import { Segmented } from '../../components/ui/Segmented';
import { isLoaderAvailable, useLoaderVersions } from '../../hooks/use-loader-versions';
import { formatDate } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { isSessionActive, useGame } from '../../state/game-store';
import { useInstances } from '../../state/instances-store';
import { useSettings } from '../../state/settings-store';
import { useTasks } from '../../state/tasks-store';
import { showError, showToast } from '../../state/toast-store';
import { loadVersions, useVersions } from '../../state/versions-store';
import { cx } from '../../utils/cx';
import { LOADER_NAMES } from '../../utils/loader-names';
import styles from './VersionsScreen.module.css';

type Filter = 'all' | 'release' | 'snapshot' | 'old' | 'installed';

const PAGE = 120;

function matchesFilter(entry: MinecraftVersionEntry, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'installed') return entry.installed;
  if (filter === 'old') return entry.type === 'old_alpha' || entry.type === 'old_beta';
  return entry.type === filter;
}

function CubeGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l8.5 4.7L12 12 3.5 7.2z" fill="#FFFFFF" />
      <path d="M3.5 7.2L12 12v9.5l-8.5-4.8z" fill="#FFE1CB" />
      <path d="M20.5 7.2L12 12v9.5l8.5-4.8z" fill="var(--accent-light)" />
    </svg>
  );
}

export function VersionsScreen(_props: ScreenProps) {
  const { t, language } = useI18n();
  const versions = useVersions();
  const instances = useInstances();
  const tasks = useTasks();
  const game = useGame();
  const settings = useSettings();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loader, setLoader] = useState<LoaderType>('vanilla');
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadVersions();
  }, [instances]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return versions.entries.filter((entry) => matchesFilter(entry, filter) && (!query || entry.id.toLowerCase().includes(query)));
  }, [versions.entries, filter, search]);

  const selected = versions.entries.find((entry) => entry.id === selectedId) ?? visible[0] ?? null;
  const loaderState = useLoaderVersions(loader, selected?.id ?? null);
  const instance = selected ? instances.find((entry) => entry.gameVersion === selected.id && entry.loader.type === loader) ?? null : null;
  const installed = selected ? (loader === 'vanilla' ? selected.installed : Boolean(instance?.installedVersionId)) : false;
  const installing = instance ? tasks.find((task) => task.instanceId === instance.id && task.kind === 'game-install' && task.state === 'running') ?? null : null;
  const available = isLoaderAvailable(loader, loaderState);
  const heroImage = resolveBackground(settings.appearance).thumb;

  const act = async (): Promise<void> => {
    if (!selected) return;
    setBusy(true);
    try {
      const target = await invoke('instances:ensureForVersion', selected.id, loader);
      if (installed) await playInstance(target);
      else {
        await invoke('game:install', target.id);
        showToast(t('versions.installStarted', { name: target.name }), 'info');
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('versions.title')} subtitle={t('versions.subtitle')}>
      <div className={styles.body}>
        <Panel className={styles.listPanel}>
          <div className={styles.filters}>
            <Segmented
              label={t('versions.filterLabel')}
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setLimit(PAGE);
              }}
              options={[
                { value: 'all', label: t('versions.filterAll') },
                { value: 'release', label: t('versions.filterRelease') },
                { value: 'snapshot', label: t('versions.filterSnapshot') },
                { value: 'old', label: t('versions.filterOld') },
                { value: 'installed', label: t('versions.filterInstalled') }
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder={t('common.search')} label={t('versions.searchLabel')} />
          </div>
          <div className={styles.list}>
            {versions.loading && versions.entries.length === 0 && (
              <div className={styles.center}>
                <Spinner size={28} />
                {t('versions.loadingList')}
              </div>
            )}
            {!versions.loading && versions.error !== null && versions.entries.length === 0 && (
              <div className={styles.center}>
                {t('versions.loadError')}
                <Button icon="refresh" onClick={() => void loadVersions(true)}>
                  {t('common.retry')}
                </Button>
              </div>
            )}
            {versions.entries.length > 0 && visible.length === 0 && <div className={styles.center}>{t('versions.empty')}</div>}
            {visible.slice(0, limit).map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === selected?.id}
                className={cx(styles.row, entry.id === selected?.id && styles.rowActive)}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className={cx(styles.cube, entry.installed && styles.cubeInstalled)}>
                  <CubeGlyph />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{entry.id}</span>
                  <span className={styles.rowType}>
                    {t(`versionType.${entry.type}`)} · {formatDate(entry.releaseTime, language)}
                  </span>
                </span>
                <span className={cx(styles.status, entry.installed && styles.statusInstalled)}>{entry.installed ? t('versions.installed') : t('versions.notInstalled')}</span>
              </button>
            ))}
            {visible.length > limit && (
              <Button onClick={() => setLimit((value) => value + PAGE)} style={{ alignSelf: 'center', margin: '6px 0' }}>
                {t('common.more')}
              </Button>
            )}
          </div>
        </Panel>

        <Panel as="aside" className={styles.details}>
          <div className={styles.hero}>
            <img src={heroImage} alt="" aria-hidden="true" className={styles.heroImage} />
            <div className={styles.heroShade} aria-hidden="true" />
            <div className={styles.heroText}>
              <span className={styles.heroType}>{selected ? t(`versionType.${selected.type}`) : ''}</span>
              <span key={selected?.id} className={styles.heroName} style={{ animation: 'cl-rise 0.3s var(--ease-out) both' }}>
                {selected?.id ?? '—'}
              </span>
            </div>
          </div>
          <div className={styles.detailsBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className={styles.label}>{t('versions.loader')}</span>
              <LoaderPicker value={loader} onChange={setLoader} columns={3} />
            </div>
            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>{t('versions.instance')}</span>
                <span className={styles.factValue}>{instance?.name ?? `${selected?.id ?? ''} · ${LOADER_NAMES[loader]}`}</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>{t('versions.status')}</span>
                <span className={styles.factValue}>
                  {loaderState.status === 'loading'
                    ? t('versions.loaderChecking', { loader: LOADER_NAMES[loader] })
                    : !available
                      ? t('versions.loaderUnavailable', { loader: LOADER_NAMES[loader], version: selected?.id ?? '' })
                      : installing
                        ? `${Math.floor(installing.progress * 100)}%`
                        : installed
                          ? t('versions.installed')
                          : t('versions.notInstalled')}
                </span>
              </div>
              {selected && (
                <div className={styles.fact}>
                  <span className={styles.factLabel}>{t('versions.released')}</span>
                  <span className={styles.factValue}>{formatDate(selected.releaseTime, language)}</span>
                </div>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <Button
              variant="primary"
              size="xl"
              display
              icon={installed ? 'play' : 'download'}
              loading={busy || Boolean(installing)}
              disabled={!selected || !available || (installed && isSessionActive(game.session))}
              onClick={() => void act()}
            >
              {installed ? t('versions.play') : t('versions.install')}
            </Button>
            <Button disabled={!selected?.installed} icon="folder" onClick={() => selected && invoke('versions:openFolder', selected.id).catch(showError)}>
              {t('versions.openFolder')}
            </Button>
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
