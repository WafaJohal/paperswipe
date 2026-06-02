/**
 * Deno-native test runner for lib/openalex.ts.
 * Run with:  deno test --allow-none __tests__/lib/openalex.deno_test.ts
 *
 * Uses only node:assert (built into Deno compat layer) — no network required.
 */
import assert from "node:assert/strict";
import { buildOpenAlexUrl, reconstructAbstract } from "../../lib/openalex.ts";
import type { FeedFilters } from "../../lib/openalex.ts";

const BASE: FeedFilters = {
  keywords: [],
  dateRange: "month",
  venues: [],
  workType: "",
  openAccessOnly: false,
};

// ── buildOpenAlexUrl ─────────────────────────────────────────────────────────

Deno.test("always includes from_publication_date filter", () => {
  assert.ok(buildOpenAlexUrl(BASE).includes("from_publication_date:"));
});

Deno.test("defaults to page 1", () => {
  assert.ok(buildOpenAlexUrl(BASE).includes("&page=1"));
});

Deno.test("passes explicit page number", () => {
  assert.ok(buildOpenAlexUrl(BASE, 3).includes("&page=3"));
});

Deno.test("adds search param when keywords provided", () => {
  const url = buildOpenAlexUrl({ ...BASE, keywords: ["machine learning"] });
  // encodeURIComponent encodes spaces as %20
  assert.ok(url.includes("&search=machine%20learning"));
});

Deno.test("joins multiple keywords with space", () => {
  const url = buildOpenAlexUrl({ ...BASE, keywords: ["HRI", "robots"] });
  assert.ok(url.includes("&search=HRI%20robots"));
});

Deno.test("omits search param when keywords empty", () => {
  assert.ok(!buildOpenAlexUrl(BASE).includes("&search="));
});

Deno.test("uses primary_location.source.id for venues", () => {
  const url = buildOpenAlexUrl({
    ...BASE,
    venues: [{ name: "Nature", id: "S137773608" }],
  });
  assert.ok(url.includes("primary_location.source.id:S137773608"));
});

Deno.test("joins multiple venue IDs with pipe (OR)", () => {
  const url = buildOpenAlexUrl({
    ...BASE,
    venues: [
      { name: "Nature", id: "S137773608" },
      { name: "Science", id: "S3880285" },
    ],
  });
  assert.ok(url.includes("primary_location.source.id:S137773608|S3880285"));
});

Deno.test("omits venue filter when venues empty", () => {
  assert.ok(!buildOpenAlexUrl(BASE).includes("primary_location.source"));
});

Deno.test("does not use display_name for venue filtering", () => {
  const url = buildOpenAlexUrl({
    ...BASE,
    venues: [{ name: "Nature", id: "S137773608" }],
  });
  assert.ok(!url.includes("display_name"));
});

Deno.test("adds type:article filter", () => {
  assert.ok(buildOpenAlexUrl({ ...BASE, workType: "article" }).includes("type:article"));
});

Deno.test("adds type:review filter", () => {
  assert.ok(buildOpenAlexUrl({ ...BASE, workType: "review" }).includes("type:review"));
});

Deno.test("adds type:preprint filter", () => {
  assert.ok(
    buildOpenAlexUrl({ ...BASE, workType: "preprint" }).includes("type:preprint")
  );
});

Deno.test("omits type filter when workType is empty", () => {
  assert.ok(!buildOpenAlexUrl({ ...BASE, workType: "" }).includes("type:"));
});

Deno.test("adds open_access.is_oa:true when openAccessOnly", () => {
  assert.ok(
    buildOpenAlexUrl({ ...BASE, openAccessOnly: true }).includes("open_access.is_oa:true")
  );
});

Deno.test("omits OA filter when openAccessOnly false", () => {
  assert.ok(
    !buildOpenAlexUrl({ ...BASE, openAccessOnly: false }).includes("open_access.is_oa")
  );
});

Deno.test("pipe character NOT percent-encoded", () => {
  const url = buildOpenAlexUrl({
    ...BASE,
    venues: [
      { name: "Nature", id: "S137773608" },
      { name: "Science", id: "S3880285" },
    ],
  });
  assert.ok(!url.includes("%7C"));
  assert.ok(url.includes("|"));
});

Deno.test("combined filters all present", () => {
  const url = buildOpenAlexUrl({
    keywords: ["climate"],
    dateRange: "year",
    venues: [{ name: "Nature", id: "S137773608" }],
    workType: "article",
    openAccessOnly: true,
  });
  assert.ok(url.includes("primary_location.source.id:S137773608"));
  assert.ok(url.includes("type:article"));
  assert.ok(url.includes("open_access.is_oa:true"));
  assert.ok(url.includes("&search=climate"));
});

Deno.test("select param includes required fields", () => {
  const url = buildOpenAlexUrl(BASE);
  assert.ok(url.includes("select="));
  assert.ok(url.includes("abstract_inverted_index"));
  assert.ok(url.includes("open_access"));
});

// ── reconstructAbstract ──────────────────────────────────────────────────────

Deno.test("reconstructAbstract returns empty for null", () => {
  assert.strictEqual(reconstructAbstract(null), "");
});

Deno.test("reconstructAbstract rebuilds simple sentence", () => {
  assert.strictEqual(reconstructAbstract({ Hello: [0], world: [1] }), "Hello world");
});

Deno.test("reconstructAbstract handles repeated words", () => {
  assert.strictEqual(
    reconstructAbstract({ the: [0, 3], cat: [1], sat: [2] }),
    "the cat sat the"
  );
});

Deno.test("reconstructAbstract sorts positions regardless of key order", () => {
  assert.strictEqual(reconstructAbstract({ Z: [2], A: [0], M: [1] }), "A M Z");
});
