import type { LanguagesResponse } from "../types.js";

export class LanguagesEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List available languages with translation progress. */
  async list(): Promise<LanguagesResponse> {
    const res = await fetch(`${this.baseUrl}/languages`, {
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
