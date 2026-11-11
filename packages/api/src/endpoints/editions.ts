import type { EditionsResponse, VariantsResponse } from "../types.js";

export class EditionsEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List the editions of the English text, with the default and the count of changes. */
  async list(): Promise<EditionsResponse> {
    const res = await fetch(`${this.baseUrl}/editions`, { headers: this.headers() });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** List the changes to the text since 1955: all, or those of a paper, a paragraph, or a kind. */
  async variants(options?: {
    paper?: string | number;
    ref?: string;
    kind?: "text" | "format" | "printing";
  }): Promise<VariantsResponse> {
    const params = new URLSearchParams();
    if (options?.paper != null) params.set("paper", String(options.paper));
    if (options?.ref) params.set("ref", options.ref);
    if (options?.kind) params.set("kind", options.kind);
    const qs = params.toString();
    const res = await fetch(`${this.baseUrl}/editions/variants${qs ? `?${qs}` : ""}`, {
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
