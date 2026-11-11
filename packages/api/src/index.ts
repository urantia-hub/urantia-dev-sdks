export { UrantiaAPI } from "./client.js";
export { NoteConflictError } from "./endpoints/me.js";
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
  PaperDetail,
  TopEntity,
  PapersListResponse,
  PaperDetailResponse,
  // Paragraphs
  Paragraph,
  ParagraphInclude,
  ScriptureCorpusSummary,
  ScriptureParallel,
  ParagraphResponse,
  ParagraphContextResponse,
  // Editions
  EditionId,
  Edition,
  EditionMeta,
  Variant,
  EditionsResponse,
  VariantsResponse,
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
  TranslationLabel,
  CatalogLanguage,
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
  // Feedback
  FeedbackCategory,
  FeedbackParams,
  FeedbackResponse,
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
  // Works
  WorkKind,
  Work,
  WorksListResponse,
  WorkRef,
  WorkUrantiaParallel,
  WorkPassage,
  WorkReadResponse,
  WorkUrantiaParallelsResponse,
  WorkParallel,
  WorkParallelsResponse,
  WorksSearchParams,
  WorksSearchResponse,
  // Me (Authenticated)
  User,
  UserResponse,
  Bookmark,
  BookmarksListResponse,
  ListPagination,
  DeletedItem,
  SyncFields,
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
