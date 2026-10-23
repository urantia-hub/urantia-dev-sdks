import type { SupportedLanguage, TocResponse } from "../types.js";

export class TocEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get the full table of contents (parts and papers). Pass `{ lang: "es" }` for Spanish titles. */
  async get(options?: { lang?: SupportedLanguage }): Promise<TocResponse> {
    const qs = options?.lang ? `?lang=${options.lang}` : "";
    const res = await fetch(`${this.baseUrl}/toc${qs}`, {
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
