export interface NewsItem {
  id: string;
  kind: 'article' | 'release' | 'developer';
  title: string;
  summary: string;
  date: string;
  imageUrl: string | null;
  link: string | null;
}

export interface NewsDraft {
  title: string;
  text: string;
  link: string | null;
}
