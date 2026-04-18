// ─── Languages ───

export type SupportedLanguage = "eng" | "es" | "fr" | "pt" | "de" | "ko";

export interface Language {
  code: string;
  name: string;
  entityCount: number;
  paragraphCount: number;
}

export interface LanguagesResponse {
  data: Language[];
}

// ─── Common ───

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
}

// ─── Table of Contents ───

export interface TocPaper {
  id: string;
  title: string;
  labels: string[];
}

export interface TocPart {
  id: string;
  title: string;
  sponsorship: string | null;
  papers: TocPaper[];
}

export interface TocResponse {
  data: {
    parts: TocPart[];
  };
}

// ─── Papers ───

export interface VideoVariant {
  mp4: string;
  thumbnail: string;
  duration: number;
}

export interface Paper {
  id: string;
  title: string;
  author: string;
  partId: string;
  partTitle: string;
  paragraphCount: number;
  video: Record<string, VideoVariant> | null;
  /**
   * Paper-level aggregate of the most-referenced named entities in this paper,
   * sorted by paragraph citation frequency and tier-ranked (beings/places/
   * concepts before orders/races/religions). Only present when the request
   * includes `topEntities` (alone or combined with `entities`).
   */
  topEntities?: TopEntity[];
}

export interface TopEntity extends EntityMention {
  /** Number of paragraphs in the paper that cite this entity. */
  count: number;
}

export interface PapersListResponse {
  data: Paper[];
}

export interface PaperDetailResponse {
  data: Paper & {
    paragraphs: Paragraph[];
  };
}

// ─── Paragraphs ───

export interface Paragraph {
  id: string;
  paperId: string;
  paperTitle: string;
  sectionId: string;
  sectionTitle: string | null;
  paragraphId: string;
  standardReferenceId: string;
  sortId: string;
  partId: string;
  text: string;
  htmlText: string;
  language?: string;
  labels: string[];
  audio: Record<string, unknown> | null;
  entities?: EntityMention[];
}

export interface ParagraphResponse {
  data: Paragraph;
}

export interface ParagraphContextResponse {
  data: {
    target: Paragraph;
    before: Paragraph[];
    after: Paragraph[];
  };
}

// ─── Entities ───

export type EntityType =
  | "being"
  | "place"
  | "order"
  | "race"
  | "religion"
  | "concept";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  description: string | null;
  aliases: string[] | null;
  seeAlso: string[] | null;
  citationCount: number;
  language?: string;
}

export interface EntityMention {
  id: string;
  name: string;
  type: EntityType;
}

export interface EntitiesListResponse {
  data: Entity[];
  meta: PaginationMeta;
}

export interface EntityDetailResponse {
  data: Entity;
}

export interface EntityParagraphsResponse {
  data: Paragraph[];
  meta: PaginationMeta;
}

// ─── Search ───

export interface SearchParams {
  q: string;
  type?: "and" | "or" | "phrase";
  page?: number;
  limit?: number;
  paperId?: string;
  partId?: string;
  include?: "entities";
}

/** Search results are flat paragraph objects with an additional `rank` field. */
export type SearchResult = Paragraph & {
  rank: number;
};

export interface SearchResponse {
  data: SearchResult[];
  meta: PaginationMeta;
}

export interface SemanticSearchParams {
  q: string;
  page?: number;
  limit?: number;
  paperId?: string;
  partId?: string;
  include?: "entities";
}

export type SemanticSearchResult = Paragraph & {
  similarity: number;
};

export interface SemanticSearchResponse {
  data: SemanticSearchResult[];
  meta: PaginationMeta;
}

// ─── Audio ───

export interface AudioResponse {
  data: {
    paragraphId: string;
    audio: Record<string, unknown>;
  };
}

// ─── Citation ───

export type CitationStyle = "apa" | "mla" | "chicago" | "bibtex";

export interface CitationResponse {
  data: {
    citation: string;
    style: CitationStyle;
    ref: string;
  };
}

// ─── Embeddings ───

export interface EmbeddingsResponse {
  data: {
    ref: string;
    embedding: number[];
  }[];
}

// ─── Me (Authenticated) ───

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface UserResponse {
  data: User;
}

export interface Bookmark {
  id: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  paragraph: Paragraph;
}

export interface BookmarksListResponse {
  data: Bookmark[];
  meta: PaginationMeta;
}

export interface BookmarkCategory {
  category: string | null;
  count: number;
  refs: string[];
}

export interface BookmarkCategoriesResponse {
  data: BookmarkCategory[];
}

export interface Note {
  id: string;
  text: string;
  format: "plain" | "markdown";
  createdAt: string;
  updatedAt: string;
  paragraph: Paragraph;
}

export interface NotesListResponse {
  data: Note[];
  meta: PaginationMeta;
}

export interface ReadingProgressEntry {
  paperId: string;
  paperTitle: string;
  readCount: number;
  totalParagraphs: number;
  percentage: number;
  readRefs: string[];
}

export interface ReadingProgressResponse {
  data: ReadingProgressEntry[];
}

export interface ReadingProgressMarkResponse {
  data: {
    marked: number;
    alreadyRead: number;
    total: number;
  };
}

export interface PreferencesResponse {
  data: Record<string, unknown>;
}

// ─── Auth (OAuth Apps) ───

export interface AppInfo {
  id: string;
  name: string;
  scopes: string[];
}

export interface AppInfoResponse {
  data: AppInfo;
}

// ─── Client Options ───

export interface UrantiaAPIOptions {
  /** Base URL for the API. Defaults to https://api.urantia.dev */
  baseUrl?: string;
  /** Bearer token for authenticated endpoints */
  token?: string;
}
