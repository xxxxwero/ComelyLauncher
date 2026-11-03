import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../utils/cx';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'light' | 'danger' | 'soft' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  display?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  display = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : size === 'xl' ? 18 : 16;
  return (
    <button
      type={type}
      className={cx('cl-hover', styles.button, styles[size], styles[variant], fullWidth && styles.full, display && styles.display, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon && <Icon name={icon} size={iconSize} strokeWidth={2.4} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} strokeWidth={2.4} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: 'secondary' | 'ghost' | 'primary';
  size?: number;
  iconSize?: number;
  round?: boolean;
}

export function IconButton({ icon, label, variant = 'ghost', size = 40, iconSize = 17, round = false, className, style, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx('cl-hover', styles.iconButton, styles[variant], round && styles.round, className)}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} strokeWidth={2.3} />
    </button>
  );
}
