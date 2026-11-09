# Secret Santa Selector

A Cloudflare Worker with static assets for creating Secret Santa draws with pairing exclusions. The organizer gets one private reveal link per participant; assignments are not shown on the organizer's screen.

## Run locally

1. Install Node.js 22 or later and run `npm install`.
2. The D1 binding in `wrangler.jsonc` points to the project's database. To deploy to a different Cloudflare account, create a database with `npx wrangler d1 create secret-santa` and replace the `database_id` with the returned ID.
3. Apply the schema locally: `npx wrangler d1 migrations apply secret-santa --local`.
4. Start the app: `npm run dev`.

Run the automated tests with `npm test`.

## Deploy

Connect this repository to a Cloudflare Workers project. Use `npx wrangler deploy` as the deploy command (no build command is needed). Wrangler uploads the `public` directory and configures the D1 binding from `wrangler.jsonc`. Apply the schema to the remote database before using the app:

```sh
npx wrangler d1 migrations apply secret-santa --remote
```

The app uses Workers static assets and a D1 database. Do not commit credentials or secrets.

## Privacy and limitations

Each reveal link is a bearer secret: anyone with the link can see that participant's assignment. Send links privately; the organizer receives all the links and can open them. Links remain valid until the database records are removed. Assignment data is stored in D1, so a Cloudflare account administrator can access it. The app does not send emails, authenticate organizers, rate-limit requests, or automatically expire draws. Consider Cloudflare WAF rate limiting before making the service publicly available. The link list is only available immediately after creating a draw; save or send it before leaving the page.
