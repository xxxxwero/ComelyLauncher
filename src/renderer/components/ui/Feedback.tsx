import type { ReactNode } from 'react';
import { useToasts } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { Icon, type IconName } from './Icon';
import styles from './Feedback.module.css';

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className={styles.toastHost} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx(styles.toast, toast.kind === 'error' && styles.toastError)}>
          <Icon name={toast.kind === 'error' ? 'warning' : 'check'} size={16} strokeWidth={3} color={toast.kind === 'error' ? '#D93A1E' : 'var(--accent)'} />
          {toast.text}
        </div>
      ))}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  label: string;
  height?: number;
  striped?: boolean;
}

export function ProgressBar({ value, label, height = 10, striped = false }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, value * 100));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} className={styles.progressTrack} style={{ height }}>
      <div className={cx(styles.progressBar, striped && styles.progressStriped)} style={{ width: `${percent}%` }} />
    </div>
  );
}

export interface StepItem {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done';
  note?: string | null;
}

export function StepList({ steps }: { steps: StepItem[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.id} className={styles.step}>
          <span aria-hidden="true" className={cx(styles.stepDot, step.state === 'done' && styles.stepDone, step.state === 'active' && styles.stepActive)}>
            {step.state === 'done' && <Icon name="check" size={12} strokeWidth={4} color="#fff" />}
          </span>
          <span className={cx(styles.stepLabel, step.state === 'active' && styles.stepLabelActive, step.state === 'done' && styles.stepLabelDone)}>{step.label}</span>
          {step.note && <span className={styles.stepNote}>{step.note}</span>}
        </li>
      ))}
    </ol>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span aria-hidden="true" className={styles.spinner} style={{ width: size, height: size }} />;
}

interface ChipProps {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'light' | 'danger';
}

export function Chip({ children, tone = 'default' }: ChipProps) {
  return (
    <span className={cx(styles.chip, tone === 'accent' && styles.chipAccent, tone === 'light' && styles.chipLight, tone === 'danger' && styles.chipDanger)}>
      {children}
    </span>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={38} strokeWidth={1.8} />
      </span>
      <h2 className={styles.emptyTitle}>{title}</h2>
      {text && <p className={styles.emptyText}>{text}</p>}
      {action}
    </div>
  );
}
