# Master-Agent
A real, approval-first AI software company control center.

## Features
- Nine specialist roles: PM, BA, Architect, Product Design, FE, BE, QA, Security, DevOps
- Five sequential stages powered by OpenAI Chat Completions, with saved JSON artifacts
- Persistent Neon PostgreSQL projects, errors and reports
- Dark responsive executive dashboard; secured by MASTER_PASSWORD HTTP Basic auth
- No automatic deployment: generated files are drafts, not verified build outputs
- Vercel deployment guardrail: `commandForIgnoringBuildStep` can block every automatic build, and preview deployments can be disabled

## Configuration
Create the Neon schema:
```sql
CREATE TABLE IF NOT EXISTS projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL, prompt text NOT NULL,
 status text NOT NULL DEFAULT 'queued', stage integer NOT NULL DEFAULT 0,
 plan jsonb, artifact jsonb, report jsonb, error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
```
Set `DATABASE_URL`, `OPENAI_API_KEY`, `MASTER_PASSWORD` in the Vercel project Environment Variables (encrypted). `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

## Usage
`npm install && npm run build && npm run dev`. Open the dashboard, authenticate, create a mission and click Start / Next stage. Each stage runs one bounded real AI call.

## Explicit limitations
The MVP does **not** yet execute generated code in a sandbox, verify builds/tests, automatically publish generated applications, or run an always-on autonomous worker. Deployment and GitHub write integrations are intentionally gated until permission scopes and audit logs are ready. Do not equate generated implementation JSON with a running product.

## Deployment budget
Disable preview deployments and set Ignore Build Step command to `exit 0` after the initial deploy. Vercel interprets exit code 0 as skip. To release again, deliberately change the rule or use a controlled single deployment workflow. Avoid GitHub push-to-deploy loops.
