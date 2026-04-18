import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { PapersEndpoint } from "./papers.js";

// ─── Test helpers ───

type FetchMock = ReturnType<typeof mock>;

const BASE_URL = "https://api.urantia.dev";
const HEADERS = { "X-Test": "1" };

function makePapers(): { endpoint: PapersEndpoint; fetchMock: FetchMock } {
	const fetchMock = mock((_url: string) =>
		Promise.resolve(
			new Response(JSON.stringify({ data: { ok: true } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;

	const endpoint = new PapersEndpoint(BASE_URL, () => HEADERS);
	return { endpoint, fetchMock };
}

let originalFetch: typeof fetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// ─── list() ───

describe("PapersEndpoint.list", () => {
	it("requests /papers with no query string when called without options", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.list();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers`);
	});

	it("forwards headers from the headers() thunk", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.list();

		const call = fetchMock.mock.calls[0];
		const init = call?.[1] as RequestInit;
		expect(init.headers).toEqual(HEADERS);
	});

	it("sets ?include=topEntities when include option is provided", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.list({ include: "topEntities" });

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers?include=topEntities`);
	});

	it("returns the parsed JSON body", async () => {
		const { endpoint } = makePapers();
		const result = await endpoint.list();
		expect(result).toEqual({ data: { ok: true } } as never);
	});

	it("throws with status + detail when response is not ok", async () => {
		const errorFetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ detail: "boom", title: "Bad Request", status: 400 }),
					{ status: 400, headers: { "Content-Type": "application/json" } },
				),
			),
		);
		globalThis.fetch = errorFetch as unknown as typeof fetch;

		const endpoint = new PapersEndpoint(BASE_URL, () => ({}));
		await expect(endpoint.list()).rejects.toThrow("400: boom");
	});

	it("falls back to statusText when error body is unparseable", async () => {
		const errorFetch = mock(() =>
			Promise.resolve(
				new Response("not json", { status: 500, statusText: "Server Error" }),
			),
		);
		globalThis.fetch = errorFetch as unknown as typeof fetch;

		const endpoint = new PapersEndpoint(BASE_URL, () => ({}));
		await expect(endpoint.list()).rejects.toThrow("500:");
	});
});

// ─── get() ───

describe("PapersEndpoint.get", () => {
	it("requests /papers/:id with no query string when called without options", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("1");

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers/1`);
	});

	it("sets ?include=entities when include is entities", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("1", { include: "entities" });

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers/1?include=entities`);
	});

	it("sets ?include=topEntities when include is topEntities", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("1", { include: "topEntities" });

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers/1?include=topEntities`);
	});

	it("URL-encodes the comma when include is entities,topEntities", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("1", { include: "entities,topEntities" });

		const call = fetchMock.mock.calls[0];
		// URLSearchParams encodes comma as %2C
		expect(call?.[0]).toBe(
			`${BASE_URL}/papers/1?include=entities%2CtopEntities`,
		);
	});

	it("passes numeric-string ids unchanged", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("42");

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers/42`);
	});

	it("passes the id '0' (Foreword) correctly", async () => {
		const { endpoint, fetchMock } = makePapers();
		await endpoint.get("0", { include: "entities" });

		const call = fetchMock.mock.calls[0];
		expect(call?.[0]).toBe(`${BASE_URL}/papers/0?include=entities`);
	});

	it("returns the parsed JSON body", async () => {
		const { endpoint } = makePapers();
		const result = await endpoint.get("1");
		expect(result).toEqual({ data: { ok: true } } as never);
	});

	it("throws with status + detail when response is not ok", async () => {
		const errorFetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({ detail: "Paper 999 not found", status: 404 }),
					{ status: 404 },
				),
			),
		);
		globalThis.fetch = errorFetch as unknown as typeof fetch;

		const endpoint = new PapersEndpoint(BASE_URL, () => ({}));
		await expect(endpoint.get("999")).rejects.toThrow(
			"404: Paper 999 not found",
		);
	});
});
