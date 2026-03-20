import type {
  SearchParams,
  SearchResponse,
  SemanticSearchParams,
  SemanticSearchResponse,
} from "../types.js";

export class SearchEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Full-text search across all paragraphs. */
  async fullText(params: SearchParams | string): Promise<SearchResponse> {
    const body: SearchParams =
      typeof params === "string" ? { q: params } : params;
    const res = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Semantic (vector) search across all paragraphs. */
  async semantic(
    params: SemanticSearchParams | string
  ): Promise<SemanticSearchResponse> {
    const body: SemanticSearchParams =
      typeof params === "string" ? { q: params } : params;
    const res = await fetch(`${this.baseUrl}/search/semantic`, {
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
