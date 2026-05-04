import type {
  EmbeddingModel,
  EmbeddingResponse,
  EmbeddingsExportResponse,
} from "../types.js";

export class EmbeddingsEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /**
   * Get the embedding vector for a single paragraph.
   *
   * @param ref any paragraph reference (globalId, standardReferenceId, paperSectionParagraphId)
   * @param options.model `"small"` (1536-d, text-embedding-3-small) or `"large"` (3072-d, text-embedding-3-large). Default: `"large"`.
   */
  async get(
    ref: string,
    options?: { model?: EmbeddingModel }
  ): Promise<EmbeddingResponse> {
    const params = new URLSearchParams();
    if (options?.model) params.set("model", options.model);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/embeddings/${encodeURIComponent(ref)}${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /**
   * Bulk export all embeddings for a paper as JSON.
   * For JSONL format, fetch the URL directly with `fetch(...)`.
   */
  async exportPaper(
    paperId: string,
    options?: { model?: EmbeddingModel }
  ): Promise<EmbeddingsExportResponse> {
    const params = new URLSearchParams({ paperId, format: "json" });
    if (options?.model) params.set("model", options.model);
    const res = await fetch(`${this.baseUrl}/embeddings/export?${params}`, {
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
