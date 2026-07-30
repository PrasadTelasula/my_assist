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
- **Vercel AI SDK v7** (`ai@7`) for provider normalization only — Anthropic,
  OpenAI, Google, OpenRouter, Ollama, and any OpenAI-compatible server. Tools
  are registered without an `execute`, so the SDK hands tool calls back rather
  than running them: the agent loop is ~200 lines of our own code in
  `src/core/loop.ts` and every dispatch happens there, in plain sight.
- **Postgres 16** (docker-compose, port 5544) + **Drizzle ORM** with checked-in
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
npm run dev                   # http://localhost:7777
```

Useful scripts: `npm test` (Vitest), `npm run test:e2e` (Playwright),
`npm run lint`, `npm run typecheck`, `npm run knip`.

### Ports

| What     | Default | Change with                                            |
| -------- | ------- | ------------------------------------------------------ |
| App      | 7777    | `PORT` in `.env`                                       |
| Postgres | 5544    | `POSTGRES_PORT` in `.env` (also update `DATABASE_URL`) |
| E2E app  | 7788    | `E2E_PORT`                                             |

Nothing else hardcodes a port — set the variable and every script follows.

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

#### When tools don't get called

Test also asks the endpoint whether it can call tools: it offers one trivial
function with `tool_choice` forced to it, and reports `confirmed` if a
`tool_call` comes back. Many local servers accept the `tools` parameter and
answer in prose regardless — Apple foundation-model shims among them — so
attaching a tool to an agent silently does nothing.

You should not have to act on that. Connections default to tool mode **auto**:
the first run where an agent actually has a tool attached asks the endpoint
once, caches the answer on the connection, and picks the mode itself. No probe
is spent on agents without tools, and no later run pays for it again.

When an endpoint will not call a tool, auto uses **prompted tool calling**: the
tools are described in the system prompt, and the loop parses
`{"tool": "…", "input": {…}}` back out of the reply and feeds the result in as
ordinary text. It works on any chat endpoint. It is strictly worse than native
tool calling — the model can malform the JSON, and the manifest costs prompt
tokens — which is why auto only reaches for it on evidence. Pin a connection to
`native` or `prompted` yourself if you know better than the probe.

Two more things worth knowing: requests are made by the Next.js server process,
so a local server with **CORS disabled and localhost-only origins works fine** —
it never sees a browser origin. And cost shows as `$ —` for models absent from
the pricing table, which is what you want for local inference.

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
