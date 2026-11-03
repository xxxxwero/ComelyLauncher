import { useEffect, useState } from 'react';
import type { AccountSummary } from '../../../shared/types/accounts';
import { avatarPreset, DEFAULT_HEAD } from '../../assets/catalog';
import { useSkinProfile } from '../../state/skin-profiles-store';
import { renderFace } from './skin-render';

interface AccountAvatarProps {
  account: AccountSummary | null;
  size: number;
  radius?: number;
}

const HEAD_ZOOM = 2.8;

function PresetHead({ preset, size }: { preset: number; size: number }) {
  const width = size * HEAD_ZOOM;
  return (
    <img
      src={avatarPreset(preset).still}
      alt=""
      draggable={false}
      style={{ position: 'absolute', width, height: width * 1.25, maxWidth: 'none', left: -(0.49 * width - size / 2), top: -(0.18 * width * 1.25 - size / 2) }}
    />
  );
}

function OnlineHead({ account, size }: { account: AccountSummary; size: number }) {
  const entry = useSkinProfile(account.id);
  const [face, setFace] = useState<string | null>(null);
  const skin = entry?.status === 'ready' ? entry.profile.skinDataUrl : null;
  useEffect(() => {
    let cancelled = false;
    if (!skin) {
      setFace(null);
      return;
    }
    renderFace(skin, 64)
      .then((result) => !cancelled && setFace(result))
      .catch(() => !cancelled && setFace(null));
    return () => {
      cancelled = true;
    };
  }, [skin]);
  return <img src={face ?? DEFAULT_HEAD} alt="" draggable={false} style={{ width: size, height: size, imageRendering: face ? 'pixelated' : 'auto', objectFit: 'cover' }} />;
}

export function AccountAvatar({ account, size, radius = 9 }: AccountAvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{ position: 'relative', display: 'block', width: size, height: size, flexShrink: 0, overflow: 'hidden', borderRadius: radius, background: '#2A1D15' }}
    >
      {!account && <img src={DEFAULT_HEAD} alt="" style={{ width: size, height: size, objectFit: 'cover', opacity: 0.55 }} />}
      {account?.type === 'offline' && <PresetHead preset={account.avatarPreset} size={size} />}
      {account && account.type !== 'offline' && <OnlineHead account={account} size={size} />}
    </span>
  );
}
