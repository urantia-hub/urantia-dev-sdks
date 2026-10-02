import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { UrantiaAPI } from "../client.js";
import { FeedbackEndpoint } from "./feedback.js";

// ─── Test helpers ───

const BASE_URL = "https://api.urantia.dev";
const HEADERS = { "X-Test": "1" };

function makeFeedback(status: number, body: unknown) {
	const fetchMock = mock((_url: string, _init?: RequestInit) =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
	globalThis.fetch = fetchMock as unknown as typeof fetch;

	const endpoint = new FeedbackEndpoint(BASE_URL, () => HEADERS);
	return { endpoint, fetchMock };
}

const SAVED = {
	data: { id: "5a053a0b-b5af-423a-927b-88e35f47f4f2", receivedAt: "2026-10-02T18:25:04.117Z" },
};

let originalFetch: typeof fetch;

beforeEach(() => {
	originalFetch = globalThis.fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// ─── submit() ───

describe("FeedbackEndpoint.submit", () => {
	it("posts the params as JSON to /feedback", async () => {
		const { endpoint, fetchMock } = makeFeedback(201, SAVED);
		const params = {
			category: "bug" as const,
			message: "search returns 500 for phrase mode",
			endpoint: "/search",
			requestId: "8f2c1a7e",
			pageUrl: "https://urantia.dev/quickstart",
		};
		await endpoint.submit(params);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(`${BASE_URL}/feedback`);
		expect(init?.method).toBe("POST");
		expect(init?.headers).toEqual({ "X-Test": "1", "Content-Type": "application/json" });
		expect(JSON.parse(init?.body as string)).toEqual(params);
	});

	it("returns the id and the receivedAt timestamp", async () => {
		const { endpoint } = makeFeedback(201, SAVED);
		const res = await endpoint.submit({ category: "docs", message: "typo in the quickstart" });
		expect(res).toEqual(SAVED);
	});

	it("throws with the status and the problem detail on a 429", async () => {
		const { endpoint } = makeFeedback(429, {
			type: "https://urantia.dev/errors/too-many-requests",
			title: "Too Many Requests",
			status: 429,
			detail: "Too many requests, please try again later",
		});
		await expect(endpoint.submit({ category: "bug", message: "x" })).rejects.toThrow(
			"429: Too many requests, please try again later",
		);
	});
});

describe("UrantiaAPI.feedback", () => {
	it("is wired to the client's base URL", async () => {
		const fetchMock = mock((_url: string, _init?: RequestInit) =>
			Promise.resolve(new Response(JSON.stringify(SAVED), { status: 201 })),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const api = new UrantiaAPI({ baseUrl: "http://localhost:3000/" });
		await api.feedback.submit({ category: "other", message: "hello" });

		expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/feedback");
	});
});
