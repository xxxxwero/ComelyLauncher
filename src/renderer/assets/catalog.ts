import autumn from '../../../assets/backgrounds/autumn.jpg';
import sakura from '../../../assets/backgrounds/sakura.jpg';
import snow from '../../../assets/backgrounds/snow.jpg';
import autumnThumb from '../../../assets/backgrounds/thumbs/autumn_thumb.jpg';
import sakuraThumb from '../../../assets/backgrounds/thumbs/sakura_thumb.jpg';
import snowThumb from '../../../assets/backgrounds/thumbs/snow_thumb.jpg';
import icon256 from '../../../assets/icons/comelylauncher-icon-256.png';
import icon512 from '../../../assets/icons/comelylauncher-icon-512.png';
import screenshot1 from '../../../assets/screenshots/s1.jpg';
import screenshot2 from '../../../assets/screenshots/s2.jpg';
import screenshot3 from '../../../assets/screenshots/s3.jpg';
import screenshot4 from '../../../assets/screenshots/s4.jpg';
import screenshot5 from '../../../assets/screenshots/s5.jpg';
import screenshot6 from '../../../assets/screenshots/s6.jpg';
import playerHead from '../../../assets/skins/player-head.png';
import skin1 from '../../../assets/skins/skin-1.png';
import skin1Sprite from '../../../assets/skins/skin-1-rotation-sprite.png';
import skin2 from '../../../assets/skins/skin-2.png';
import skin2Sprite from '../../../assets/skins/skin-2-rotation-sprite.png';
import skin3 from '../../../assets/skins/skin-3.png';
import skin3Sprite from '../../../assets/skins/skin-3-rotation-sprite.png';
import skin4 from '../../../assets/skins/skin-4.png';
import skin4Sprite from '../../../assets/skins/skin-4-rotation-sprite.png';
import skin5 from '../../../assets/skins/skin-5.png';
import skin5Sprite from '../../../assets/skins/skin-5-rotation-sprite.png';
import skin6 from '../../../assets/skins/skin-6.png';
import skin6Sprite from '../../../assets/skins/skin-6-rotation-sprite.png';
import { mediaUrl } from '../../shared/media-url';
import type { AppearanceSettings, BackgroundPresetId, ParticleEffect } from '../../shared/types/settings';
import type { TranslationKey } from '../i18n/i18n';
import { DEFAULT_ACCENT } from '../theme/accent';

export const APP_ICON = icon256;
export const APP_ICON_LARGE = icon512;
export const DEFAULT_HEAD = playerHead;

export interface BackgroundPreset {
  id: BackgroundPresetId;
  label: TranslationKey;
  image: string;
  thumb: string;
  accent: string;
  effect: ParticleEffect;
}

export const BACKGROUNDS: BackgroundPreset[] = [
  { id: 'sakura', label: 'settings.bgSakura', image: sakura, thumb: sakuraThumb, accent: '#E0487A', effect: 'petals' },
  { id: 'autumn', label: 'settings.bgAutumn', image: autumn, thumb: autumnThumb, accent: '#F25C05', effect: 'leaves' },
  { id: 'snow', label: 'settings.bgSnow', image: snow, thumb: snowThumb, accent: '#2F8FE0', effect: 'snow' }
];

export function resolveBackground(appearance: AppearanceSettings): { image: string; thumb: string } {
  const custom = appearance.customBackgrounds.find((entry) => entry.id === appearance.background);
  if (custom) return { image: mediaUrl(custom.path), thumb: mediaUrl(custom.thumbPath) };
  return BACKGROUNDS.find((entry) => entry.id === appearance.background) ?? BACKGROUNDS[0];
}

export function resolveAccent(appearance: AppearanceSettings): string {
  if (appearance.accentMode === 'custom') return appearance.accentColor;
  const custom = appearance.customBackgrounds.find((entry) => entry.id === appearance.background);
  if (custom) return custom.accent ?? DEFAULT_ACCENT;
  return (BACKGROUNDS.find((entry) => entry.id === appearance.background) ?? BACKGROUNDS[0]).accent;
}

export function resolveEffect(appearance: AppearanceSettings): ParticleEffect | null {
  if (appearance.effect === 'none') return null;
  if (appearance.effect !== 'auto') return appearance.effect;
  return BACKGROUNDS.find((entry) => entry.id === appearance.background)?.effect ?? null;
}

const COVER_GLOWS: Record<string, string> = {
  s1: '251, 190, 130',
  s2: '253, 196, 132',
  s3: '190, 140, 100',
  s4: '248, 178, 120',
  s5: '251, 190, 130',
  s6: '252, 194, 132',
  sakura: '224, 72, 122',
  autumn: '242, 120, 40',
  snow: '130, 195, 240'
};

export function coverGlow(coverId: string): string {
  return COVER_GLOWS[coverId] ?? COVER_GLOWS.s1;
}

export const INSTANCE_COVERS: Record<string, string> = {
  s1: screenshot1,
  s2: screenshot2,
  s3: screenshot3,
  s4: screenshot4,
  s5: screenshot5,
  s6: screenshot6,
  sakura: sakuraThumb,
  autumn: autumnThumb,
  snow: snowThumb
};

export const COVER_IDS = Object.keys(INSTANCE_COVERS);

export function coverImage(coverId: string): string {
  return INSTANCE_COVERS[coverId] ?? screenshot1;
}

export interface AvatarPreset {
  still: string;
  sprite: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { still: skin1, sprite: skin1Sprite },
  { still: skin2, sprite: skin2Sprite },
  { still: skin3, sprite: skin3Sprite },
  { still: skin4, sprite: skin4Sprite },
  { still: skin5, sprite: skin5Sprite },
  { still: skin6, sprite: skin6Sprite }
];

export const SPRITE_FRAMES = 12;
export const SPRITE_FRAME_RATIO = 400 / 320;

export function avatarPreset(index: number): AvatarPreset {
  return AVATAR_PRESETS[Math.abs(index) % AVATAR_PRESETS.length];
}
