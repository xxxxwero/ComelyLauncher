import { cx } from '../../utils/cx';
import styles from './Form.module.css';

interface ToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, label, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx(styles.toggleButton, checked && styles.toggleOn)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleTrack}>
        <span className={styles.toggleKnob} />
      </span>
    </button>
  );
}

export function ToggleRow({ checked, label, onChange, disabled }: ToggleProps) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <Toggle checked={checked} label={label} onChange={onChange} disabled={disabled} />
    </div>
  );
}
