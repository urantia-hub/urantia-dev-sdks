import type { TocResponse } from "../types.js";

export class TocEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get the full table of contents (parts and papers). */
  async get(): Promise<TocResponse> {
    const res = await fetch(`${this.baseUrl}/toc`, {
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
