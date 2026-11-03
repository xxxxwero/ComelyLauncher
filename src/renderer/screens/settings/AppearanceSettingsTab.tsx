import { mediaUrl } from '../../../shared/media-url';
import { invoke } from '../../api/launcher-api';
import { BACKGROUNDS } from '../../assets/catalog';
import { formStyles } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ToggleRow } from '../../components/ui/Toggle';
import { useDraft } from '../../hooks/use-draft';
import { useI18n } from '../../i18n/i18n';
import { settingsStore, updateSettings, useSettings } from '../../state/settings-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { AccentPicker } from './AccentPicker';
import styles from './SettingsScreen.module.css';

interface BackgroundTileProps {
  label: string;
  image: string;
  active: boolean;
  removeLabel?: string;
  onSelect: () => void;
  onRemove?: () => void;
}

function BackgroundTile({ label, image, active, removeLabel, onSelect, onRemove }: BackgroundTileProps) {
  return (
    <div className={styles.bgTileWrap}>
      <button type="button" role="radio" aria-checked={active} className={cx('cl-hover', styles.bgTile, active && styles.bgTileActive)} onClick={onSelect}>
        <img src={image} alt="" loading="lazy" decoding="async" className={styles.bgImage} />
        <span className={styles.bgName}>
          <span className={styles.bgLabel} title={label}>
            {label}
          </span>
          {active && (
            <span className={styles.check}>
              <Icon name="check" size={12} strokeWidth={4} color="#fff" />
            </span>
          )}
        </span>
      </button>
      {onRemove && removeLabel && (
        <button type="button" className={styles.bgRemove} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>
          <Icon name="close" size={12} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

export function AppearanceSettingsTab() {
  const { t } = useI18n();
  const settings = useSettings();
  const appearance = settings.appearance;
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch).catch(showError);
  const [dim, setDim] = useDraft(appearance.dimPercent, (dimPercent) => save({ appearance: { dimPercent } }), 250);
  const select = (background: string) => save({ appearance: { background } });

  const previewDim = (value: number): void => {
    setDim(value);
    const current = settingsStore.get();
    if (current) settingsStore.set({ ...current, appearance: { ...current.appearance, dimPercent: value } });
  };

  const addBackgrounds = async (): Promise<void> => {
    try {
      const updated = await invoke('settings:addBackgrounds');
      if (updated) settingsStore.set(updated);
    } catch (error) {
      showError(error);
    }
  };

  const removeBackground = (backgroundId: string): void => {
    invoke('settings:removeBackground', backgroundId).then(settingsStore.set).catch(showError);
  };

  return (
    <div className={styles.scroll}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{t('settings.background')}</span>
        <span className={formStyles.hint}>{t('settings.backgroundHint')}</span>
      </div>
      <div role="radiogroup" aria-label={t('settings.background')} className={styles.backgrounds}>
        {BACKGROUNDS.map((background) => (
          <BackgroundTile key={background.id} label={t(background.label)} image={background.thumb} active={appearance.background === background.id} onSelect={() => select(background.id)} />
        ))}
        {appearance.customBackgrounds.map((background) => (
          <BackgroundTile
            key={background.id}
            label={background.name || t('settings.bgCustom')}
            image={mediaUrl(background.thumbPath)}
            active={appearance.background === background.id}
            removeLabel={t('settings.bgRemove')}
            onSelect={() => select(background.id)}
            onRemove={() => removeBackground(background.id)}
          />
        ))}
        <button type="button" className={cx('cl-hover', styles.bgUpload)} onClick={() => void addBackgrounds()}>
          <span className={styles.bgUploadIcon} aria-hidden="true">
            <Icon name="upload" size={18} strokeWidth={2.4} />
          </span>
          <span className={styles.bgUploadTitle}>{t('settings.customBg')}</span>
          <span className={styles.bgUploadHint}>{t('settings.customBgHint')}</span>
        </button>
      </div>
      <AccentPicker />
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <label htmlFor="dim" className={styles.cardTitle}>
            {t('settings.dim')}
          </label>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-light)' }}>{dim}%</span>
        </div>
        <input id="dim" type="range" min={0} max={80} step={5} value={dim} className={formStyles.range} onChange={(event) => previewDim(Number(event.target.value))} />
      </div>
      <div className={styles.toggles}>
        <ToggleRow label={t('settings.blur')} checked={appearance.blurInnerScreens} onChange={(blurInnerScreens) => save({ appearance: { blurInnerScreens } })} />
        <ToggleRow label={t('settings.parallax')} checked={appearance.parallax} onChange={(parallax) => save({ appearance: { parallax } })} />
      </div>
    </div>
  );
}
