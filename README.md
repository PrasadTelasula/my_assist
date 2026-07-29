# my_assist

Your agents, their work, in plain sight.

A local-first AI agentic platform: a transparent, framework-free agent loop you
can read in one sitting, tools you write in the browser, a live trace of every
model call and tool invocation, and a scrum board where agents work stories
alongside you.

Inspired by [waku-agent](https://github.com/ShenSeanChen/waku-agent)'s
"own the loop" philosophy — rebuilt as a single TypeScript app with a modern UI.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript strict) — one app serves the
  UI, the API, and the background run manager.
- **Vercel AI SDK v5** for provider normalization only (Anthropic, OpenAI,
  Google, OpenRouter, Ollama). The agent loop is ~100 lines of our own code in
  `src/core/loop.ts`.
- **Postgres 16** (docker-compose, port 5433) + **Drizzle ORM** with checked-in
  SQL migrations.
- **Vitest + Playwright** — test-driven throughout; the LLM is always faked in
  tests.

## Getting started

```bash
cp .env.example .env          # fill in provider API keys
npm install
npm run db:up                 # start Postgres (Docker)
npm run db:migrate
npm run seed                  # local user + starter agent
npm run dev                   # http://localhost:3000
```

Useful scripts: `npm test` (Vitest), `npm run test:e2e` (Playwright),
`npm run lint`, `npm run typecheck`, `npm run knip`.

### Local models and self-hosted servers

**Settings → Add connection** registers any endpoint the platform should talk
to. For a local OpenAI-compatible server (apfel, llama.cpp, vLLM, LM Studio),
choose kind `openai-compatible` and give it the `/v1` base:

```
name:     apfel-local
kind:     openai-compatible
base URL: http://127.0.0.1:11434/v1
token:    (blank — most local servers need none)
```

**Test** probes `GET {base}/models` and lists what the server serves; those
model ids then autocomplete in the agent's model picker. Point an agent at the
connection and its runs go to your machine instead of a hosted API.

Two things worth knowing: requests are made by the Next.js server process, so a
local server with **CORS disabled and localhost-only origins works fine** — it
never sees a browser origin. And cost shows as `$ —` for models absent from the
pricing table, which is what you want for local inference.

### Try it without an API key

Set `MY_ASSIST_PROVIDER=fake` before `npm run seed` and `npm run dev` to get a
scripted **Demo** agent that works every flow deterministically — chat with a
live trace, sprint planning from a goal, working a card to Review, and critic
review. This is also how the Playwright suite runs in CI. (If your machine has
a system Chromium instead of Playwright's managed browsers, point
`PLAYWRIGHT_CHROMIUM_PATH` at it.)

## Deployment caveat

Background agent runs execute inside the Next.js Node server process. That is
by design for local-first use (and fine on any long-lived Node host), but it
will not survive serverless platforms that kill processes between requests.
The cloud path is a worker queue — the DB-first event log already supports it.

## Security model for user-authored tools

Tools written in the browser run out-of-process in a sandboxed Node child
(import allowlist, timeout, memory cap, process-group kill). This is a
guardrail for code _you_ wrote on your own machine — not hostile-multi-tenant
isolation. The cloud-hardening path is a container-based runner behind the
same executor interface.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md) — architecture boundaries, code rules,
and UI design tokens. The mechanical rules are enforced by ESLint, knip, and CI.
