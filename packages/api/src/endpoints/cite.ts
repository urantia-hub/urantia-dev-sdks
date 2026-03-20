import type { CitationStyle, CitationResponse } from "../types.js";

export class CiteEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Generate a formatted citation for a paragraph reference. */
  async get(
    ref: string,
    style: CitationStyle = "apa"
  ): Promise<CitationResponse> {
    const params = new URLSearchParams({ ref, style });
    const res = await fetch(`${this.baseUrl}/cite?${params}`, {
      headers: this.headers(),
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
