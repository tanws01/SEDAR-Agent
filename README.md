# SEDAR Agent 🥗

**A proactive AI nutrition agent living in Telegram.**

SEDAR Agent is designed around a simple idea: nutrition support should not stop at answering a question. It should understand the user's ongoing food context, remember what was logged, research when needed, help decide what to eat next, and proactively follow up.

> **Hackathon:** AI Tinkerers Kuala Lumpur — *Agents, Everywhere*

## What makes SEDAR Agent an agent?

SEDAR Agent moves beyond a traditional chatbot by combining:

- **Persistent context** — remembers goals, preferences and recent meals.
- **Multimodal perception** — turns a Telegram food photo into a structured nutrition estimate.
- **Agentic decisions** — uses the user's goal + today's intake to plan the next meal.
- **Research** — uses Exa for fresh Malaysian food/nutrition information when useful.
- **Multi-model orchestration** — OpenAI handles the primary reasoning/vision path, with OpenRouter available as a model-routing/fallback layer.
- **Proactive behaviour** — Trigger.dev can run background nutrition monitoring and send a Telegram nudge when appropriate.
- **Operations visibility** — CopilotKit provides an agent operations surface for reviewing state and decisions.
- **Evaluation + assurance** — Mozilla.ai provides an evaluation harness; Ambiguous AI and WORQ are wired as optional assurance/action layers.

## Demo flow

1. Open **SEDAR Agent** in Telegram.
2. Run `/goal build muscle while staying lean`.
3. Send a photo of a Malaysian meal.
4. SEDAR Agent uses **OpenAI vision** to estimate the meal and logs it.
5. Run `/today` to see the persistent daily nutrition state.
6. Ask **“Plan my dinner”**.
7. SEDAR Agent researches relevant options, considers today's intake + the goal, and produces a practical dinner recommendation.
8. **Trigger.dev** can continue the workflow in the background and send a proactive follow-up.
9. Use `/dashboard` to inspect the operations surface and `/api/copilotkit` for the CopilotKit runtime.
10. Run the **Mozilla.ai** evaluation harness to test safety, uncertainty handling and agent behaviour.

## Telegram commands

| Command | Purpose |
|---|---|
| `/start` | Start SEDAR Agent and see available actions |
| `/help` | Show usage |
| `/goal ...` | Set or update the user's nutrition goal |
| `/today` | View today's logged nutrition |
| `/privacy` | View data/safety guidance |
| `/reset` | Reset the stored nutrition state |

You can also send a **food photo** or ask natural-language questions such as `Plan my dinner`.

## Architecture

```text
Telegram
   ↓
SEDAR Agent (Express)
   ├── OpenAI Responses API + vision
   ├── Exa research
   ├── OpenRouter model routing / fallback
   ├── Supabase persistent user + meal state
   ├── Trigger.dev background/proactive workflows
   ├── CopilotKit operations runtime
   ├── Auth0-protected admin API
   ├── Ambiguous AI optional action/assurance hook
   ├── WORQ optional synthetic assurance/audit hook
   └── Mozilla.ai tinyagent evaluation harness
```

## Tech stack

- Telegram Bot API
- OpenAI
- OpenRouter
- Exa
- Supabase
- Trigger.dev
- CopilotKit
- Auth0
- Ambiguous AI
- Mozilla.ai tinyagent
- WORQ
- Express / Node.js

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and configure the required values.

### Minimum Telegram setup

1. Open **BotFather** in Telegram and create a bot with `/newbot`.
2. Keep the bot token private; do **not** commit it to GitHub.
3. Set `TELEGRAM_BOT_TOKEN` in your deployment environment.
4. Set `PUBLIC_BASE_URL` to the public HTTPS URL of the deployed SEDAR Agent server.
5. Set `ADMIN_SETUP_TOKEN` to a private setup secret.
6. Call the protected endpoint below once to register the webhook:

```bash
curl -X POST "$PUBLIC_BASE_URL/telegram/set-webhook" \
  -H "Content-Type: application/json" \
  -H "x-sedar-admin-token: $ADMIN_SETUP_TOKEN" \
  -d '{}'
```

Telegram will then deliver messages to:

```text
POST /telegram/webhook
```

## Persistence

If Supabase is configured, run `supabase/schema.sql` and provide:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Without Supabase, SEDAR Agent falls back to in-memory state for local development.

## Optional integrations

The remaining sponsor integrations are configured through `.env.example`. They are intentionally optional so SEDAR Agent can still run with the core Telegram + OpenAI flow.

**Important:** credentials are never included in the repository. Some integrations require their own account, endpoint or deployment configuration before they become active.

## Safety

SEDAR Agent is a **general nutrition education and food companion**, not a doctor or medical treatment system.

- Nutrition values are estimates, especially from photos.
- SEDAR Agent should communicate uncertainty rather than imply false precision.
- It must not diagnose conditions or prescribe treatment.
- It must not tell users to start, stop or change prescription medication.
- Users with medical concerns should consult an appropriately qualified healthcare professional.
- Do not send passwords, identity documents, financial credentials or other unnecessary sensitive information to the agent.

## Repository

`tanws01/SEDAR-Agent`
