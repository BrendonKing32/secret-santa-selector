import test from "node:test";
import assert from "node:assert/strict";
import { validateDraw, match, hashToken } from "../lib/draw.js";
import { onRequestPost as draw } from "../functions/api/draw.js";
import { onRequestPost as reveal } from "../functions/api/reveal.js";
import worker from "../worker.js";

function database() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql, args,
            async first() {
              return rows.get(args[0]) ?? null;
            }
          };
        }
      };
    },
    async batch(statements) {
      for (const { args: [hash, giver, recipient] } of statements) {
        rows.set(hash, { giver, recipient });
      }
    }
  };
}

function request(body) {
  return new Request("https://example.test/api", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

test("matching produces a permutation satisfying all exclusions", () => {
  const { blocked } = validateDraw({ names: ["A", "B", "C", "D", "E"], exclusions: [[0, 1], [1, 2]] });
  for (let iteration = 0; iteration < 100; iteration++) {
    const result = match(blocked);
    assert.equal(new Set(result).size, 5);
    result.forEach((recipient, giver) => assert.equal(blocked[giver].has(recipient), false));
  }
});

test("matching detects impossible draws", () => {
  const { blocked } = validateDraw({ names: ["A", "B", "C"], exclusions: [[0, 1]] });
  assert.equal(match(blocked), null);
});

test("invalid inputs are rejected", () => {
  for (const data of [
    { names: ["A", "B"], exclusions: [] },
    { names: ["A", "a", "C"], exclusions: [] },
    { names: ["A", "B", "C"], exclusions: [[0, 3]] },
    { names: ["A", "B", "C"], exclusions: [[1, 1]] },
    { names: ["A", "B", ""], exclusions: [] }
  ]) {
    assert.throws(() => validateDraw(data));
  }
});

test("draw stores only hashed tokens and reveals each assignment privately", async () => {
  const DB = database();
  const response = await draw({
    request: request({ names: ["A", "B", "C", "D"], exclusions: [[0, 1]] }),
    env: { DB }
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { links } = await response.json();
  assert.equal(links.length, 4);
  assert.equal(new Set(links.map((link) => link.token)).size, 4);
  const recipients = [];
  for (const { name, token } of links) {
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(DB.rows.has(token), false);
    assert.equal(DB.rows.has(await hashToken(token)), true);
    const result = await reveal({ request: request({ token }), env: { DB } });
    const assignment = await result.json();
    assert.equal(assignment.giver, name);
    assert.notEqual(assignment.recipient, name);
    if (name === "A") assert.notEqual(assignment.recipient, "B");
    if (name === "B") assert.notEqual(assignment.recipient, "A");
    recipients.push(assignment.recipient);
  }
  assert.equal(new Set(recipients).size, 4);
});

test("API rejects impossible draws, invalid links, bad JSON, and oversized bodies", async () => {
  const DB = database();
  assert.equal((await draw({ request: request({ names: ["A", "B", "C"], exclusions: [[0, 1]] }), env: { DB } })).status, 422);
  assert.equal(DB.rows.size, 0);
  assert.equal((await reveal({ request: request({ token: "bad" }), env: { DB } })).status, 400);
  assert.equal((await reveal({ request: request({ token: "a".repeat(64) }), env: { DB } })).status, 404);
  assert.equal((await draw({ request: request("{"), env: { DB } })).status, 400);
  assert.equal((await draw({ request: request("x".repeat(65537)), env: { DB } })).status, 413);
});

test("Worker routes API requests and delegates static assets", async () => {
  const DB = database();
  const ASSETS = { fetch: async () => new Response("static asset") };
  const env = { DB, ASSETS };
  const result = await worker.fetch(new Request("https://example.test/api/draw", {
    method: "POST",
    body: JSON.stringify({ names: ["A", "B", "C"], exclusions: [] })
  }), env);
  assert.equal(result.status, 201);
  assert.equal((await result.json()).links.length, 3);
  const wrongMethod = await worker.fetch(new Request("https://example.test/api/draw"), env);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  assert.equal((await worker.fetch(new Request("https://example.test/api/missing"), env)).status, 404);
  assert.equal(await (await worker.fetch(new Request("https://example.test/"), env)).text(), "static asset");
});
