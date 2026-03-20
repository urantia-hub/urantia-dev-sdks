import type { AudioResponse } from "../types.js";

export class AudioEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get audio URLs for a paragraph. */
  async get(ref: string): Promise<AudioResponse> {
    const res = await fetch(
      `${this.baseUrl}/audio/${encodeURIComponent(ref)}`,
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
