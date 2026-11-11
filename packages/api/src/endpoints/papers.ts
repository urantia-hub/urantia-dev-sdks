import type {
  EditionId,
  PapersListResponse,
  PaperDetailResponse,
  SupportedLanguage,
} from "../types.js";

/**
 * `include` options supported by the papers endpoints.
 *
 * - `"entities"` — per-paragraph entity mentions (detail endpoint only).
 * - `"topEntities"` — paper-level aggregate of most-cited entities.
 * - `"entities,topEntities"` — both, detail endpoint only.
 * - `"variants"` — the changes to each paragraph since 1955 (detail endpoint only). It combines
 *   with the others, such as `"entities,variants"`.
 */
export type PaperInclude =
  | "entities"
  | "topEntities"
  | "entities,topEntities"
  | "variants"
  | "entities,variants"
  | "topEntities,variants"
  | "entities,topEntities,variants";

/** `include` options for the list endpoint — only `topEntities` makes sense at list granularity. */
export type PaperListInclude = "topEntities";

export class PapersEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /**
   * List all 197 papers with metadata.
   *
   * Pass `{ include: "topEntities" }` to attach a per-paper aggregate of the
   * most-referenced named entities to each paper.
   *
   * Pass `{ lang: "es" }` for the Spanish titles.
   */
  async list(
    options?: { include?: PaperListInclude; lang?: SupportedLanguage }
  ): Promise<PapersListResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
    if (options?.lang) params.set("lang", options.lang);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/papers${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /**
   * Get a paper with all its paragraphs.
   *
   * Pass `{ include: "entities" }` for per-paragraph entity mentions
   * (implicitly also attaches paper-level `topEntities`).
   *
   * Pass `{ include: "topEntities" }` for only the paper-level aggregate,
   * without attaching per-paragraph mentions (lighter payload).
   *
   * Pass `{ include: "entities,topEntities" }` for both explicitly.
   *
   * Pass `{ lang: "es" }` for the Spanish title and paragraphs.
   *
   * Pass `{ edition: "1955" }` for the text of an older edition (English only).
   */
  async get(
    id: string,
    options?: {
      include?: PaperInclude;
      lang?: SupportedLanguage;
      edition?: EditionId | (string & {});
    }
  ): Promise<PaperDetailResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
    if (options?.lang) params.set("lang", options.lang);
    if (options?.edition) params.set("edition", options.edition);
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
