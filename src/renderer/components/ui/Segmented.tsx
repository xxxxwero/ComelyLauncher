import type { CSSProperties } from 'react';
import { cx } from '../../utils/cx';
import styles from './Form.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  style?: CSSProperties;
}

export function Segmented<T extends string>({ options, value, onChange, label, style }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={styles.segmented} style={style}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={cx('cl-hover', styles.segment, option.value === value && styles.segmentActive)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
