import type { ParagraphResponse, ParagraphContextResponse, SupportedLanguage } from "../types.js";

interface ParagraphOptions {
  include?: "entities";
  format?: "rag";
  lang?: SupportedLanguage;
}

export class ParagraphsEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get a paragraph by any reference format (globalId, standardReferenceId, or paperSectionParagraphId). */
  async get(ref: string, options?: ParagraphOptions): Promise<ParagraphResponse> {
    const params = buildParams(options);
    const res = await fetch(
      `${this.baseUrl}/paragraphs/${encodeURIComponent(ref)}${params}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get a random paragraph. Optionally filter by text length (character count). */
  async random(options?: ParagraphOptions & { minLength?: number; maxLength?: number }): Promise<ParagraphResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
    if (options?.format) params.set("format", options.format);
    if (options?.lang) params.set("lang", options.lang);
    if (options?.minLength != null) params.set("minLength", String(options.minLength));
    if (options?.maxLength != null) params.set("maxLength", String(options.maxLength));
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/paragraphs/random${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get a paragraph with surrounding context. */
  async context(
    ref: string,
    options?: ParagraphOptions & { window?: number }
  ): Promise<ParagraphContextResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
    if (options?.format) params.set("format", options.format);
    if (options?.window != null) params.set("window", String(options.window));
    if (options?.lang) params.set("lang", options.lang);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/paragraphs/${encodeURIComponent(ref)}/context${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }
}

function buildParams(options?: ParagraphOptions): string {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.include) params.set("include", options.include);
  if (options.format) params.set("format", options.format);
  if (options.lang) params.set("lang", options.lang);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function toError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail || body?.title || res.statusText;
  return new Error(`${res.status}: ${detail}`);
}
