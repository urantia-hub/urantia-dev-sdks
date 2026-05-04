import type {
  BibleBookResponse,
  BibleBooksResponse,
  BibleChapterResponse,
  BibleSemanticSearchParams,
  BibleSemanticSearchResponse,
  BibleVerseResponse,
  BibleVerseUrantiaParallelsResponse,
} from "../types.js";

export class BibleEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List all 81 books in the World English Bible (eng-web), with chapter/verse counts. */
  async books(): Promise<BibleBooksResponse> {
    const res = await fetch(`${this.baseUrl}/bible/books`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /**
   * Get a Bible book's metadata.
   * @param bookCode any OSIS code (`Gen`), USFM (`GEN`), full name (`Genesis`), or alias (`1-maccabees`).
   */
  async book(bookCode: string): Promise<BibleBookResponse> {
    const res = await fetch(
      `${this.baseUrl}/bible/${encodeURIComponent(bookCode)}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get all verses in a chapter. */
  async chapter(
    bookCode: string,
    chapter: number
  ): Promise<BibleChapterResponse> {
    const res = await fetch(
      `${this.baseUrl}/bible/${encodeURIComponent(bookCode)}/${chapter}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get a single verse. */
  async verse(
    bookCode: string,
    chapter: number,
    verse: number
  ): Promise<BibleVerseResponse> {
    const res = await fetch(
      `${this.baseUrl}/bible/${encodeURIComponent(bookCode)}/${chapter}/${verse}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /**
   * Get the top-10 Urantia paragraphs semantically nearest to the chunk
   * containing this Bible verse — pre-computed at seed time using
   * text-embedding-3-large cosine similarity.
   */
  async urantiaParallels(
    bookCode: string,
    chapter: number,
    verse: number
  ): Promise<BibleVerseUrantiaParallelsResponse> {
    const res = await fetch(
      `${this.baseUrl}/bible/${encodeURIComponent(bookCode)}/${chapter}/${verse}/urantia-parallels`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /**
   * Free-form natural-language search across the entire Bible. Each result
   * includes the top-N pre-computed Urantia paragraphs related to that chunk
   * (controlled by `urantiaParallelLimit`, default 3, max 10, 0 to suppress).
   */
  async semanticSearch(
    params: BibleSemanticSearchParams | string
  ): Promise<BibleSemanticSearchResponse> {
    const body: BibleSemanticSearchParams =
      typeof params === "string" ? { q: params } : params;
    const res = await fetch(`${this.baseUrl}/bible/search/semantic`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }
}

async function toError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail || body?.title || res.statusText;
  return new Error(`${res.status}: ${detail}`);
}
