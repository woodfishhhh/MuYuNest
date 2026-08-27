export interface TocItem {
  id: string;
  level: 2 | 3 | 4;
  text: string;
}

export interface PostSummary {
  canonicalSlug: string;
  aliases: string[];
  title: string;
  publishedAt: string;
  publishedLabel: string;
  excerpt: string;
  type: string;
  searchText: string;
  readingMinutes: number;
  coverImage?: string | null;
  categories: string[];
  tags: string[];
}

export interface PostArticle extends PostSummary {
  html: string;
  toc: TocItem[];
}

export interface AuthorProfileData {
  name: string;
  title: string;
  heroImage: string;
  postsCount: number;
  tagsCount: number;
  categoriesCount: number;
  skills: { title: string; color: string; img: string; officialUrl: string }[];
  poem: {
    title: string;
    author: string;
    lines: string[];
  };
  oneself: {
    location: string;
    birthDate: string;
    university: string;
    major: string;
  };
  tenyear: {
    tips: string;
    title: string;
    text: string;
    start: string;
    end: string;
  };
  contacts: {
    github: string;
    bilibili: string;
    qq: string;
    wechat: string;
    email: string;
    douyin: string;
  };
}

export interface FriendLinkData {
  name: string;
  link: string;
  avatar?: string;
  descr?: string;
  className?: string;
  offline?: boolean;
}

export interface WorkProjectData {
  slug: string;
  name: string;
  description: string;
  kind: string;
  avatarUrl: string;
  liveUrl: string;
  githubUrl: string;
}
