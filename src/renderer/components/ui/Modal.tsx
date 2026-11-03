import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/i18n';
import { Button, IconButton } from './Button';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  hideClose?: boolean;
}

export function Modal({ title, width = 480, onClose, children, footer, role = 'dialog', hideClose = false }: ModalProps) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role={role} aria-modal="true" aria-label={title} className={styles.dialog} style={{ width }}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {!hideClose && <IconButton icon="close" label={t('common.close')} variant="secondary" iconSize={15} onClick={onClose} />}
        </div>
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

interface ConfirmDialogProps {
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onCancel, busy }: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      title={title}
      width={420}
      role="alertdialog"
      hideClose
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{text}</p>
    </Modal>
  );
}

export const modalStyles = styles;
