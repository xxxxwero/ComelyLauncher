import { recommendMemoryMb } from '../../../shared/memory-recommendation';
import { Button } from '../../components/ui/Button';
import { Field, TextInput, formStyles } from '../../components/ui/Field';
import { ToggleRow } from '../../components/ui/Toggle';
import { useDraft } from '../../hooks/use-draft';
import { formatGigabytes } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { useSelectedInstance } from '../../state/instances-store';
import { updateSettings, useSettings, useSystemInfo } from '../../state/settings-store';
import { showError } from '../../state/toast-store';
import styles from './SettingsScreen.module.css';

const MIN_MEMORY_MB = 1024;
const STEP_MB = 512;

function maxMemory(totalMb: number | undefined): number {
  if (!totalMb) return 16384;
  return Math.max(MIN_MEMORY_MB, Math.floor((totalMb - 1024) / STEP_MB) * STEP_MB);
}

export function GameSettingsTab() {
  const { t, count } = useI18n();
  const settings = useSettings();
  const info = useSystemInfo();
  const instance = useSelectedInstance();
  const max = maxMemory(info?.totalMemoryMb);
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch).catch(showError);
  const [memory, setMemory] = useDraft(settings.game.memoryMb, (memoryMb) => save({ game: { memoryMb } }), 300);
  const [width, setWidth] = useDraft(String(settings.game.windowWidth), (value) => save({ game: { windowWidth: Number(value) || 1280 } }), 700);
  const [height, setHeight] = useDraft(String(settings.game.windowHeight), (value) => save({ game: { windowHeight: Number(value) || 720 } }), 700);
  const advisedMemory = info && instance ? recommendMemoryMb(instance.contentCount, info.totalMemoryMb) : null;

  return (
    <div className={styles.scroll}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <label htmlFor="memory" className={styles.cardTitle}>
            {t('settings.memory')}
          </label>
          <span className={styles.memoryValue}>{t('common.gb', { value: formatGigabytes(memory) })}</span>
        </div>
        <input id="memory" type="range" min={MIN_MEMORY_MB} max={max} step={STEP_MB} value={Math.min(memory, max)} className={formStyles.range} onChange={(event) => setMemory(Number(event.target.value))} />
        <div className={styles.scale}>
          <span>{t('common.gb', { value: formatGigabytes(MIN_MEMORY_MB) })}</span>
          <span>{t('settings.memoryHint')}</span>
          <span>{t('common.gb', { value: formatGigabytes(max) })}</span>
        </div>
        {instance && advisedMemory !== null && (
          <div className={styles.memoryAdvice}>
            <span>
              {advisedMemory === memory
                ? t('settings.memoryAdviceSet', { name: instance.name, content: count('content', instance.contentCount) })
                : t('settings.memoryAdvice', { name: instance.name, content: count('content', instance.contentCount), value: formatGigabytes(advisedMemory) })}
            </span>
            {advisedMemory !== memory && (
              <Button size="sm" variant="soft" onClick={() => setMemory(advisedMemory)}>
                {t('settings.memoryAdviceApply', { value: formatGigabytes(advisedMemory) })}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className={styles.grid2}>
        <Field label={t('settings.windowWidth')}>
          {(id) => <TextInput id={id} inputMode="numeric" value={width} disabled={settings.game.fullscreen} onChange={(event) => setWidth(event.target.value.replace(/\D/g, ''))} />}
        </Field>
        <Field label={t('settings.windowHeight')}>
          {(id) => <TextInput id={id} inputMode="numeric" value={height} disabled={settings.game.fullscreen} onChange={(event) => setHeight(event.target.value.replace(/\D/g, ''))} />}
        </Field>
      </div>
      <div className={styles.toggles}>
        <ToggleRow label={t('settings.fullscreen')} checked={settings.game.fullscreen} onChange={(fullscreen) => save({ game: { fullscreen } })} />
        <ToggleRow label={t('settings.autoConnect')} checked={settings.game.autoConnectLastServer} onChange={(autoConnectLastServer) => save({ game: { autoConnectLastServer } })} />
      </div>
    </div>
  );
}
