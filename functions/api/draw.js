import { InputError, validateDraw, match, makeToken, hashToken } from "../../lib/draw.js";
import { json, readJson } from "../../lib/http.js";

export async function onRequestPost({ request, env }) {
  let names, blocked;
  try {
    ({ names, blocked } = validateDraw(await readJson(request, 64 * 1024)));
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON request." }, 400);
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    throw error;
  }
  const assignments = match(blocked);
  if (!assignments) {
    return json({ error: "These exclusions leave no possible draw. Remove an exclusion and try again." }, 422);
  }
  const tokens = names.map(() => makeToken());
  const hashes = await Promise.all(tokens.map(hashToken));
  try {
    await env.DB.batch(names.map((name, i) => env.DB.prepare(
      "INSERT INTO assignments (token_hash, giver, recipient) VALUES (?, ?, ?)"
    ).bind(hashes[i], name, names[assignments[i]])));
  } catch (error) {
    console.error("Failed to save Secret Santa draw", error);
    return json({ error: "Could not save the draw. Please try again." }, 500);
  }
  return json({ links: names.map((name, i) => ({ name, token: tokens[i] })) }, 201);
}
