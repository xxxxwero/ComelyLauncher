import type { AccountSummary } from '../../../shared/types/accounts';
import { invoke } from '../../api/launcher-api';
import { AVATAR_PRESETS } from '../../assets/catalog';
import { Button } from '../../components/ui/Button';
import { Modal, modalStyles } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/i18n';
import { applyAccounts } from '../../state/accounts-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './AccountScreen.module.css';

export function AvatarDialog({ account, onClose }: { account: AccountSummary; onClose: () => void }) {
  const { t } = useI18n();
  const choose = (preset: number): void => {
    invoke('accounts:setAvatar', account.id, preset).then(applyAccounts).catch(showError);
  };
  return (
    <Modal title={t('account.avatarTitle')} width={560} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>{t('common.done')}</Button>}>
      <p className={modalStyles.text}>{t('account.avatarHint')}</p>
      <div className={styles.avatars}>
        {AVATAR_PRESETS.map((preset, index) => (
          <button
            key={preset.still}
            type="button"
            aria-pressed={account.avatarPreset === index}
            className={cx('cl-hover', styles.avatarTile, account.avatarPreset === index && styles.avatarTileActive)}
            onClick={() => choose(index)}
          >
            <img src={preset.still} alt="" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
