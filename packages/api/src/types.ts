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

// ─── Parallels (cross-references) ───

/**
 * One Bible chunk semantically related to a Urantia paragraph.
 * Returned inline on `?include=bibleParallels` and inside Bible-side
 * responses where appropriate.
 */
export interface BibleParallel {
  /** OSIS-style chunk id, e.g. "Gen.1.1-2". */
  chunkId: string;
  /** Display reference, e.g. "Genesis 1:1-2". */
  reference: string;
  /** OSIS book code, e.g. "Gen". */
  bookCode: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
  /** Cosine similarity, 0..1. */
  similarity: number;
  /** 1..10 within the source. */
  rank: number;
  /** Provenance label. "semantic" today; future curated layers (e.g. Faw's Paramony) would be tagged differently. */
  source: string;
  embeddingModel: string;
}

/**
 * One Urantia paragraph semantically related to either another UB paragraph
 * (via `?include=urantiaParallels`) or to a Bible chunk (via `/bible/.../urantia-parallels` or Bible search).
 */
export interface UrantiaParallel {
  id: string;
  standardReferenceId: string;
  paperId: string;
  paperTitle: string;
  sectionTitle: string | null;
  text: string;
  similarity: number;
  rank: number;
  source: string;
  embeddingModel: string;
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
  /** Present when the request includes `entities`. */
  entities?: EntityMention[];
  /** Present when the request includes `bibleParallels`. */
  bibleParallels?: BibleParallel[];
  /** Present when the request includes `urantiaParallels`. */
  urantiaParallels?: UrantiaParallel[];
}

/**
 * Comma-separated includes accepted on most paragraph endpoints. Pass as a
 * single string e.g. `"entities,urantiaParallels"`.
 */
export type ParagraphInclude =
  | "entities"
  | "bibleParallels"
  | "urantiaParallels";

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
  /** Comma-separated string of any combination of "entities", "bibleParallels", "urantiaParallels". */
  include?: string;
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
  /** Comma-separated string. Same accepted values as SearchParams.include. */
  include?: string;
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
    /** Paragraph globalId, e.g. "1:2.0.1". */
    id: string;
    audio: Record<string, unknown> | null;
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

export type EmbeddingModel = "small" | "large";

export interface EmbeddingResponse {
  data: {
    standardReferenceId: string;
    /** Underlying model id, e.g. "text-embedding-3-small". */
    model: string;
    /** Vector length, e.g. 1536 for small, 3072 for large. */
    dimensions: number;
    embedding: number[];
  };
}

export interface EmbeddingsExportResponse {
  data: { standardReferenceId: string; embedding: number[] }[];
  model: string;
  dimensions: number;
}

// ─── Bible ───

export type BibleCanon = "ot" | "deuterocanon" | "nt";

export interface BibleBook {
  bookCode: string;
  bookName: string;
  fullName: string;
  abbr: string;
  bookOrder: number;
  canon: BibleCanon;
  chapterCount: number;
  verseCount: number;
}

export interface BibleVerse {
  /** OSIS verse id, e.g. "Gen.1.1". */
  id: string;
  /** Display reference, e.g. "Genesis 1:1". */
  reference: string;
  bookCode: string;
  bookName: string;
  bookOrder: number;
  canon: BibleCanon;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}

export interface BibleChapter {
  bookCode: string;
  bookName: string;
  canon: BibleCanon;
  chapter: number;
  verses: BibleVerse[];
}

export interface BibleBooksResponse {
  data: BibleBook[];
}

export interface BibleBookResponse {
  data: BibleBook;
}

export interface BibleChapterResponse {
  data: BibleChapter;
}

export interface BibleVerseResponse {
  data: BibleVerse;
}

/** GET /bible/{bookCode}/{chapter}/{verse}/urantia-parallels */
export interface BibleVerseUrantiaParallelsResponse {
  data: {
    verse: BibleVerse;
    chunk: {
      id: string;
      reference: string;
      verseStart: number;
      verseEnd: number;
      text: string;
    };
    urantiaParallels: UrantiaParallel[];
  };
}

export interface BibleSemanticSearchParams {
  q: string;
  page?: number;
  limit?: number;
  canon?: BibleCanon;
  bookCode?: string;
  /** How many UB paragraphs to attach per chunk (0..10, default 3, set 0 to suppress). */
  urantiaParallelLimit?: number;
}

export interface BibleSemanticSearchResult {
  id: string;
  reference: string;
  bookCode: string;
  bookName: string;
  canon: BibleCanon;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
  similarity: number;
  urantiaParallels: UrantiaParallel[];
}

export interface BibleSemanticSearchResponse {
  data: BibleSemanticSearchResult[];
  meta: PaginationMeta;
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
