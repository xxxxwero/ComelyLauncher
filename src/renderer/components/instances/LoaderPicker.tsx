import { LOADER_TYPES, type LoaderType } from '../../../shared/types/instances';
import { useI18n } from '../../i18n/i18n';
import { cx } from '../../utils/cx';
import { LOADER_NAMES } from '../../utils/loader-names';
import styles from './InstanceForms.module.css';

interface LoaderPickerProps {
  value: LoaderType;
  onChange: (loader: LoaderType) => void;
  columns?: number;
}

export function LoaderPicker({ value, onChange, columns = 5 }: LoaderPickerProps) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t('instances.loader')} className={styles.loaders} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {LOADER_TYPES.map((loader) => (
        <button
          key={loader}
          type="button"
          aria-pressed={loader === value}
          className={cx('cl-hover', styles.loaderButton, loader === value && styles.loaderActive)}
          onClick={() => onChange(loader)}
        >
          {LOADER_NAMES[loader]}
        </button>
      ))}
    </div>
  );
}
