import type { UrantiaAPIOptions } from "./types.js";
import { PapersEndpoint } from "./endpoints/papers.js";
import { ParagraphsEndpoint } from "./endpoints/paragraphs.js";
import { SearchEndpoint } from "./endpoints/search.js";
import { EntitiesEndpoint } from "./endpoints/entities.js";
import { TocEndpoint } from "./endpoints/toc.js";
import { AudioEndpoint } from "./endpoints/audio.js";
import { CiteEndpoint } from "./endpoints/cite.js";
import { EmbeddingsEndpoint } from "./endpoints/embeddings.js";
import { MeEndpoint } from "./endpoints/me.js";

const DEFAULT_BASE_URL = "https://api.urantia.dev";

export class UrantiaAPI {
  private readonly baseUrl: string;
  private readonly token?: string;

  /** Table of contents (parts and papers). */
  readonly toc: TocEndpoint;
  /** Papers — list all or get one with paragraphs. */
  readonly papers: PapersEndpoint;
  /** Paragraphs — get by reference, random, or with context. */
  readonly paragraphs: ParagraphsEndpoint;
  /** Full-text and semantic search. */
  readonly search: SearchEndpoint;
  /** Named entities (beings, places, concepts, etc.). */
  readonly entities: EntitiesEndpoint;
  /** Audio URLs for paragraphs. */
  readonly audio: AudioEndpoint;
  /** Citation generation (APA, MLA, Chicago, BibTeX). */
  readonly cite: CiteEndpoint;
  /** Vector embeddings for paragraphs. */
  readonly embeddings: EmbeddingsEndpoint;
  /** Authenticated user endpoints (profile, bookmarks, notes, reading progress, preferences). Requires a token. */
  readonly me: MeEndpoint;

  constructor(options?: UrantiaAPIOptions) {
    this.baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.token = options?.token;

    const headers = (): HeadersInit => {
      const h: Record<string, string> = {};
      if (this.token) h["Authorization"] = `Bearer ${this.token}`;
      return h;
    };

    this.toc = new TocEndpoint(this.baseUrl, headers);
    this.papers = new PapersEndpoint(this.baseUrl, headers);
    this.paragraphs = new ParagraphsEndpoint(this.baseUrl, headers);
    this.search = new SearchEndpoint(this.baseUrl, headers);
    this.entities = new EntitiesEndpoint(this.baseUrl, headers);
    this.audio = new AudioEndpoint(this.baseUrl, headers);
    this.cite = new CiteEndpoint(this.baseUrl, headers);
    this.embeddings = new EmbeddingsEndpoint(this.baseUrl, headers);
    this.me = new MeEndpoint(this.baseUrl, headers);
  }
}
