import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { EditionsEndpoint } from "./editions.js";
import { PapersEndpoint } from "./papers.js";
import { ParagraphsEndpoint } from "./paragraphs.js";

const BASE_URL = "https://api.urantia.dev";
const HEADERS = { "X-Test": "1" };

function mockFetch(status = 200) {
	const fetchMock = mock((_url: string) =>
		Promise.resolve(
			new Response(JSON.stringify(status === 200 ? { data: [] } : { detail: "Unknown edition" }), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

const urlOf = (m: ReturnType<typeof mock>) => m.mock.calls[0]?.[0] as string;

let originalFetch: typeof fetch;
beforeEach(() => {
	originalFetch = globalThis.fetch;
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("EditionsEndpoint", () => {
	it("list() requests /editions", async () => {
		const m = mockFetch();
		await new EditionsEndpoint(BASE_URL, () => HEADERS).list();
		expect(urlOf(m)).toBe(`${BASE_URL}/editions`);
	});

	it("variants() sends paper, ref, and kind", async () => {
		const m = mockFetch();
		const e = new EditionsEndpoint(BASE_URL, () => HEADERS);
		await e.variants();
		expect(urlOf(m)).toBe(`${BASE_URL}/editions/variants`);
		const m2 = mockFetch();
		await e.variants({ paper: 0, ref: "0:1.24", kind: "text" });
		expect(urlOf(m2)).toBe(`${BASE_URL}/editions/variants?paper=0&ref=0%3A1.24&kind=text`);
	});

	it("throws with the detail of a problem answer", async () => {
		mockFetch(400);
		await expect(new EditionsEndpoint(BASE_URL, () => HEADERS).variants({ paper: 300 })).rejects.toThrow(
			"400: Unknown edition",
		);
	});
});

describe("the edition option", () => {
	it("goes on the paragraph calls", async () => {
		const p = new ParagraphsEndpoint(BASE_URL, () => HEADERS);
		let m = mockFetch();
		await p.get("98:3.8", { edition: "1955", include: "variants" });
		expect(urlOf(m)).toBe(`${BASE_URL}/paragraphs/98%3A3.8?include=variants&edition=1955`);
		m = mockFetch();
		await p.context("98:3.8", { edition: "srt-2021" });
		expect(urlOf(m)).toContain("edition=srt-2021");
		m = mockFetch();
		await p.random({ edition: "1.22" });
		expect(urlOf(m)).toBe(`${BASE_URL}/paragraphs/random?edition=1.22`);
	});

	it("goes on papers.get", async () => {
		const m = mockFetch();
		await new PapersEndpoint(BASE_URL, () => HEADERS).get("98", { edition: "1955", include: "entities,variants" });
		expect(urlOf(m)).toBe(`${BASE_URL}/papers/98?include=entities%2Cvariants&edition=1955`);
	});
});
