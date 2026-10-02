import type { FeedbackParams, FeedbackResponse } from "../types.js";

export class FeedbackEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /**
   * Report a bug, a docs gap, or an idea. No authentication required.
   * Limited to 10 requests per 15 minutes per IP address.
   */
  async submit(params: FeedbackParams): Promise<FeedbackResponse> {
    const res = await fetch(`${this.baseUrl}/feedback`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
