export { UrantiaAPI } from "./client.js";
export type { PaperInclude, PaperListInclude } from "./endpoints/papers.js";
export type {
  // Options
  UrantiaAPIOptions,
  // Common
  PaginationMeta,
  PaginationParams,
  ProblemDetail,
  // TOC
  TocPart,
  TocPaper,
  TocResponse,
  // Papers
  Paper,
  TopEntity,
  PapersListResponse,
  PaperDetailResponse,
  // Paragraphs
  Paragraph,
  ParagraphInclude,
  ParagraphResponse,
  ParagraphContextResponse,
  // Parallels (cross-references)
  BibleParallel,
  UrantiaParallel,
  // Entities
  EntityType,
  Entity,
  EntityMention,
  EntitiesListResponse,
  EntityDetailResponse,
  EntityParagraphsResponse,
  // Search
  SearchParams,
  SearchResult,
  SearchResponse,
  SemanticSearchParams,
  SemanticSearchResult,
  SemanticSearchResponse,
  // Languages
  SupportedLanguage,
  Language,
  LanguagesResponse,
  // Audio
  AudioResponse,
  // Citation
  CitationStyle,
  CitationResponse,
  // Embeddings
  EmbeddingModel,
  EmbeddingResponse,
  EmbeddingsExportResponse,
  // Bible
  BibleCanon,
  BibleBook,
  BibleVerse,
  BibleChapter,
  BibleBooksResponse,
  BibleBookResponse,
  BibleChapterResponse,
  BibleVerseResponse,
  BibleVerseUrantiaParallelsResponse,
  BibleSemanticSearchParams,
  BibleSemanticSearchResult,
  BibleSemanticSearchResponse,
  // Me (Authenticated)
  User,
  UserResponse,
  Bookmark,
  BookmarksListResponse,
  BookmarkCategory,
  BookmarkCategoriesResponse,
  Note,
  NotesListResponse,
  ReadingProgressEntry,
  ReadingProgressResponse,
  ReadingProgressMarkResponse,
  PreferencesResponse,
  // Auth
  AppInfo,
  AppInfoResponse,
} from "./types.js";
