import { hashToken } from "../../lib/draw.js";
import { json, readJson } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await readJson(request, 1024);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON request." }, 400);
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    throw error;
  }
  if (!data || typeof data.token !== "string" || !/^[0-9a-f]{64}$/.test(data.token)) {
    return json({ error: "This reveal link is invalid." }, 400);
  }
  try {
    const tokenHash = await hashToken(data.token);
    const assignment = await env.DB.prepare(
      "SELECT giver, recipient FROM assignments WHERE token_hash = ?"
    ).bind(tokenHash).first();
    if (!assignment) return json({ error: "This reveal link was not found." }, 404);
    await env.DB.prepare(
      "UPDATE assignments SET viewed_at = COALESCE(viewed_at, datetime('now')) WHERE token_hash = ?"
    ).bind(tokenHash).run();
    return json(assignment);
  } catch (error) {
    console.error("Failed to retrieve Secret Santa assignment", error);
    return json({ error: "Could not load your assignment. Please try again." }, 500);
  }
}
