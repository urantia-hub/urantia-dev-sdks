import { afterEach, describe, expect, it } from "bun:test";
import { MeEndpoint } from "./endpoints/me.js";

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

// Records each address that the client asks for, and answers an empty list.
function capture(): string[] {
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return Response.json({ data: [], pagination: { page: 0, limit: 20, total: 0 }, syncedAt: "t", deleted: [] });
  }) as typeof fetch;
  return asked;
}

describe("since on the lists of a reader", () => {
  const me = new MeEndpoint("https://api.example", () => ({ Authorization: "Bearer t" }));

  it("sends since for bookmarks and for notes", async () => {
    const asked = capture();
    await me.bookmarks.list({ since: "2026-11-01T00:00:00.000Z" });
    await me.notes.list({ since: "2026-11-01T00:00:00.000Z", limit: 50 });
    expect(new URL(asked[0]!).searchParams.get("since")).toBe("2026-11-01T00:00:00.000Z");
    expect(new URL(asked[1]!).searchParams.get("since")).toBe("2026-11-01T00:00:00.000Z");
    expect(new URL(asked[1]!).searchParams.get("limit")).toBe("50");
  });

  it("sends no since when none is given", async () => {
    const asked = capture();
    await me.bookmarks.list();
    expect(asked[0]).toBe("https://api.example/me/bookmarks");
  });

  it("gives the sync fields of the answer", async () => {
    capture();
    const list = await me.notes.list({ since: "2026-11-01T00:00:00.000Z" });
    expect(list.syncedAt).toBe("t");
    expect(list.deleted).toEqual([]);
    expect(list.pagination.total).toBe(0);
  });
});
