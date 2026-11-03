import { useCallback, useEffect, useState } from 'react';
import type { NewsItem } from '../../../shared/types/news';
import { invoke } from '../../api/launcher-api';
import { Button, IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ConfirmDialog, Modal, modalStyles } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { showError, showToast } from '../../state/toast-store';
import { NewsComposeDialog } from './NewsComposeDialog';
import styles from './HomeScreen.module.css';

export function NewsList() {
  const { t, language } = useI18n();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [composing, setComposing] = useState(false);
  const [reading, setReading] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState<NewsItem | null>(null);

  const load = useCallback(() => {
    invoke('news:list')
      .then(setItems)
      .catch((error: unknown) => {
        showError(error);
        setItems([]);
      });
  }, []);

  useEffect(() => {
    load();
    invoke('news:canManage').then(setCanManage).catch(() => setCanManage(false));
  }, [load]);

  const open = (item: NewsItem): void => {
    if (item.kind === 'release') navigate('versions');
    else if (item.kind === 'developer') setReading(item);
    else if (item.link) invoke('shell:openExternal', item.link).catch(showError);
  };

  const remove = async (): Promise<void> => {
    if (!deleting) return;
    try {
      setItems(await invoke('news:delete', deleting.id, deleting.kind));
      showToast(t('home.newsDeleted'));
    } catch (error) {
      showError(error);
    }
    setDeleting(null);
  };

  const formatDate = (date: string): string => new Date(date).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      {canManage && (
        <Button size="sm" variant="soft" icon="plus" style={{ flexShrink: 0 }} onClick={() => setComposing(true)}>
          {t('home.newsCompose')}
        </Button>
      )}
      {!items && <div className={styles.serversEmpty}>{t('home.newsLoading')}</div>}
      {items?.length === 0 && <div className={styles.serversEmpty}>{t('home.newsEmpty')}</div>}
      {items && items.length > 0 && (
        <div className={styles.serverList}>
          {items.map((item) => (
            <div key={item.id} className={styles.newsItem}>
              <button type="button" className={styles.newsRow} title={item.summary || item.title} onClick={() => open(item)}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className={styles.newsImage} />
                ) : (
                  <span className={styles.newsPlaceholder} aria-hidden="true">
                    <Icon name="support" size={22} color="var(--accent-soft)" />
                  </span>
                )}
                <span className={styles.newsText}>
                  <span className={styles.newsTitle}>{item.title}</span>
                  <span className={styles.newsMeta}>
                    {item.kind === 'release' && <span className={styles.onlineText}>{t('home.newsRelease')} · </span>}
                    {item.kind === 'developer' && <span className={styles.onlineText}>{t('home.newsDeveloper')} · </span>}
                    {formatDate(item.date)}
                  </span>
                </span>
              </button>
              {canManage && <IconButton icon="trash" label={t('home.newsDelete')} size={28} iconSize={13} className={styles.newsDelete} onClick={() => setDeleting(item)} />}
            </div>
          ))}
        </div>
      )}
      {composing && (
        <NewsComposeDialog
          onClose={() => setComposing(false)}
          onCreated={(next) => {
            setItems(next);
            setComposing(false);
          }}
        />
      )}
      {reading && (
        <Modal
          title={reading.title}
          width={560}
          onClose={() => setReading(null)}
          footer={
            <>
              {reading.link && (
                <Button icon="external" onClick={() => reading.link && invoke('shell:openExternal', reading.link).catch(showError)}>
                  {t('home.newsOpenLink')}
                </Button>
              )}
              <Button onClick={() => setReading(null)}>{t('common.close')}</Button>
            </>
          }
        >
          <p className={modalStyles.text} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {reading.summary}
          </p>
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={t('home.newsDeleteTitle')}
          text={deleting.kind === 'developer' ? t('home.newsDeleteOwnText', { name: deleting.title }) : t('home.newsHideText', { name: deleting.title })}
          confirmLabel={t('common.delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
