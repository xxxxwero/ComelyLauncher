import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from '../../utils/cx';
import { Icon } from './Icon';
import styles from './Form.module.css';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export function TextInput({ mono, className, ...rest }: TextInputProps) {
  return <input type="text" spellCheck={false} className={cx(styles.input, mono && styles.mono, className)} {...rest} />;
}

export function SelectInput({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(styles.input, styles.select, className)} {...rest}>
      {children}
    </select>
  );
}

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  width?: number;
  autoFocus?: boolean;
}

export function SearchBox({ value, onChange, placeholder, label, width, autoFocus }: SearchBoxProps) {
  return (
    <label className={styles.searchBox} style={width ? { width } : { flex: 1 }}>
      <Icon name="search" size={16} strokeWidth={2.2} />
      <span className="visually-hidden">{label}</span>
      <input
        type="text"
        spellCheck={false}
        className={styles.searchInput}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  className?: string;
}

export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <label className={cx(styles.checkbox, className)}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export const formStyles = styles;
