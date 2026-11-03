export const MEDIA_SCHEME = 'comely-media';

export const MEDIA_THUMBNAIL_PARAM = 'thumb';

export function mediaThumbnailUrl(filePath: string, version: number): string {
  return `${MEDIA_SCHEME}://file/${encodeURIComponent(filePath)}?${MEDIA_THUMBNAIL_PARAM}=${version}`;
}

export function mediaUrl(filePath: string, version?: number): string {
  const suffix = version ? `?v=${version}` : '';
  return `${MEDIA_SCHEME}://file/${encodeURIComponent(filePath)}${suffix}`;
}
