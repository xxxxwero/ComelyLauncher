import { COVER_IDS, coverImage } from '../../assets/catalog';
import { useI18n } from '../../i18n/i18n';
import { cx } from '../../utils/cx';
import styles from './InstanceForms.module.css';

interface CoverPickerProps {
  value: string;
  onChange: (cover: string) => void;
}

export function CoverPicker({ value, onChange }: CoverPickerProps) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('instances.cover')} className={styles.covers}>
      {COVER_IDS.map((cover, index) => (
        <button
          key={cover}
          type="button"
          role="radio"
          aria-checked={cover === value}
          aria-label={t('instances.coverAria', { index: index + 1 })}
          className={cx(styles.coverButton, cover === value && styles.coverActive)}
          onClick={() => onChange(cover)}
        >
          <img src={coverImage(cover)} alt="" />
        </button>
      ))}
    </div>
  );
}
