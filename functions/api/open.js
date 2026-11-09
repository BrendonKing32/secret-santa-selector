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
    const result = await env.DB.prepare(
      "UPDATE assignments SET opened_at = COALESCE(opened_at, datetime('now')) WHERE token_hash = ?"
    ).bind(await hashToken(data.token)).run();
    if (!result.meta.changes) return json({ error: "This reveal link was not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Failed to record Secret Santa link opening", error);
    return json({ error: "Could not record that this link was opened." }, 500);
  }
}
