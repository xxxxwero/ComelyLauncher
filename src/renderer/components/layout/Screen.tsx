import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../utils/cx';
import styles from './Layout.module.css';

interface ScreenProps {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  gap?: number;
  before?: ReactNode;
}

export function Screen({ title, subtitle, actions, children, gap, before }: ScreenProps) {
  return (
    <section className={styles.screen} style={gap !== undefined ? { gap } : undefined}>
      {before}
      {title && (
        <header className={styles.screenHeader}>
          <div className={styles.screenTitles}>
            <h1 className={styles.screenTitle}>{title}</h1>
            {subtitle && <p className={styles.screenSubtitle}>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

interface PanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: 'section' | 'div' | 'aside' | 'nav';
  label?: string;
}

export function Panel({ children, className, style, as: Tag = 'section', label }: PanelProps) {
  return (
    <Tag aria-label={label} className={cx(styles.panel, className)} style={style}>
      {children}
    </Tag>
  );
}
