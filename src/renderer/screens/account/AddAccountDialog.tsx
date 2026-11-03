import { useState } from 'react';
import type { AccountType } from '../../../shared/types/accounts';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { formStyles, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { applyAccounts } from '../../state/accounts-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './AccountScreen.module.css';

const KINDS: Array<{ id: AccountType; label: TranslationKey; description: TranslationKey }> = [
  { id: 'microsoft', label: 'account.typeMicrosoft', description: 'account.kindMicrosoftDesc' },
  { id: 'elyby', label: 'account.typeElyby', description: 'account.kindElybyDesc' },
  { id: 'offline', label: 'account.typeOffline', description: 'account.kindOfflineDesc' }
];

interface AddAccountDialogProps {
  initialKind?: AccountType;
  initialLogin?: string;
  onClose: () => void;
}

export function AddAccountDialog({ initialKind = 'microsoft', initialLogin = '', onClose }: AddAccountDialogProps) {
  const { t } = useI18n();
  const [kind, setKind] = useState<AccountType>(initialKind);
  const [login, setLogin] = useState(initialLogin);
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = kind === 'microsoft' || (kind === 'elyby' ? login.trim() && password && (!needsTotp || totp.trim()) : /^[A-Za-z0-9_]{3,16}$/.test(nickname.trim()));

  const submit = async (): Promise<void> => {
    if (!valid) return;
    setBusy(true);
    try {
      if (kind === 'microsoft') {
        const state = await invoke('accounts:loginMicrosoft');
        applyAccounts(state);
        showToast(t('account.added', { name: state.accounts.find((account) => account.id === state.activeId)?.username ?? '' }));
        onClose();
      } else if (kind === 'elyby') {
        const result = await invoke('accounts:loginElyBy', { login, password, totp: needsTotp ? totp : undefined });
        if (result.status === 'two-factor-required') {
          setNeedsTotp(true);
          return;
        }
        applyAccounts(result.state);
        showToast(t('account.added', { name: result.state.accounts.find((account) => account.id === result.state.activeId)?.username ?? '' }));
        onClose();
      } else {
        const state = await invoke('accounts:addOffline', nickname);
        applyAccounts(state);
        showToast(t('account.added', { name: nickname.trim() }));
        onClose();
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('account.addTitle')}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void submit()}>
            {busy && kind === 'microsoft' ? t('account.signingIn') : kind === 'microsoft' ? t('account.signInMicrosoft') : t('account.addAction')}
          </Button>
        </>
      }
    >
      {KINDS.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={kind === entry.id}
          className={cx('cl-hover', styles.kind, kind === entry.id && styles.kindActive)}
          onClick={() => {
            setKind(entry.id);
            setNeedsTotp(false);
          }}
        >
          <span className={styles.kindText}>
            <span className={styles.kindTitle}>{t(entry.label)}</span>
            <span className={styles.kindDesc}>{t(entry.description)}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2.4} color="rgba(255,255,255,0.7)" />
        </button>
      ))}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {kind === 'elyby' && (
          <>
            <TextInput aria-label={t('account.elyLogin')} placeholder={t('account.elyLogin')} value={login} autoComplete="username" onChange={(event) => setLogin(event.target.value)} autoFocus />
            <TextInput type="password" aria-label={t('account.elyPassword')} placeholder={t('account.elyPassword')} value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
            {needsTotp && (
              <>
                <span className={formStyles.hint}>{t('account.elyTotpHint')}</span>
                <TextInput aria-label={t('account.elyTotp')} placeholder={t('account.elyTotp')} value={totp} inputMode="numeric" maxLength={8} onChange={(event) => setTotp(event.target.value)} autoFocus />
              </>
            )}
          </>
        )}
        {kind === 'offline' && (
          <TextInput aria-label={t('account.offlineNick')} placeholder={t('account.offlineNick')} value={nickname} maxLength={16} onChange={(event) => setNickname(event.target.value)} autoFocus />
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
