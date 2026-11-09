import { onRequestPost as createDraw } from "./functions/api/draw.js";
import { onRequestPost as reveal } from "./functions/api/reveal.js";
import { onRequestPost as open } from "./functions/api/open.js";
import { onRequestPost as status } from "./functions/api/status.js";
import { json } from "./lib/http.js";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/draw" || path === "/api/reveal" || path === "/api/open" || path === "/api/status") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed." }), {
          status: 405,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Allow": "POST"
          }
        });
      }
      const handler = {
        "/api/draw": createDraw,
        "/api/reveal": reveal,
        "/api/open": open,
        "/api/status": status
      }[path];
      return handler({ request, env });
    }
    if (path.startsWith("/api/")) return json({ error: "Not found." }, 404);
    return env.ASSETS.fetch(request);
  }
};
