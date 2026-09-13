# SEDAR

Proactive AI food companion for Telegram.

## Core flow

Telegram → SEDAR Agent → OpenAI → persistent state → research → agentic meal planning → proactive Telegram follow-up.

## Stack

OpenAI, CopilotKit, OpenRouter, Exa, Trigger.dev, Auth0, Mozilla.ai, Ambiguous AI, WORQ, Supabase, Telegram.

## Demo

1. Set a goal with `/goal ...`
2. Send a food photo
3. Review the estimated nutrition log
4. Run `/today`
5. Ask `Plan my dinner`
6. Receive a researched Malaysian meal plan
7. Trigger.dev can send a proactive follow-up
8. Review the operations surface at `/dashboard`

## Run

```bash
npm install
npm run dev
```

Required: `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `PUBLIC_BASE_URL`.

Optional sponsor integrations are listed in `.env.example`.
