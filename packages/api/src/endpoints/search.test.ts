import { afterEach, describe, expect, it, mock } from "bun:test";
import { ParagraphsEndpoint } from "./paragraphs.js";
import { SearchEndpoint } from "./search.js";

const BASE_URL = "https://api.urantia.dev";
const realFetch = globalThis.fetch;

function stubFetch() {
	const fetchMock = mock((_url: string, _init?: RequestInit) =>
		Promise.resolve(new Response(JSON.stringify({ data: [], meta: {} }), { status: 200 })),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("Spanish search and includes", () => {
	it("fullText() sends lang in the body", async () => {
		const fetchMock = stubFetch();
		await new SearchEndpoint(BASE_URL, () => ({})).fullText({ q: "Ajustador", lang: "es" });
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ q: "Ajustador", lang: "es" });
	});

	it("semantic() sends lang in the body", async () => {
		const fetchMock = stubFetch();
		await new SearchEndpoint(BASE_URL, () => ({})).semantic({ q: "¿Qué es el alma?", lang: "es" });
		expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ q: "¿Qué es el alma?", lang: "es" });
	});

	it("paragraphs.get() sends include and lang together", async () => {
		const fetchMock = stubFetch();
		await new ParagraphsEndpoint(BASE_URL, () => ({})).get("1:0.1", { include: "urantiaParallels", lang: "es" });
		expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/paragraphs/1%3A0.1?include=urantiaParallels&lang=es`);
	});
});
