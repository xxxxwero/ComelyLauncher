import { createHash } from 'node:crypto';
import { nativeImage } from 'electron';
import fs from 'node:fs/promises';
import { mediaUrl } from '../../shared/media-url';
import type { NewsDraft, NewsItem } from '../../shared/types/news';
import { userDataPath } from '../core/app-paths';
import { pathExists, readJsonFile, writeFileAtomic, writeJsonFile } from '../core/file-system';
import { fetchBuffer, fetchJson } from '../core/http';
import { createLogger } from '../core/logger';
import type { SupportService } from '../support/support-service';

const CONTENT_ORIGIN = 'https://launchercontent.mojang.com';
const NEWS_URL = `${CONTENT_ORIGIN}/v2/news.json`;
const PATCH_NOTES_URL = `${CONTENT_ORIGIN}/v2/javaPatchNotes.json`;
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEVELOPER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_DEVELOPER_ITEMS = 5;
const DISK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ITEMS = 8;
const OFFICIAL_POOL_SIZE = 30;
const MAX_RELEASES = 2;
const REQUEST_TIMEOUT_MS = 15000;
const WEB_LINK = /^https?:\/\//i;
const IMAGE_WIDTH = 168;
const IMAGE_QUALITY = 80;

const log = createLogger('news');

interface FeedImage {
  url?: string;
}

interface NewsFeed {
  entries?: Array<{ id?: string; title?: string; text?: string; date?: string; readMoreLink?: string; newsType?: string[]; playPageImage?: FeedImage }>;
}

interface PatchNotesFeed {
  entries?: Array<{ id?: string; title?: string; type?: string; date?: string; image?: FeedImage }>;
}

interface DeveloperFeed {
  items: Array<{ id: string; title: string; text: string; link: string | null; createdAt: number }>;
  hiddenIds: string[];
}

function imageUrl(image: FeedImage | undefined): string | null {
  return image?.url?.startsWith('/') ? `${CONTENT_ORIGIN}${image.url}` : null;
}

function articles(feed: NewsFeed): NewsItem[] {
  return (feed.entries ?? [])
    .filter((entry) => entry.newsType?.includes('Java') && entry.id && entry.title && entry.date)
    .map((entry) => ({
      id: entry.id as string,
      kind: 'article' as const,
      title: entry.title as string,
      summary: entry.text ?? '',
      date: entry.date as string,
      imageUrl: imageUrl(entry.playPageImage),
      link: entry.readMoreLink && WEB_LINK.test(entry.readMoreLink) ? entry.readMoreLink : null
    }));
}

function releases(feed: PatchNotesFeed): NewsItem[] {
  return (feed.entries ?? [])
    .filter((entry) => entry.type === 'release' && entry.id && entry.title && entry.date)
    .sort((left, right) => (right.date as string).localeCompare(left.date as string))
    .slice(0, MAX_RELEASES)
    .map((entry) => ({ id: entry.id as string, kind: 'release' as const, title: entry.title as string, summary: '', date: entry.date as string, imageUrl: imageUrl(entry.image), link: null }));
}

export class NewsService {
  private readonly cacheFile = userDataPath('news-pool.json');
  private items: NewsItem[] | null = null;
  private loadedAt = 0;
  private readonly developerFile = userDataPath('developer-news.json');
  private developer: DeveloperFeed | null = null;
  private developerLoadedAt = 0;

  constructor(private readonly support: SupportService) {}

  async list(): Promise<NewsItem[]> {
    const [official, developer] = await Promise.all([this.officialNews(), this.developerFeed()]);
    const hidden = new Set(developer.hiddenIds);
    const own: NewsItem[] = developer.items.slice(0, MAX_DEVELOPER_ITEMS).map((item) => ({
      id: item.id,
      kind: 'developer',
      title: item.title,
      summary: item.text,
      date: new Date(item.createdAt).toISOString(),
      imageUrl: null,
      link: item.link
    }));
    const visible = official.filter((item) => !hidden.has(item.id)).slice(0, MAX_ITEMS);
    const withImages: NewsItem[] = [];
    for (const item of visible) withImages.push(await this.withLocalImage(item));
    return [...own, ...withImages].sort((left, right) => right.date.localeCompare(left.date));
  }

  async create(draft: NewsDraft): Promise<NewsItem[]> {
    await this.support.request('POST', '/news', draft);
    this.developerLoadedAt = 0;
    return this.list();
  }

  async remove(newsId: string, kind: NewsItem['kind']): Promise<NewsItem[]> {
    if (kind === 'developer') await this.support.request('POST', `/news/${encodeURIComponent(newsId)}/delete`, {});
    else await this.support.request('POST', '/news/hide', { id: newsId });
    this.developerLoadedAt = 0;
    return this.list();
  }

  private async developerFeed(): Promise<DeveloperFeed> {
    if (this.developer && Date.now() - this.developerLoadedAt < DEVELOPER_CACHE_TTL_MS) return this.developer;
    try {
      const feed = await this.support.fetchPublic<DeveloperFeed>('/news');
      this.developer = feed;
      this.developerLoadedAt = Date.now();
      await writeJsonFile(this.developerFile, feed);
      return feed;
    } catch (error) {
      log.warn('Could not load developer news', error);
      return this.developer ?? readJsonFile<DeveloperFeed>(this.developerFile, { items: [], hiddenIds: [] });
    }
  }

  private async officialNews(): Promise<NewsItem[]> {
    if (this.items && Date.now() - this.loadedAt < CACHE_TTL_MS) return this.items;
    const recent = await this.readRecentDiskCache();
    if (recent) return recent;
    try {
      const [news, notes] = await Promise.all([
        fetchJson<NewsFeed>(NEWS_URL, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 1 }),
        fetchJson<PatchNotesFeed>(PATCH_NOTES_URL, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 1 })
      ]);
      const items = [...articles(news), ...releases(notes)].sort((left, right) => right.date.localeCompare(left.date)).slice(0, OFFICIAL_POOL_SIZE);
      this.items = items;
      this.loadedAt = Date.now();
      await writeJsonFile(this.cacheFile, items);
      return items;
    } catch (error) {
      log.warn('Could not load news', error);
      return this.items ?? readJsonFile<NewsItem[]>(this.cacheFile, []);
    }
  }

  private async readRecentDiskCache(): Promise<NewsItem[] | null> {
    const stat = await fs.stat(this.cacheFile).catch(() => null);
    if (!stat || Date.now() - stat.mtimeMs > DISK_CACHE_TTL_MS) return null;
    const cached = await readJsonFile<NewsItem[]>(this.cacheFile, []);
    if (cached.length === 0) return null;
    this.items = cached;
    this.loadedAt = Date.now();
    return cached;
  }

  private async withLocalImage(item: NewsItem): Promise<NewsItem> {
    if (!item.imageUrl) return item;
    const name = createHash('sha1').update(item.imageUrl).digest('hex');
    const target = userDataPath('news-images', `${name}.jpg`);
    try {
      if (!(await pathExists(target))) {
        const image = nativeImage.createFromBuffer(await fetchBuffer(item.imageUrl, { timeoutMs: REQUEST_TIMEOUT_MS, retries: 1 }));
        if (image.isEmpty()) return { ...item, imageUrl: null };
        await writeFileAtomic(target, image.resize({ width: IMAGE_WIDTH, quality: 'good' }).toJPEG(IMAGE_QUALITY));
      }
      return { ...item, imageUrl: mediaUrl(target) };
    } catch {
      return { ...item, imageUrl: null };
    }
  }
}
