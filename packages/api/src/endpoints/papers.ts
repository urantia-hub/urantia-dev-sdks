import type { PapersListResponse, PaperDetailResponse } from "../types.js";

export class PapersEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List all 197 papers with metadata. */
  async list(): Promise<PapersListResponse> {
    const res = await fetch(`${this.baseUrl}/papers`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get a paper with all its paragraphs. */
  async get(
    id: string,
    options?: { include?: "entities" }
  ): Promise<PaperDetailResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/papers/${id}${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }
}

async function toError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail || body?.title || res.statusText;
  return new Error(`${res.status}: ${detail}`);
}
