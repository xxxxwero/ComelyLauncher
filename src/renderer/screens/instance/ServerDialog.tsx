import { useState } from 'react';
import type { ServerDraft } from '../../../shared/types/media';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/i18n';

interface ServerDialogProps {
  initial: ServerDraft | null;
  onSave: (draft: ServerDraft) => Promise<boolean>;
  onClose: () => void;
}

export function ServerDialog({ initial, onSave, onClose }: ServerDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    const saved = await onSave({ name: name.trim() || t('instance.serverNamePlaceholder'), address: address.trim() });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Modal
      title={initial ? t('instance.editServer') : t('instance.addServer')}
      width={460}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={busy} disabled={!address.trim()} onClick={() => void submit()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (address.trim()) void submit();
        }}
      >
        <Field label={t('instance.serverName')}>
          {(id) => <TextInput id={id} value={name} maxLength={64} placeholder={t('instance.serverNamePlaceholder')} onChange={(event) => setName(event.target.value)} autoFocus />}
        </Field>
        <Field label={t('instance.serverAddress')}>
          {(id) => <TextInput id={id} mono value={address} placeholder={t('instance.serverAddressPlaceholder')} onChange={(event) => setAddress(event.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
