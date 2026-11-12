# Master-Agent — Free-only Multi-Agent Control Center

AI software delivery dashboard (nine specialist roles, five gated stages) with PostgreSQL persistence and **explicitly free-model-only inference**.

## Live AI provider routing
- **Default:** OpenRouter `openrouter/free` — provider routes exclusively to models listed as free. Requires `OPENROUTER_API_KEY`. The OpenRouter free plan is currently capped at 50 requests/day and 20/minute (limits may change).
- **Optional fallback:** Gemini `gemini-3.5-flash-lite`, activated **only if** both `GEMINI_API_KEY` and `GEMINI_FREE_TIER_CONFIRMED=true` are set. You must ensure your Google AI Studio project remains on its free tier. If billing is enabled, charges are possible; application-level request caps are not billing guarantees.
- No OpenAI fallback. `OPENAI_API_KEY` from a previous version is ignored.
- Zero silent retries; at most one attempt per configured provider and request. 429 triggers a 15-minute cooldown; 503 a 2-minute cooldown.
- Each request reserves a daily allowance atomically in Neon BEFORE calling the external provider. Failed requests count as usage to err on the safe side.

## Cost and quota protection
Default internal request caps (UTC calendar days):
- `AI_DAILY_LIMIT=15` across all AI providers (hard upper bound 50)
- `OPENROUTER_DAILY_LIMIT=12` (hard upper bound 50)
- `GEMINI_DAILY_LIMIT=5` (hard upper bound 25)
- `AI_MAX_OUTPUT_TOKENS=3500` (upper bound 4096)
- `GET /api/usage` displays calls, provider cooldowns and token counters. Daily quota resets at UTC midnight.
- Provider-side limits can be lower or change. Upstream calls are not guaranteed to succeed even within our local budget.
- Never use any key with paid billing unless you separately verified its free-tier settings. Keep API keys only in Vercel encrypted Environment Variables.

## Database migration
Apply [database/free-provider-quota.sql](database/free-provider-quota.sql) to your Neon DB, in addition to the existing `projects` table. The quota function serializes reservations through a daily row lock so concurrent requests cannot pass the limit.

## Deployment budget
- Vercel Preview Deployments disabled.
- Vercel Ignore Build Step: `exit 0` to skip automatic Git-triggered builds.
- Promote only deliberately reviewed builds. A new release requires explicitly overriding the ignore rule or a controlled deployment.
- No generated project is automatically pushed or deployed.

## Security and limitations
- HTTP Basic auth requires `MASTER_PASSWORD`. Change the setup password. Vercel project protection may also be active.
- The five stages use role-based prompts to a real free AI endpoint; role labels do not imply independent concurrent model instances.
- Generated code is a draft artifact, **not** a compiled, tested or deployed application.
- The dashboard runs next stages on demand; there is no always-on worker or autonomous code-execution sandbox.
- Free provider terms may allow prompt usage for model improvement; do not submit confidential source code or sensitive customer data.
- API keys and passwords must not enter GitHub source, logs, or outputs.

## Local
`npm install && npm run dev`

Configure `DATABASE_URL`, `MASTER_PASSWORD`, and `OPENROUTER_API_KEY` in environment variables before use.

## 2026-11 Gemini 404 fix
Gemini Developer API restricts Gemini 2.5 Flash-Lite generation for projects without prior use. Use `gemini-3.5-flash-lite`, documented with a Free Tier. HTTP 404 is now described clearly and a second explicitly enabled provider may be tried without restarting the completed roles. Free providers are preferred before any paid providers. If paid fallback is enabled in Connections, it may incur charges; disable it to enforce free-only mode. No migration, reset, or automatic API requests are required.
