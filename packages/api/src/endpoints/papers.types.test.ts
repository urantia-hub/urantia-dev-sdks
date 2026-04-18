// Compile-time type tests for PapersEndpoint. These assertions are checked by
// `tsc` — a regression shows up as a type error at build time, not a runtime
// failure. Paired with the runtime tests in `papers.test.ts`.

import { describe, expect, it } from "bun:test";
import { PapersEndpoint } from "./papers.js";
import type { PaperInclude, PaperListInclude } from "./papers.js";
import type { Paper, TopEntity } from "../types.js";

// ─── String-literal unions accept valid tokens ───

const _validDetailIncludes: PaperInclude[] = [
	"entities",
	"topEntities",
	"entities,topEntities",
];

const _validListIncludes: PaperListInclude[] = ["topEntities"];

// @ts-expect-error — "foo" is not a valid PaperInclude token
const _invalidDetailInclude: PaperInclude = "foo";

// @ts-expect-error — "entities" is not valid on the list endpoint (no paragraph context)
const _invalidListInclude: PaperListInclude = "entities";

// ─── Paper.topEntities is typed as TopEntity[] | undefined ───

const samplePaper: Paper = {
	id: "1",
	title: "The Universal Father",
	author: "",
	partId: "1",
	partTitle: "Part I",
	paragraphCount: 60,
	video: null,
};

// Without topEntities — compiles (field is optional)
expectType<Paper>(samplePaper);

// With topEntities — compiles, and count field is typed as number
const paperWithTop: Paper = {
	...samplePaper,
	topEntities: [
		{
			id: "father",
			name: "Universal Father",
			type: "being",
			count: 74,
		} satisfies TopEntity,
	],
};
expectType<Paper>(paperWithTop);

// TopEntity count must be a number
// @ts-expect-error — count cannot be a string
const _invalidCount: TopEntity = {
	id: "father",
	name: "Universal Father",
	type: "being",
	count: "74",
};

// Accessing `topEntities?.[0].count` typechecks to `number | undefined`
const count: number | undefined = paperWithTop.topEntities?.[0].count;
expectType<number | undefined>(count);

// ─── Helper for inline type assertions ───
function expectType<T>(_value: T): void {
	// compile-time only
}

// ─── Ensure the class exposes the right public methods ───

describe("PapersEndpoint public surface", () => {
	it("exposes list() and get() methods", () => {
		const endpoint = new PapersEndpoint("https://api.urantia.dev", () => ({}));
		expect(typeof endpoint.list).toBe("function");
		expect(typeof endpoint.get).toBe("function");
	});
});
