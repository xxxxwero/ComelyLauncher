import { useState } from 'react';
import type { AccountSummary, AccountType } from '../../../shared/types/accounts';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { avatarPreset } from '../../assets/catalog';
import { Panel, Screen } from '../../components/layout/Screen';
import { AccountAvatar } from '../../components/skin/AccountAvatar';
import { LazySkinViewer } from '../../components/skin/LazySkinViewer';
import stageStyles from '../../components/skin/SkinStage.module.css';
import { SpriteViewer } from '../../components/skin/SpriteViewer';
import { Button, IconButton } from '../../components/ui/Button';
import { Chip, EmptyState, Spinner } from '../../components/ui/Feedback';
import { Field, TextInput } from '../../components/ui/Field';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { applyAccounts, useAccounts, useActiveAccount } from '../../state/accounts-store';
import { navigate } from '../../state/navigation-store';
import { loadSkinProfile, useSkinProfile } from '../../state/skin-profiles-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { AddAccountDialog } from './AddAccountDialog';
import { AvatarDialog } from './AvatarDialog';
import styles from './AccountScreen.module.css';

const TYPE_LABELS: Record<AccountType, TranslationKey> = {
  microsoft: 'account.typeMicrosoft',
  elyby: 'account.typeElyby',
  offline: 'account.typeOffline'
};

const TYPE_HINTS: Record<AccountType, TranslationKey> = {
  microsoft: 'account.hintMicrosoft',
  elyby: 'account.hintElyby',
  offline: 'account.hintOffline'
};

function formatUuid(uuid: string): string {
  const raw = uuid.replace(/-/g, '');
  return raw.length === 32 ? `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}` : uuid;
}

function AccountPreview({ account }: { account: AccountSummary }) {
  const { t } = useI18n();
  const online = account.type !== 'offline';
  const entry = useSkinProfile(account.id, online);
  const profile = entry?.status === 'ready' ? entry.profile : null;
  const [autoRotate, setAutoRotate] = useState(false);
  if (online && entry?.status === 'loading') {
    return (
      <div className={stageStyles.stage}>
        <div className={stageStyles.placeholder}>
          <Spinner size={30} />
        </div>
      </div>
    );
  }
  if (profile?.skinDataUrl) {
    return <LazySkinViewer skin={profile.skinDataUrl} model={profile.model} cape={profile.capeDataUrl} autoRotate={autoRotate} onToggleAutoRotate={() => setAutoRotate((value) => !value)} />;
  }
  return (
    <>
      <SpriteViewer sprite={avatarPreset(account.avatarPreset).sprite} width={256} />
      {entry?.status === 'error' && (
        <Button size="sm" icon="refresh" onClick={() => void loadSkinProfile(account.id)}>
          {t('account.skinRetry')}
        </Button>
      )}
    </>
  );
}

