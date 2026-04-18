import type { PapersListResponse, PaperDetailResponse } from "../types.js";

/**
 * `include` options supported by the papers endpoints.
 *
 * - `"entities"` — per-paragraph entity mentions (detail endpoint only).
 * - `"topEntities"` — paper-level aggregate of most-cited entities.
 * - `"entities,topEntities"` — both, detail endpoint only.
 */
export type PaperInclude =
  | "entities"
  | "topEntities"
  | "entities,topEntities";

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
   */
  async list(
    options?: { include?: PaperListInclude }
  ): Promise<PapersListResponse> {
    const params = new URLSearchParams();
    if (options?.include) params.set("include", options.include);
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
   */
  async get(
    id: string,
    options?: { include?: PaperInclude }
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
