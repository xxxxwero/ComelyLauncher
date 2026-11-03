import { useState } from 'react';
import type { ScreenProps } from '../../app/ScreenRouter';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useI18n } from '../../i18n/i18n';
import { isSessionActive, useGame } from '../../state/game-store';
import { useInstances, useSelectedInstance } from '../../state/instances-store';
import { cx } from '../../utils/cx';
import { CreateInstanceDialog, type CreateSource } from './CreateInstanceDialog';
import { InstanceCard } from './InstanceCard';
import styles from './InstancesScreen.module.css';

export function InstancesScreen(_props: ScreenProps) {
  const { t } = useI18n();
  const instances = useInstances();
  const selected = useSelectedInstance();
  const game = useGame();
  const [dialog, setDialog] = useState<CreateSource | null>(null);
  const busy = isSessionActive(game.session);

  return (
    <Screen
      title={t('instances.title')}
      subtitle={t('instances.subtitle')}
      actions={
        <>
          <Button icon="download" onClick={() => setDialog('file')}>
            {t('instances.import')}
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setDialog('blank')}>
            {t('instances.create')}
          </Button>
        </>
      }
    >
      <div className={cx(styles.grid, 'cl-stagger')}>
        {instances.map((instance) => (
          <InstanceCard key={instance.id} instance={instance} selected={instance.id === selected?.id} busy={busy} />
        ))}
        <button type="button" className={cx('cl-hover', styles.newCard)} onClick={() => setDialog('blank')}>
          <span className={styles.newIcon} aria-hidden="true">
            <Icon name="plus" size={22} strokeWidth={2.6} />
          </span>
          <span className={styles.newTitle}>{t('instances.newCard')}</span>
          <span className={styles.newHint}>{t('instances.newCardHint')}</span>
        </button>
      </div>
      {dialog && <CreateInstanceDialog initialSource={dialog} onClose={() => setDialog(null)} />}
    </Screen>
  );
}
