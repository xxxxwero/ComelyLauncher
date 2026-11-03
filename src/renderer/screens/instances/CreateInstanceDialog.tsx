import { useCallback, useState } from 'react';
import { invoke } from '../../api/launcher-api';
import { CoverPicker } from '../../components/instances/CoverPicker';
import formStyles from '../../components/instances/InstanceForms.module.css';
import { VersionLoaderFields, type VersionLoaderValue } from '../../components/instances/VersionLoaderFields';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { Segmented } from '../../components/ui/Segmented';
import { isLoaderAvailable, useLoaderVersions } from '../../hooks/use-loader-versions';
import { useI18n } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { LOADER_NAMES } from '../../utils/loader-names';
import { ModrinthProfilesList } from './ModrinthProfilesList';

export type CreateSource = 'blank' | 'pack' | 'file';

interface CreateInstanceDialogProps {
  initialSource: CreateSource;
  onClose: () => void;
}

export function CreateInstanceDialog({ initialSource, onClose }: CreateInstanceDialogProps) {
  const { t } = useI18n();
  const [source, setSource] = useState<CreateSource>(initialSource);
  const [name, setName] = useState('');
  const [cover, setCover] = useState('s1');
  const [selection, setSelection] = useState<VersionLoaderValue>({ gameVersion: '', loader: { type: 'fabric', version: null } });
  const [busy, setBusy] = useState(false);
  const loaderState = useLoaderVersions(selection.loader.type, selection.gameVersion || null);
  const canCreate = Boolean(selection.gameVersion) && isLoaderAvailable(selection.loader.type, loaderState);
  const onSelection = useCallback((value: VersionLoaderValue) => setSelection(value), []);

  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      const fallbackName = selection.loader.type === 'vanilla' ? selection.gameVersion : `${selection.gameVersion} ${LOADER_NAMES[selection.loader.type]}`;
      const instance = await invoke('instances:create', { name: name.trim() || fallbackName, cover, gameVersion: selection.gameVersion, loader: selection.loader });
      showToast(t('instances.created', { name: instance.name }));
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (channel: 'instances:importModpack' | 'instances:importFolder'): Promise<void> => {
    try {
      const taskId = await invoke(channel);
      if (!taskId) return;
      showToast(t('instances.importStarted'), 'info');
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <Modal
      title={t('instances.dialogTitle')}
      width={580}
      onClose={onClose}
      footer={
        source === 'blank' && (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={busy} disabled={!canCreate} onClick={() => void create()}>
              {t('instances.createAction')}
            </Button>
          </>
        )
      }
    >
      <Segmented
        label={t('instances.dialogTitle')}
        value={source}
        onChange={setSource}
        options={[
          { value: 'blank', label: t('instances.sourceBlank') },
          { value: 'pack', label: t('instances.sourcePack') },
          { value: 'file', label: t('instances.sourceFile') }
        ]}
      />
      {source === 'blank' && (
        <>
          <Field label={t('instances.name')}>
            {(id) => <TextInput id={id} value={name} maxLength={48} placeholder={t('instances.namePlaceholder')} onChange={(event) => setName(event.target.value)} autoFocus />}
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('instances.cover')}</span>
            <CoverPicker value={cover} onChange={setCover} />
          </div>
          <VersionLoaderFields value={selection} onChange={onSelection} loaderState={loaderState} />
        </>
      )}
      {source === 'pack' && (
        <button
          type="button"
          className={cx('cl-hover', formStyles.optionCard)}
          onClick={() => {
            onClose();
            navigate('content', { type: 'modpack' });
          }}
        >
          <span className={formStyles.optionIcon} aria-hidden="true">
            <Icon name="search" size={20} strokeWidth={2.2} />
          </span>
          <span className={formStyles.optionText}>
            <span className={formStyles.optionTitle}>{t('instances.pickModpack')}</span>
            <span className={formStyles.optionHint}>{t('instances.pickModpackHint')}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2.4} color="rgba(255,255,255,0.7)" />
        </button>
      )}
      {source === 'file' && (
        <button type="button" className={cx('cl-hover', formStyles.optionCard, formStyles.optionDashed)} onClick={() => void runImport('instances:importModpack')}>
          <span className={cx(formStyles.optionIcon, formStyles.optionIconSolid)} aria-hidden="true">
            <Icon name="upload" size={20} strokeWidth={2.4} />
          </span>
          <span className={formStyles.optionText}>
            <span className={formStyles.optionTitle}>{t('instances.pickFile')}</span>
            <span className={formStyles.optionHint}>{t('instances.pickFileHint')}</span>
          </span>
        </button>
      )}
      {source === 'file' && (
        <button type="button" className={cx('cl-hover', formStyles.optionCard)} onClick={() => void runImport('instances:importFolder')}>
          <span className={formStyles.optionIcon} aria-hidden="true">
            <Icon name="folder" size={20} strokeWidth={2.2} />
          </span>
          <span className={formStyles.optionText}>
            <span className={formStyles.optionTitle}>{t('instances.pickFolder')}</span>
            <span className={formStyles.optionHint}>{t('instances.pickFolderHint')}</span>
          </span>
        </button>
      )}
      {source === 'file' && <ModrinthProfilesList onStarted={onClose} />}
    </Modal>
  );
}
