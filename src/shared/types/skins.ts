export type SkinModel = 'classic' | 'slim';

export type SkinUploadMode = 'api' | 'external' | 'unavailable';

export interface CapeInfo {
  id: string;
  name: string;
  textureDataUrl: string | null;
  active: boolean;
}

export interface SkinProfile {
  accountId: string;
  skinDataUrl: string | null;
  model: SkinModel;
  capeDataUrl: string | null;
  capes: CapeInfo[];
  uploadMode: SkinUploadMode;
  canChangeCape: boolean;
}

export interface SkinLibraryEntry {
  id: string;
  name: string;
  model: SkinModel;
  dataUrl: string;
  addedAt: number;
}
