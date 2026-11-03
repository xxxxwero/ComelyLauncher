import { useEffect, useState } from 'react';
import type { SkinLibraryEntry, SkinModel } from '../../../shared/types/skins';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { avatarPreset } from '../../assets/catalog';
import { Panel, Screen } from '../../components/layout/Screen';
import { RenderedImage } from '../../components/skin/RenderedImage';
import { renderCape, renderFront } from '../../components/skin/skin-render';
import { LazySkinViewer } from '../../components/skin/LazySkinViewer';
import stageStyles from '../../components/skin/SkinStage.module.css';
import { SpriteViewer } from '../../components/skin/SpriteViewer';
import { Button, IconButton } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { Segmented } from '../../components/ui/Segmented';
import { useI18n } from '../../i18n/i18n';
import { useActiveAccount } from '../../state/accounts-store';
import { navigate } from '../../state/navigation-store';
import { loadSkinProfile, storeSkinProfile, useSkinProfile } from '../../state/skin-profiles-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './SkinsScreen.module.css';

const renderClassic = (source: string) => renderFront(source, false);
const renderSlim = (source: string) => renderFront(source, true);
const ACCOUNT_SKIN = 'account';

type LibraryTab = 'skins' | 'capes';

export function SkinsScreen(_props: ScreenProps) {
  const { t, count } = useI18n();
  const account = useActiveAccount();
  const online = Boolean(account && account.type !== 'offline');
  const profileEntry = useSkinProfile(account?.id ?? null, online);
  const profile = profileEntry?.status === 'ready' ? profileEntry.profile : null;
  const [library, setLibrary] = useState<SkinLibraryEntry[]>([]);
  const [selected, setSelected] = useState<string>(ACCOUNT_SKIN);
  const [tab, setTab] = useState<LibraryTab>('skins');
  const [autoRotate, setAutoRotate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    invoke('skins:library').then(setLibrary).catch(showError);
  }, []);

  const libraryEntry = library.find((entry) => entry.id === selected) ?? null;
  const previewSkin = libraryEntry?.dataUrl ?? profile?.skinDataUrl ?? null;
  const previewModel: SkinModel = libraryEntry?.model ?? profile?.model ?? 'classic';
  const activeCape = profile?.capes.find((cape) => cape.active) ?? null;

  const importSkin = async (): Promise<void> => {
    try {
      const entry = await invoke('skins:import');
      if (!entry) return;
      setLibrary((current) => [entry, ...current]);
      setSelected(entry.id);
      showToast(t('skins.added', { name: entry.name }));
    } catch (error) {
      showError(error);
    }
  };

  const apply = async (): Promise<void> => {
    if (!account || !libraryEntry) return;
    setBusy(true);
    try {
      const updated = await invoke('skins:apply', account.id, libraryEntry.id);
      storeSkinProfile(updated);
      if (account.type === 'microsoft') showToast(t('skins.applied', { name: account.username }));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const setModel = async (model: SkinModel): Promise<void> => {
    if (!libraryEntry) return;
    try {
      setLibrary(await invoke('skins:setModel', libraryEntry.id, model));
    } catch (error) {
      showError(error);
    }
  };

  const removeSkin = async (entry: SkinLibraryEntry): Promise<void> => {
    try {
      setLibrary(await invoke('skins:remove', entry.id));
      if (selected === entry.id) setSelected(ACCOUNT_SKIN);
    } catch (error) {
      showError(error);
    }
  };

  const setCape = async (capeId: string | null): Promise<void> => {
    if (!account) return;
    try {
      storeSkinProfile(await invoke('skins:setCape', account.id, capeId));
      showToast(t('skins.capeChanged'));
    } catch (error) {
      showError(error);
    }
  };

  const capeBadge = activeCape ? <span className={stageStyles.capeChip}>{t('skins.capeChip', { name: activeCape.name })}</span> : null;

  return (
    <Screen title={t('skins.title')} subtitle={t('skins.subtitle')}>
      <div className={styles.body}>
        <Panel className={styles.preview} label={t('skins.previewOf', { name: libraryEntry?.name ?? account?.username ?? '' })}>
          {previewSkin ? (
            <LazySkinViewer skin={previewSkin} model={previewModel} cape={profile?.capeDataUrl ?? null} autoRotate={autoRotate} onToggleAutoRotate={() => setAutoRotate((value) => !value)} badge={capeBadge} />
          ) : online && profileEntry?.status === 'loading' ? (
            <div className={stageStyles.stage}>
              <div className={stageStyles.placeholder}>
                <Spinner size={30} />
              </div>
            </div>
          ) : (
            <SpriteViewer sprite={avatarPreset(account?.avatarPreset ?? 0).sprite} width={240} autoRotate={autoRotate} />
          )}
          <span className={styles.previewName}>{libraryEntry?.name ?? (profile?.skinDataUrl ? t('skins.currentSkin') : account?.username ?? t('skins.defaultSkin'))}</span>
          {libraryEntry && (
            <Segmented
              label={t('skins.model')}
              value={libraryEntry.model}
              onChange={(model) => void setModel(model)}
              options={[
                { value: 'classic', label: 'Classic' },
                { value: 'slim', label: 'Slim' }
              ]}
            />
          )}
          {account?.type === 'elyby' ? (
            <Button variant="primary" size="lg" icon="external" onClick={() => void invoke('shell:openExternal', 'https://ely.by/skins')}>
              {t('skins.applyEly')}
            </Button>
          ) : libraryEntry ? (
            <Button variant="primary" size="lg" icon="upload" loading={busy} disabled={account?.type !== 'microsoft'} onClick={() => void apply()}>
              {t('skins.apply')}
            </Button>
          ) : null}
        </Panel>

        <Panel className={styles.library}>
          <button type="button" className={cx('cl-hover', styles.upload)} onClick={() => void importSkin()}>
            <span className={styles.uploadIcon} aria-hidden="true">
              <Icon name="upload" size={22} strokeWidth={2.4} />
            </span>
            <span className={styles.uploadText}>
              <span className={styles.uploadTitle}>{t('skins.uploadTitle')}</span>
              <span className={styles.uploadHint}>{t('skins.uploadHint')}</span>
            </span>
          </button>
          {account?.type !== 'microsoft' && (
            <div className={styles.notice}>
              <span className={styles.noticeIcon} aria-hidden="true">
                <Icon name="lock" size={18} strokeWidth={2.2} />
              </span>
              <span className={styles.uploadText}>
                <span className={styles.uploadTitle} style={{ fontSize: 14 }}>
                  {t('skins.uploadLockedTitle')}
                </span>
                <span className={styles.uploadHint}>{t('skins.uploadLockedHint')}</span>
              </span>
              {!account && (
                <Button variant="primary" size="sm" onClick={() => navigate('account', { add: '1' })}>
                  {t('skins.signIn')}
                </Button>
              )}
            </div>
          )}
          <div className={styles.tabsRow}>
            <Segmented
              label={t('skins.libraryLabel')}
              value={tab}
              onChange={setTab}
              options={[
                { value: 'skins', label: t('skins.tabSkins') },
                { value: 'capes', label: t('skins.tabCapes') }
              ]}
              style={{ flex: '0 0 auto' }}
            />
            <span className={styles.count}>{tab === 'skins' ? count('skins', library.length) : count('capes', profile?.capes.length ?? 0)}</span>
          </div>

          {tab === 'skins' && (
            <div className={cx(styles.grid, 'cl-stagger')}>
              {profile?.skinDataUrl && (
                <button type="button" aria-pressed={selected === ACCOUNT_SKIN} className={cx('cl-hover', styles.tile, selected === ACCOUNT_SKIN && styles.tileActive)} onClick={() => setSelected(ACCOUNT_SKIN)}>
                  <span className={styles.tileImage}>
                    <RenderedImage source={profile.skinDataUrl} render={profile.model === 'slim' ? renderSlim : renderClassic} className={styles.tileRender} />
                    <span className={styles.tileBadge}>{t('skins.active')}</span>
                  </span>
                  <span className={styles.tileName}>{t('skins.currentSkin')}</span>
                </button>
              )}
              {library.map((entry) => (
                <div key={entry.id} style={{ position: 'relative' }}>
                  <button type="button" aria-pressed={selected === entry.id} className={cx('cl-hover', styles.tile, selected === entry.id && styles.tileActive)} onClick={() => setSelected(entry.id)}>
                    <span className={styles.tileImage}>
                      <RenderedImage source={entry.dataUrl} render={entry.model === 'slim' ? renderSlim : renderClassic} className={styles.tileRender} />
                    </span>
                    <span className={styles.tileName}>{entry.name}</span>
                  </button>
                  <IconButton icon="trash" label={t('skins.removeSkin', { name: entry.name })} size={32} iconSize={14} className={styles.tileRemove} onClick={() => void removeSkin(entry)} />
                </div>
              ))}
              {library.length === 0 && !profile?.skinDataUrl && <div className={styles.emptyNote}>{t('skins.emptyLibrary')}</div>}
            </div>
          )}

          {tab === 'capes' && (
            <>
              {account?.type === 'microsoft' && profile ? (
                <div className={cx(styles.grid, 'cl-stagger')}>
                  <button type="button" aria-pressed={!activeCape} className={cx('cl-hover', styles.tile, !activeCape && styles.tileActive)} onClick={() => void setCape(null)}>
                    <span className={styles.tileImage}>
                      <span className={styles.noCape} aria-hidden="true" />
                      {!activeCape && <span className={styles.tileBadge}>{t('skins.worn')}</span>}
                    </span>
                    <span className={styles.tileName}>{t('skins.noCape')}</span>
                  </button>
                  {profile.capes.map((cape) => (
                    <button key={cape.id} type="button" aria-pressed={cape.active} className={cx('cl-hover', styles.tile, cape.active && styles.tileActive)} onClick={() => void setCape(cape.id)}>
                      <span className={styles.tileImage}>
                        <RenderedImage source={cape.textureDataUrl} render={renderCape} className={styles.capeRender} />
                        {cape.active && <span className={styles.tileBadge}>{t('skins.worn')}</span>}
                      </span>
                      <span className={styles.tileName}>{cape.name}</span>
                    </button>
                  ))}
                  {profile.capes.length === 0 && <div className={styles.emptyNote}>{t('skins.noCapes')}</div>}
                </div>
              ) : online && profileEntry?.status === 'error' ? (
                <div className={styles.emptyNote}>
                  {t('skins.profileError')}
                  <div style={{ marginTop: 12 }}>
                    <Button icon="refresh" onClick={() => account && void loadSkinProfile(account.id)}>
                      {t('common.retry')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyNote}>{t('account.capesOnlyMicrosoft')}</div>
              )}
              <span className={styles.hint}>{t('skins.capesHint')}</span>
            </>
          )}
        </Panel>
      </div>
    </Screen>
  );
}
