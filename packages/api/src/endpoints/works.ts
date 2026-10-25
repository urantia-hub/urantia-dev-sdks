import type {
  CatalogLanguage,
  WorkParallelsResponse,
  WorkReadResponse,
  WorksListResponse,
  WorksSearchParams,
  WorksSearchResponse,
  WorkUrantiaParallelsResponse,
} from "../types.js";

/** The Bible and the 21 texts of the world's religions, under one set of endpoints. A work id is "bible" or a text's slug. */
export class WorksEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List the works beside the Papers. Pass `{ lang: "es" }` for the Spanish titles, traditions, and summaries. */
  async list(options?: { lang?: CatalogLanguage }): Promise<WorksListResponse> {
    return this.get(`/works${langQuery(options?.lang)}`);
  }

  /**
   * Read a work by reference: a unit ("Dhp 21", "John 3:16") or a whole part ("Quran 2", "John 3").
   * A Bible reference takes the book name or code. Pass `{ lang: "es" }` for the Spanish work title;
   * the text stays English.
   */
  async read(work: string, ref: string, options?: { lang?: CatalogLanguage }): Promise<WorkReadResponse> {
    return this.get(`/works/${encodeURIComponent(work)}/${encodeURIComponent(ref)}${langQuery(options?.lang)}`);
  }

  /** The top 10 Urantia paragraphs for one unit of a work. */
  async urantiaParallels(work: string, ref: string): Promise<WorkUrantiaParallelsResponse> {
    return this.get(`/works/${encodeURIComponent(work)}/${encodeURIComponent(ref)}/urantia-parallels`);
  }

  /** The nearest passages of the other works for one unit of a work. */
  async workParallels(work: string, ref: string): Promise<WorkParallelsResponse> {
    return this.get(`/works/${encodeURIComponent(work)}/${encodeURIComponent(ref)}/work-parallels`);
  }

  /** Keyword search across the works, or in one work with `work`. */
  async search(params: WorksSearchParams | string): Promise<WorksSearchResponse> {
    return this.post("/works/search", params);
  }

  /** Search across the works by meaning. Each result has its nearest Urantia paragraphs. */
  async semanticSearch(params: WorksSearchParams | string): Promise<WorksSearchResponse> {
    return this.post("/works/search/semantic", params);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    if (!res.ok) throw await toError(res);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, params: WorksSearchParams | string): Promise<T> {
    const body: WorksSearchParams = typeof params === "string" ? { q: params } : params;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    return res.json() as Promise<T>;
  }
}

const langQuery = (lang?: CatalogLanguage) => (lang ? `?lang=${lang}` : "");

async function toError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail || body?.title || res.statusText;
  return new Error(`${res.status}: ${detail}`);
}
