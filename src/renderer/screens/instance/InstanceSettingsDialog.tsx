import { useCallback, useState } from 'react';
import type { Instance } from '../../../shared/types/instances';
import { invoke } from '../../api/launcher-api';
import { CoverPicker } from '../../components/instances/CoverPicker';
import { VersionLoaderFields, type VersionLoaderValue } from '../../components/instances/VersionLoaderFields';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { ConfirmDialog, Modal, modalStyles } from '../../components/ui/Modal';
import { isLoaderAvailable, useLoaderVersions } from '../../hooks/use-loader-versions';
import { useI18n } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { showError, showToast } from '../../state/toast-store';
import styles from './InstanceScreen.module.css';

interface InstanceSettingsDialogProps {
  instance: Instance;
  onClose: () => void;
}

export function InstanceSettingsDialog({ instance, onClose }: InstanceSettingsDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState(instance.name);
  const [cover, setCover] = useState(instance.cover);
  const [selection, setSelection] = useState<VersionLoaderValue>({ gameVersion: instance.gameVersion, loader: instance.loader });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const loaderState = useLoaderVersions(selection.loader.type, selection.gameVersion);
  const onSelection = useCallback((value: VersionLoaderValue) => setSelection(value), []);
  const valid = name.trim().length > 0 && isLoaderAvailable(selection.loader.type, loaderState);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await invoke('instances:update', instance.id, { name, cover, gameVersion: selection.gameVersion, loader: selection.loader });
      showToast(t('instance.saved'));
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    try {
      await invoke('instances:remove', instance.id);
      showToast(t('instance.deleted'));
      onClose();
      navigate('instances');
    } catch (error) {
      showError(error);
    }
  };

  return (
    <>
      <Modal
        title={t('instance.settingsTitle')}
        width={580}
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('instances.name')}>{(id) => <TextInput id={id} value={name} maxLength={48} onChange={(event) => setName(event.target.value)} />}</Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('instances.cover')}</span>
          <CoverPicker value={cover} onChange={setCover} />
        </div>
        <VersionLoaderFields value={selection} onChange={onSelection} loaderState={loaderState} />
        <p className={modalStyles.text} style={{ fontSize: 12.5 }}>
          {t('instance.versionChangeHint')}
        </p>
        <div className={styles.dangerZone}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('instance.deleteText')}</span>
          <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>
            {t('instance.deleteInstance')}
          </Button>
        </div>
      </Modal>
      {confirmDelete && (
        <ConfirmDialog
          title={t('instance.deleteTitle', { name: instance.name })}
          text={t('instance.deleteText')}
          confirmLabel={t('common.delete')}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
