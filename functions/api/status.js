import { hashToken } from "../../lib/draw.js";
import { json, readJson } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await readJson(request, 16 * 1024);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON request." }, 400);
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    throw error;
  }
  if (!data || !Array.isArray(data.tokens) || data.tokens.length < 1 ||
      data.tokens.length > 100 ||
      new Set(data.tokens).size !== data.tokens.length ||
      !data.tokens.every((token) => typeof token === "string" && /^[0-9a-f]{64}$/.test(token))) {
    return json({ error: "Provide between 1 and 100 valid reveal links." }, 400);
  }
  try {
    const hashes = await Promise.all(data.tokens.map(hashToken));
    const placeholders = hashes.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT token_hash, opened_at, viewed_at FROM assignments WHERE token_hash IN (${placeholders})`
    ).bind(...hashes).all();
    const statuses = new Map(result.results.map((row) => [row.token_hash, row]));
    if (statuses.size !== hashes.length) return json({ error: "One or more reveal links were not found." }, 404);
    return json({
      statuses: hashes.map((hash) => {
        const row = statuses.get(hash);
        return { opened: Boolean(row.opened_at), viewed: Boolean(row.viewed_at) };
      })
    });
  } catch (error) {
    console.error("Failed to retrieve Secret Santa link activity", error);
    return json({ error: "Could not load link activity. Please try again." }, 500);
  }
}