export function AccountScreen({ params }: ScreenProps) {
  const { t } = useI18n();
  const accounts = useAccounts();
  const active = useActiveAccount();
  const [adding, setAdding] = useState<{ kind?: AccountType; login?: string } | null>(params.add === '1' ? {} : null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [removing, setRemoving] = useState<AccountSummary | null>(null);
  const [reauthBusy, setReauthBusy] = useState(false);

  const select = (account: AccountSummary): void => {
    invoke('accounts:select', account.id)
      .then((state) => {
        applyAccounts(state);
        showToast(t('account.switched', { name: account.username }));
      })
      .catch(showError);
  };

  const remove = async (): Promise<void> => {
    if (!removing) return;
    try {
      applyAccounts(await invoke('accounts:remove', removing.id));
      showToast(t('account.removed'));
    } catch (error) {
      showError(error);
    } finally {
      setRemoving(null);
    }
  };

  const reauth = async (account: AccountSummary): Promise<void> => {
    if (account.type === 'elyby') {
      setAdding({ kind: 'elyby', login: account.username });
      return;
    }
    setReauthBusy(true);
    try {
      applyAccounts(await invoke('accounts:loginMicrosoft'));
      showToast(t('account.refreshed'));
    } catch (error) {
      showError(error);
    } finally {
      setReauthBusy(false);
    }
  };

  return (
    <Screen title={t('account.title')} subtitle={t('account.subtitle')}>
      {!active ? (
        <EmptyState
          icon="account"
          title={t('account.noAccountTitle')}
          text={t('account.noAccountText')}
          action={
            <Button variant="primary" size="lg" icon="plus" onClick={() => setAdding({})}>
              {t('account.addTitle')}
            </Button>
          }
        />
      ) : (
        <div className={styles.body}>
          <Panel className={styles.preview} label={active.username}>
            <AccountPreview key={active.id} account={active} />
            <div className={styles.nameRow}>
              <span className={styles.name}>{active.username}</span>
              <Chip tone={active.needsReauth ? 'danger' : 'accent'}>{active.needsReauth ? t('account.needsReauth') : t(TYPE_LABELS[active.type])}</Chip>
            </div>
            <div className={styles.buttons}>
              <Button variant="primary" onClick={() => navigate('skins')}>
                {t('account.changeSkin')}
              </Button>
              {active.type === 'offline' ? (
                <Button onClick={() => setAvatarOpen(true)}>{t('account.avatar')}</Button>
              ) : active.type === 'microsoft' ? (
                <Button onClick={() => navigate('skins')}>{t('account.capes')}</Button>
              ) : (
                <Button icon="external" onClick={() => void invoke('shell:openExternal', 'https://ely.by')}>
                  Ely.by
                </Button>
              )}
            </div>
          </Panel>

          <Panel className={styles.details}>
            <div className={styles.fields}>
              <Field label={t('account.nickname')}>{(id) => <TextInput id={id} value={active.username} readOnly />}</Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('account.loginType')}</span>
                <div className={styles.loginType}>
                  <span className={styles.loginDot} aria-hidden="true" />
                  {t(TYPE_LABELS[active.type])}
                  <span className={styles.loginHint}>{t(TYPE_HINTS[active.type])}</span>
                </div>
              </div>
            </div>
            <div className={styles.uuid}>
              <span style={{ color: 'rgba(255,255,255,0.66)' }}>{t('account.uuid')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={styles.uuidValue}>{formatUuid(active.uuid)}</span>
                <IconButton
                  icon="copy"
                  label={t('account.copyUuid')}
                  size={34}
                  iconSize={15}
                  onClick={() => navigator.clipboard.writeText(formatUuid(active.uuid)).then(() => showToast(t('account.uuidCopied'))).catch(showError)}
                />
              </span>
            </div>
            <div className={styles.saved}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{t('account.savedAccounts')}</span>
              <div className={styles.savedList}>
                {accounts.accounts.map((account) => {
                  const isActive = account.id === accounts.activeId;
                  return (
                    <div key={account.id} className={cx(styles.accountRow, isActive && styles.accountRowActive)}>
                      <AccountAvatar account={account} size={40} radius={10} />
                      <span className={styles.accountText}>
                        <span className={styles.accountName}>{account.username}</span>
                        <span className={styles.accountType}>{t(TYPE_LABELS[account.type])}</span>
                      </span>
                      {account.needsReauth && (
                        <Button size="sm" variant="soft" loading={reauthBusy} onClick={() => void reauth(account)}>
                          {t('account.reauth')}
                        </Button>
                      )}
                      {isActive ? <Chip tone="light">{t('account.active')}</Chip> : <Button size="sm" style={{ height: 40 }} onClick={() => select(account)}>{t('account.use')}</Button>}
                      <IconButton icon="trash" label={t('account.removeAccount', { name: account.username })} onClick={() => setRemoving(account)} />
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="lg" style={{ flexShrink: 0 }} onClick={() => setAdding({})}>
                {t('account.add')}
              </Button>
            </div>
            <div className={styles.footer}>
              <Button onClick={() => setRemoving(active)}>{t('account.logout')}</Button>
            </div>
          </Panel>
        </div>
      )}
      {adding && <AddAccountDialog initialKind={adding.kind} initialLogin={adding.login} onClose={() => setAdding(null)} />}
      {avatarOpen && active && <AvatarDialog account={active} onClose={() => setAvatarOpen(false)} />}
      {removing && (
        <ConfirmDialog
          title={t('account.logoutTitle', { name: removing.username })}
          text={t('account.logoutText')}
          confirmLabel={t('account.logout')}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </Screen>
  );
}
