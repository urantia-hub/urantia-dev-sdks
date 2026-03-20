import type {
  UserResponse,
  BookmarksListResponse,
  BookmarkCategoriesResponse,
  Bookmark,
  NotesListResponse,
  Note,
  ReadingProgressResponse,
  ReadingProgressMarkResponse,
  PreferencesResponse,
  PaginationParams,
} from "../types.js";

export class MeEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {
    this.bookmarks = new BookmarksEndpoint(baseUrl, headers);
    this.notes = new NotesEndpoint(baseUrl, headers);
    this.readingProgress = new ReadingProgressEndpoint(baseUrl, headers);
    this.preferences = new PreferencesEndpoint(baseUrl, headers);
  }

  readonly bookmarks: BookmarksEndpoint;
  readonly notes: NotesEndpoint;
  readonly readingProgress: ReadingProgressEndpoint;
  readonly preferences: PreferencesEndpoint;

  /** Get the current user's profile. */
  async get(): Promise<UserResponse> {
    const res = await fetch(`${this.baseUrl}/me`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Update the current user's profile. */
  async update(data: {
    name?: string;
    avatarUrl?: string;
  }): Promise<UserResponse> {
    const res = await fetch(`${this.baseUrl}/me`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }
}

class BookmarksEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List bookmarks with optional filtering. */
  async list(
    options?: PaginationParams & { paperId?: string; category?: string }
  ): Promise<BookmarksListResponse> {
    const params = new URLSearchParams();
    if (options?.page != null) params.set("page", String(options.page));
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.paperId) params.set("paperId", options.paperId);
    if (options?.category) params.set("category", options.category);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/me/bookmarks${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** List bookmark categories. */
  async categories(): Promise<BookmarkCategoriesResponse> {
    const res = await fetch(`${this.baseUrl}/me/bookmarks/categories`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Create or update a bookmark. Idempotent — updates category if bookmark already exists. */
  async create(data: {
    ref: string;
    category?: string;
  }): Promise<{ data: Bookmark }> {
    const res = await fetch(`${this.baseUrl}/me/bookmarks`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Delete a bookmark by paragraph reference. */
  async delete(ref: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/me/bookmarks/${encodeURIComponent(ref)}`,
      { method: "DELETE", headers: this.headers() }
    );
    if (!res.ok && res.status !== 404) throw await toError(res);
  }
}

class NotesEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** List notes with optional filtering. */
  async list(
    options?: PaginationParams & { paperId?: string; ref?: string }
  ): Promise<NotesListResponse> {
    const params = new URLSearchParams();
    if (options?.page != null) params.set("page", String(options.page));
    if (options?.limit != null) params.set("limit", String(options.limit));
    if (options?.paperId) params.set("paperId", options.paperId);
    if (options?.ref) params.set("ref", options.ref);
    const qs = params.toString();
    const res = await fetch(
      `${this.baseUrl}/me/notes${qs ? `?${qs}` : ""}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Create a new note on a paragraph. */
  async create(data: {
    ref: string;
    text: string;
    format?: "plain" | "markdown";
  }): Promise<{ data: Note }> {
    const res = await fetch(`${this.baseUrl}/me/notes`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Update an existing note. */
  async update(
    id: string,
    data: { text?: string; format?: "plain" | "markdown" }
  ): Promise<{ data: Note }> {
    const res = await fetch(`${this.baseUrl}/me/notes/${id}`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Delete a note by ID. */
  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/me/notes/${id}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) throw await toError(res);
  }
}

class ReadingProgressEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get reading progress summary per paper. */
  async get(): Promise<ReadingProgressResponse> {
    const res = await fetch(`${this.baseUrl}/me/reading-progress`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Mark paragraphs as read. Idempotent. */
  async mark(refs: string[]): Promise<ReadingProgressMarkResponse> {
    const res = await fetch(`${this.baseUrl}/me/reading-progress`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ refs }),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Unmark a paragraph as read. Idempotent. */
  async unmark(ref: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/me/reading-progress/${encodeURIComponent(ref)}`,
      { method: "DELETE", headers: this.headers() }
    );
    if (!res.ok && res.status !== 204) throw await toError(res);
  }
}

class PreferencesEndpoint {
  constructor(
    private baseUrl: string,
    private headers: () => HeadersInit
  ) {}

  /** Get user preferences. */
  async get(): Promise<PreferencesResponse> {
    const res = await fetch(`${this.baseUrl}/me/preferences`, {
      headers: this.headers(),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  }

  /** Update user preferences (shallow merge). */
  async update(
    preferences: Record<string, unknown>
  ): Promise<PreferencesResponse> {
    const res = await fetch(`${this.baseUrl}/me/preferences`, {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
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
