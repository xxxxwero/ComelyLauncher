import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContentKind, InstalledContent, Instance } from '../../../shared/types/instances';
import { invoke } from '../../api/launcher-api';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState, Spinner } from '../../components/ui/Feedback';
import { SearchBox } from '../../components/ui/Field';
import { Menu, type MenuEntry } from '../../components/ui/Menu';
import { Segmented } from '../../components/ui/Segmented';
import { Toggle } from '../../components/ui/Toggle';
import { formatBytes } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { useTasks } from '../../state/tasks-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './InstanceScreen.module.css';

type KindFilter = 'all' | ContentKind;

function itemKey(item: InstalledContent): string {
  return `${item.kind}/${item.fileName}`;
}

export function ContentTab({ instance }: { instance: Instance }) {
  const { t, language } = useI18n();
  const tasks = useTasks();
  const [items, setItems] = useState<InstalledContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);

  const finishedTasks = tasks.filter((task) => task.instanceId === instance.id && task.state === 'done').length;

  const reload = useCallback(async () => {
    try {
      setItems(await invoke('instances:content', instance.id));
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }, [instance.id]);

  useEffect(() => {
    void reload();
  }, [reload, instance.contentCount, finishedTasks]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => (kind === 'all' || item.kind === kind) && (!query || item.title.toLowerCase().includes(query) || item.fileName.toLowerCase().includes(query)));
  }, [items, search, kind]);

  const updates = items.filter((item) => item.updateVersionId);
  const selectedItems = items.filter((item) => selected.has(itemKey(item)));
  const allSelected = visible.length > 0 && visible.every((item) => selected.has(itemKey(item)));

  const apply = async (action: Promise<InstalledContent[]>): Promise<void> => {
    try {
      setItems(await action);
    } catch (error) {
      showError(error);
    }
  };

  const setEnabled = async (targets: InstalledContent[], enabled: boolean): Promise<void> => {
    for (const group of groupByKind(targets)) {
      await apply(invoke('instances:setContentEnabled', instance.id, group.kind, group.fileNames, enabled));
    }
  };

  const remove = async (targets: InstalledContent[]): Promise<void> => {
    for (const group of groupByKind(targets)) {
      await apply(invoke('instances:removeContent', instance.id, group.kind, group.fileNames));
    }
    setSelected(new Set());
  };

  const checkUpdates = async (): Promise<void> => {
    setChecking(true);
    try {
      const result = await invoke('instances:checkUpdates', instance.id);
      setItems(result);
      const found = result.filter((item) => item.updateVersionId).length;
      showToast(found > 0 ? t('instance.updatesFound', { count: found }) : t('instance.noUpdates'), 'info');
    } catch (error) {
      showError(error);
    } finally {
      setChecking(false);
    }
  };

  const update = async (targets: InstalledContent[]): Promise<void> => {
    try {
      await invoke('instances:updateContent', instance.id, targets.map((item) => item.fileName));
      setItems((current) => current.map((item) => (targets.includes(item) ? { ...item, updateVersionId: null, updateVersionNumber: null } : item)));
    } catch (error) {
      showError(error);
    }
  };

  const toggleSelection = (item: InstalledContent): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemKey(item))) next.delete(itemKey(item));
      else next.add(itemKey(item));
      return next;
    });
  };

  const menuFor = (item: InstalledContent): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    if (item.pageUrl) entries.push({ label: t('instance.openPage'), icon: 'external', onSelect: () => void invoke('shell:openExternal', item.pageUrl as string) });
    entries.push(
      { label: t('instance.revealFile'), icon: 'folder', onSelect: () => void invoke('instances:revealContent', instance.id, item.kind, item.fileName).catch(showError) },
      { label: item.enabled ? t('instance.disable') : t('instance.enable'), icon: 'swap', onSelect: () => void setEnabled([item], !item.enabled) },
      'separator',
      { label: t('instance.removeFromInstance'), icon: 'trash', danger: true, onSelect: () => void remove([item]) }
    );
    return entries;
  };

  return (
    <div className={styles.tabBody}>
      <div className={styles.toolbar}>
        <SearchBox value={search} onChange={setSearch} placeholder={t('instance.searchContent')} label={t('instance.searchContent')} width={200} />
        <Segmented
          label={t('instance.kindAll')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: t('instance.kindAll') },
            { value: 'mod', label: t('instance.kindMod') },
            { value: 'resourcepack', label: t('instance.kindResourcepack') },
            { value: 'shaderpack', label: t('instance.kindShaderpack') }
          ]}
        />
        <span style={{ flex: 1 }} />
        {updates.length > 0 ? (
          <Button variant="soft" icon="download" onClick={() => void update(updates)}>
            {t('instance.updateAll', { count: updates.length })}
          </Button>
        ) : (
          <Button icon="refresh" loading={checking} disabled={items.length === 0} onClick={() => void checkUpdates()}>
            {checking ? t('instance.checking') : t('instance.checkUpdates')}
          </Button>
        )}
        <Button variant="primary" icon="plus" onClick={() => navigate('content', { instance: instance.id })}>
          {t('instance.addContent')}
        </Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={28} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="content"
          title={t('instance.contentEmpty')}
          text={t('instance.contentEmptyHint')}
          action={
            <Button variant="primary" icon="plus" onClick={() => navigate('content', { instance: instance.id })}>
              {t('instance.addContent')}
            </Button>
          }
        />
      ) : (
        <section aria-label={t('instance.tabContent')} className={styles.table}>
          <div className={styles.tableHead}>
            <input
              type="checkbox"
              aria-label={t('instance.selectAll')}
              className={styles.checkbox}
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(itemKey)))}
            />
            {selectedItems.length === 0 ? (
              <>
                <span style={{ flex: 1 }}>{t('instance.columnProject')}</span>
                <span style={{ width: 260 }}>{t('instance.columnVersion')}</span>
                <span style={{ width: 190, textAlign: 'right' }}>{t('instance.columnActions')}</span>
              </>
            ) : (
              <span style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', marginRight: 8 }}>{t('instance.selected', { count: selectedItems.length })}</span>
                <Button size="sm" onClick={() => void setEnabled(selectedItems, true)}>
                  {t('instance.enable')}
                </Button>
                <Button size="sm" onClick={() => void setEnabled(selectedItems, false)}>
                  {t('instance.disable')}
                </Button>
                <Button size="sm" variant="danger" onClick={() => void remove(selectedItems)}>
                  {t('instance.remove')}
                </Button>
              </span>
            )}
          </div>
          <div className={styles.tableBody}>
            {visible.map((item) => (
              <div key={itemKey(item)} className={cx(styles.row, !item.enabled && styles.rowDisabled, selected.has(itemKey(item)) && styles.rowSelected)}>
                <input type="checkbox" aria-label={t('instance.selectItem', { name: item.title })} className={styles.checkbox} checked={selected.has(itemKey(item))} onChange={() => toggleSelection(item)} />
                <span className={styles.project}>
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt="" className={styles.projectIcon} />
                  ) : (
                    <span className={styles.projectIcon} aria-hidden="true">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={styles.projectText}>
                    <span className={styles.projectName}>{item.title}</span>
                    <span className={styles.projectMeta}>
                      {formatBytes(item.sizeBytes, language)}
                      {item.kind !== 'mod' && <span className={styles.kindBadge}>{item.kind === 'resourcepack' ? t('instance.badgeResourcepack') : t('instance.badgeShaderpack')}</span>}
                    </span>
                  </span>
                </span>
                <span className={styles.version}>
                  <span className={styles.versionNumber}>{item.versionNumber ?? t('instance.manualFile')}</span>
                  <span className={styles.fileName}>{item.fileName}</span>
                </span>
                <span className={styles.rowActions}>
                  {item.updateVersionId && (
                    <IconButton icon="download" label={t('instance.update', { name: item.title })} className={styles.updateButton} onClick={() => void update([item])} />
                  )}
                  <Toggle checked={item.enabled} label={t('instance.toggleItem', { name: item.title })} onChange={(enabled) => void setEnabled([item], enabled)} />
                  <IconButton icon="trash" label={t('instance.remove')} onClick={() => void remove([item])} />
                  <Menu entries={menuFor(item)} trigger={(props) => <IconButton icon="more" label={t('instance.moreActions', { name: item.title })} size={36} {...props} />} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function groupByKind(items: InstalledContent[]): Array<{ kind: ContentKind; fileNames: string[] }> {
  const groups = new Map<ContentKind, string[]>();
  for (const item of items) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item.fileName]);
  return [...groups.entries()].map(([kind, fileNames]) => ({ kind, fileNames }));
}
