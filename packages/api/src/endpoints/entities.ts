import type {
  EntityType,
  EntitiesListResponse,
  EntityDetailResponse,
  EntityParagraphsResponse,
  PaginationParams,
} from "../types.js";

export class EntitiesEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List entities with optional filtering. */
  async list(
    options?: PaginationParams & { type?: EntityType; q?: string }
  ): Promise<EntitiesListResponse> {
    const params = new URLSearchParams();
    if (options?.page != null) params.set("page", String(options.page));
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.type) params.set("type", options.type);
    if (options?.q) params.set("q", options.q);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/entities${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get a single entity by ID. */
  async get(id: string): Promise<EntityDetailResponse> {
    const res = await fetch(`${this.baseUrl}/entities/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Get paragraphs that mention an entity. */
  async paragraphs(
    id: string,
    options?: PaginationParams
  ): Promise<EntityParagraphsResponse> {
    const params = new URLSearchParams();
    if (options?.page != null) params.set("page", String(options.page));
    if (options?.limit != null) params.set("limit", String(options.limit));
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/entities/${id}/paragraphs${qs ? `?${qs}` : ""}`,
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
