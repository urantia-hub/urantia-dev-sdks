import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { UrantiaAPI } from "../client.js";
import { WorksEndpoint } from "./works.js";

type FetchMock = ReturnType<typeof mock>;

const BASE_URL = "https://api.urantia.dev";
const HEADERS = { "X-Test": "1" };

function makeWorks(status = 200, body: unknown = { data: [] }): { endpoint: WorksEndpoint; fetchMock: FetchMock } {
	const fetchMock = mock((_url: string, _init?: RequestInit) =>
		Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;
	return { endpoint: new WorksEndpoint(BASE_URL, () => HEADERS), fetchMock };
}

const call = (fetchMock: FetchMock, n = 0) => fetchMock.mock.calls[n] as [string, RequestInit];

let originalFetch: typeof fetch;
beforeEach(() => {
	originalFetch = globalThis.fetch;
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("WorksEndpoint", () => {
	it("lists the works at /works", async () => {
		const { endpoint, fetchMock } = makeWorks();
		await endpoint.list();
		expect(call(fetchMock)[0]).toBe(`${BASE_URL}/works`);
		expect(call(fetchMock)[1].headers).toEqual(HEADERS);
	});

	it("reads a work by reference, with the reference encoded", async () => {
		const { endpoint, fetchMock } = makeWorks();
		await endpoint.read("bible", "Daniel (Greek) 3:5");
		expect(call(fetchMock)[0]).toBe(`${BASE_URL}/works/bible/Daniel%20(Greek)%203%3A5`);
	});

	it("asks the Spanish catalog words with lang", async () => {
		const { endpoint, fetchMock } = makeWorks();
		await endpoint.list({ lang: "es" });
		await endpoint.read("dhammapada", "Dhp 1", { lang: "es" });
		await endpoint.read("dhammapada", "Dhp 1", {});
		expect(call(fetchMock, 0)[0]).toBe(`${BASE_URL}/works?lang=es`);
		expect(call(fetchMock, 1)[0]).toBe(`${BASE_URL}/works/dhammapada/Dhp%201?lang=es`);
		expect(call(fetchMock, 2)[0]).toBe(`${BASE_URL}/works/dhammapada/Dhp%201`);
	});

	it("asks the Urantia parallels and the parallels in the other works of one unit", async () => {
		const { endpoint, fetchMock } = makeWorks(200, { data: {} });
		await endpoint.urantiaParallels("dhammapada", "Dhp 21");
		await endpoint.workParallels("quran", "Quran 2.255");
		expect(call(fetchMock, 0)[0]).toBe(`${BASE_URL}/works/dhammapada/Dhp%2021/urantia-parallels`);
		expect(call(fetchMock, 1)[0]).toBe(`${BASE_URL}/works/quran/Quran%202.255/work-parallels`);
	});

	it("posts a keyword search, from a string or from params", async () => {
		const { endpoint, fetchMock } = makeWorks();
		await endpoint.search("golden rule");
		await endpoint.search({ q: "golden rule", work: "analects", limit: 5 });
		const [url, init] = call(fetchMock, 0);
		expect(url).toBe(`${BASE_URL}/works/search`);
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({ ...HEADERS, "Content-Type": "application/json" });
		expect(JSON.parse(init.body as string)).toEqual({ q: "golden rule" });
		expect(JSON.parse(call(fetchMock, 1)[1].body as string)).toEqual({ q: "golden rule", work: "analects", limit: 5 });
	});

	it("posts a semantic search to /works/search/semantic", async () => {
		const { endpoint, fetchMock } = makeWorks();
		await endpoint.semanticSearch({ q: "the soul after death", urantiaParallelLimit: 0 });
		expect(call(fetchMock)[0]).toBe(`${BASE_URL}/works/search/semantic`);
		expect(JSON.parse(call(fetchMock)[1].body as string)).toEqual({ q: "the soul after death", urantiaParallelLimit: 0 });
	});

	it("throws the status and the detail of a problem response", async () => {
		const { endpoint } = makeWorks(404, { title: "Not Found", detail: 'Dhp 999 not found in "dhammapada"' });
		await expect(endpoint.read("dhammapada", "Dhp 999")).rejects.toThrow('404: Dhp 999 not found in "dhammapada"');
	});

	it("is on the client as api.works", () => {
		expect(new UrantiaAPI().works).toBeInstanceOf(WorksEndpoint);
	});
});
