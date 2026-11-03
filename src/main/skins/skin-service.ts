import { shell } from 'electron';
import { LauncherError } from '../../shared/errors';
import type { CapeInfo, SkinLibraryEntry, SkinModel, SkinProfile } from '../../shared/types/skins';
import type { AccountService } from '../accounts/account-service';
import { fetchMinecraftProfile, MINECRAFT_PROFILE_URL, type MinecraftProfileResponse } from '../accounts/microsoft/microsoft-auth';
import { userDataPath } from '../core/app-paths';
import { readJsonFile, writeJsonFile } from '../core/file-system';
import { fetchJson, httpRequest, toDataUrl } from '../core/http';
import { createLogger } from '../core/logger';
import { SkinLibrary } from './skin-library';

const ELYBY_TEXTURES = 'http://skinsystem.ely.by/textures';
const ELYBY_SKINS_PAGE = 'https://ely.by/skins';

const log = createLogger('skins');

interface ElyTextures {
  SKIN?: { url: string; metadata?: { model?: string } };
  CAPE?: { url: string };
}

export class SkinService {
  private readonly library = new SkinLibrary();

  constructor(private readonly accounts: AccountService) {}

  listLibrary(): Promise<SkinLibraryEntry[]> {
    return this.library.list();
  }

  addToLibrary(file: string): Promise<SkinLibraryEntry> {
    return this.library.add(file);
  }

  removeFromLibrary(skinId: string): Promise<SkinLibraryEntry[]> {
    return this.library.remove(skinId);
  }

  setLibraryModel(skinId: string, model: SkinModel): Promise<SkinLibraryEntry[]> {
    return this.library.setModel(skinId, model);
  }

  async profile(accountId: string): Promise<SkinProfile> {
    const file = userDataPath('skin-profiles', `${accountId}.json`);
    try {
      const fresh = await this.fetchProfile(accountId);
      if (fresh.skinDataUrl) await writeJsonFile(file, fresh);
      if (fresh.skinDataUrl || fresh.uploadMode === 'unavailable') return fresh;
      const saved = await readJsonFile<SkinProfile | null>(file, null);
      return saved ? { ...fresh, skinDataUrl: saved.skinDataUrl, model: saved.model } : fresh;
    } catch (error) {
      const saved = await readJsonFile<SkinProfile | null>(file, null);
      if (!saved) throw error;
      log.warn('Could not refresh the skin, showing the saved one', error);
      return saved;
    }
  }

  private async fetchProfile(accountId: string): Promise<SkinProfile> {
    const account = this.accounts.find(accountId);
    if (account.type === 'microsoft') {
      const token = await this.accounts.minecraftAccessToken(accountId);
      return this.fromMinecraftProfile(accountId, await fetchMinecraftProfile(token));
    }
    if (account.type === 'elyby') {
      const textures = await fetchJson<ElyTextures>(`${ELYBY_TEXTURES}/${encodeURIComponent(account.username)}`).catch(() => ({} as ElyTextures));
      return {
        accountId,
        skinDataUrl: textures.SKIN ? await toDataUrl(textures.SKIN.url) : null,
        model: textures.SKIN?.metadata?.model === 'slim' ? 'slim' : 'classic',
        capeDataUrl: textures.CAPE ? await toDataUrl(textures.CAPE.url) : null,
        capes: [],
        uploadMode: 'external',
        canChangeCape: false
      };
    }
    return { accountId, skinDataUrl: null, model: 'classic', capeDataUrl: null, capes: [], uploadMode: 'unavailable', canChangeCape: false };
  }

  async apply(accountId: string, skinId: string): Promise<SkinProfile> {
    const account = this.accounts.find(accountId);
    if (account.type === 'elyby') {
      await shell.openExternal(ELYBY_SKINS_PAGE);
      return this.profile(accountId);
    }
    if (account.type !== 'microsoft') throw new LauncherError('skin-upload-failed', 'Skins can be uploaded only for Microsoft accounts');
    const { record, data } = await this.library.get(skinId);
    const token = await this.accounts.minecraftAccessToken(accountId);
    const form = new FormData();
    form.append('variant', record.model);
    form.append('file', new Blob([new Uint8Array(data)], { type: 'image/png' }), 'skin.png');
    const response = await httpRequest(`${MINECRAFT_PROFILE_URL}/skins`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      timeoutMs: 30000
    });
    if (!response.ok) throw new LauncherError('skin-upload-failed', `Skin upload failed (${response.status})`);
    return this.profile(accountId);
  }

  async setCape(accountId: string, capeId: string | null): Promise<SkinProfile> {
    const token = await this.accounts.minecraftAccessToken(accountId);
    const response = capeId
      ? await httpRequest(`${MINECRAFT_PROFILE_URL}/capes/active`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ capeId })
        })
      : await httpRequest(`${MINECRAFT_PROFILE_URL}/capes/active`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new LauncherError('skin-upload-failed', `Cape change failed (${response.status})`);
    return this.profile(accountId);
  }

  private async fromMinecraftProfile(accountId: string, profile: MinecraftProfileResponse): Promise<SkinProfile> {
    const skin = profile.skins?.find((entry) => entry.state === 'ACTIVE') ?? profile.skins?.[0];
    const capes: CapeInfo[] = await Promise.all(
      (profile.capes ?? []).map(async (cape) => ({
        id: cape.id,
        name: cape.alias,
        textureDataUrl: await toDataUrl(cape.url),
        active: cape.state === 'ACTIVE'
      }))
    );
    return {
      accountId,
      skinDataUrl: skin ? await toDataUrl(skin.url) : null,
      model: skin?.variant?.toLowerCase() === 'slim' ? 'slim' : 'classic',
      capeDataUrl: capes.find((cape) => cape.active)?.textureDataUrl ?? null,
      capes,
      uploadMode: 'api',
      canChangeCape: capes.length > 0
    };
  }
}
