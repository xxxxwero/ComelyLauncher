import type { AccentMode, ParticleEffectChoice } from '../../../shared/types/settings';
import { resolveAccent } from '../../assets/catalog';
import { SelectInput, Field } from '../../components/ui/Field';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { updateSettings, useSettings } from '../../state/settings-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './SettingsScreen.module.css';

const SWATCHES = ['#F25C05', '#E0487A', '#2F8FE0', '#8B5CF6', '#22A06B', '#E0A82E', '#E0342F', '#13A5B8'];

const EFFECT_LABELS: Record<ParticleEffectChoice, TranslationKey> = {
  auto: 'settings.effectAuto',
  petals: 'settings.effectPetals',
  leaves: 'settings.effectLeaves',
  snow: 'settings.effectSnow',
  none: 'settings.effectNone'
};

export function AccentPicker() {
  const { t } = useI18n();
  const appearance = useSettings().appearance;
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch).catch(showError);
  const setMode = (accentMode: AccentMode) => save({ appearance: { accentMode } });
  const pick = (accentColor: string) => save({ appearance: { accentMode: 'custom', accentColor } });
  const fromBackground = appearance.accentMode === 'background';
  const shown = resolveAccent(appearance);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>{t('settings.accent')}</span>
          <span className={styles.accentPreview} style={{ background: shown }} aria-hidden="true" />
        </div>
        <div role="radiogroup" aria-label={t('settings.accent')} className={styles.accentModes}>
          <button type="button" role="radio" aria-checked={fromBackground} className={cx(styles.accentMode, fromBackground && styles.accentModeActive)} onClick={() => setMode('background')}>
            {t('settings.accentFromBackground')}
          </button>
          <button type="button" role="radio" aria-checked={!fromBackground} className={cx(styles.accentMode, !fromBackground && styles.accentModeActive)} onClick={() => setMode('custom')}>
            {t('settings.accentCustom')}
          </button>
        </div>
        {!fromBackground && (
          <div className={styles.swatches}>
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={appearance.accentColor.toLowerCase() === color.toLowerCase()}
                className={cx('cl-hover', styles.swatch, appearance.accentColor.toLowerCase() === color.toLowerCase() && styles.swatchActive)}
                style={{ background: color }}
                onClick={() => pick(color)}
              />
            ))}
            <label className={styles.swatchCustom} title={t('settings.accentAny')}>
              <input type="color" value={appearance.accentColor} aria-label={t('settings.accentAny')} onChange={(event) => pick(event.target.value)} />
              {t('settings.accentAny')}
            </label>
          </div>
        )}
      </div>
      <Field label={t('settings.effect')} hint={t('settings.effectHint')}>
        {(id) => (
          <SelectInput id={id} value={appearance.effect} onChange={(event) => save({ appearance: { effect: event.target.value as ParticleEffectChoice } })}>
            {(Object.keys(EFFECT_LABELS) as ParticleEffectChoice[]).map((effect) => (
              <option key={effect} value={effect}>
                {t(EFFECT_LABELS[effect])}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>
    </>
  );
}
