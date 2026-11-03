import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../utils/cx';
import { Icon, type IconName } from './Icon';
import styles from './Menu.module.css';

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  active?: boolean;
  hint?: string;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | 'separator' | { heading: string };

interface TriggerProps {
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
}

interface MenuProps {
  entries: MenuEntry[];
  trigger: (props: TriggerProps) => ReactNode;
  width?: number;
  placement?: 'below' | 'above';
}

interface Position {
  left: number;
  top?: number;
  bottom?: number;
}

const GAP = 6;

export function Menu({ entries, trigger, width = 240, placement = 'below' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const estimated = entries.length * 40 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = placement === 'above' || spaceBelow < estimated + GAP;
    setPosition(above ? { left, bottom: window.innerHeight - rect.top + GAP } : { left, top: rect.bottom + GAP });
  }, [open, width, entries.length, placement]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!popover.current?.contains(target) && !anchor.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = (): void => setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <>
      <span ref={anchor} style={{ display: 'inline-flex' }}>
        {trigger({ onClick: () => setOpen((value) => !value), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      </span>
      {open &&
        position &&
        createPortal(
          <div ref={popover} role="menu" className={styles.popover} style={{ width, ...position }}>
            {entries.map((entry, index) => {
              if (entry === 'separator') return <div key={`sep-${index}`} className={styles.separator} aria-hidden="true" />;
              if ('heading' in entry) return <span key={`head-${index}`} className={styles.heading}>{entry.heading}</span>;
              return (
                <button
                  key={`${entry.label}-${index}`}
                  type="button"
                  role="menuitem"
                  className={cx(styles.item, entry.danger && styles.danger, entry.active && styles.itemActive)}
                  onClick={() => {
                    setOpen(false);
                    entry.onSelect();
                  }}
                >
                  {entry.icon && <Icon name={entry.icon} size={16} strokeWidth={2.2} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
                  {entry.hint && <span style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{entry.hint}</span>}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
