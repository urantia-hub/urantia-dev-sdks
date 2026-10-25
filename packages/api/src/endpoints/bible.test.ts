import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { BibleEndpoint } from "./bible.js";

const BASE_URL = "https://api.urantia.dev";

let originalFetch: typeof fetch;
beforeEach(() => {
	originalFetch = globalThis.fetch;
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("BibleEndpoint.books", () => {
	it("asks the Spanish book names with lang, and English without it", async () => {
		const fetchMock = mock((_url: string) =>
			Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 })),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const bible = new BibleEndpoint(BASE_URL, () => ({}));
		await bible.books({ lang: "es" });
		await bible.books();
		expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/bible/books?lang=es`);
		expect(fetchMock.mock.calls[1]?.[0]).toBe(`${BASE_URL}/bible/books`);
	});
});
