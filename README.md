# SEDAR Bot 🥗

**An AI-powered WhatsApp nutrition assistant providing evidence-based nutrition guidance.**

SEDAR Bot is designed to make reliable nutrition education accessible through a familiar WhatsApp conversation. It uses the OpenAI Responses API with web search to answer nutrition questions, explain food choices, estimate calories and macronutrients, and provide practical guidance while maintaining clear health-safety boundaries.

## ✨ What it can do

- Nutrition Q&A in **English, Bahasa Melayu and Chinese**
- Evidence-informed nutrition education
- Malaysian food and eating-context examples
- Calorie and macronutrient estimates with assumptions
- Current web research for questions where guidance may change
- Safety-aware responses and escalation for high-risk situations
- Simple WhatsApp commands: `/help` and `/privacy`
- Vercel-ready Node.js deployment

## 🏗️ Architecture

```text
WhatsApp user
     ↓
Meta WhatsApp Cloud API
     ↓
SEDAR Bot webhook
     ↓
OpenAI Responses API + Web Search
     ↓
Safety-aware nutrition response
     ↓
WhatsApp reply
```

## 🧠 AI behaviour

SEDAR Bot is intentionally positioned as a **nutrition education assistant**, not an AI doctor or replacement for a registered dietitian or healthcare professional.

The system prompt instructs the assistant to:

1. Answer the user's question directly.
2. Prefer authoritative public-health and clinical nutrition sources.
3. Use web search when current evidence or guidance is required.
4. Avoid diagnosis, prescription, medication changes and unsafe diet advice.
5. Escalate appropriate medical or emergency situations to qualified professionals.
6. Communicate clearly and naturally in the user's language.

The current implementation uses `gpt-5.6-luna` by default for cost-sensitive, high-volume usage. The model can be changed with `OPENAI_MODEL`.

## 🚀 Local development

### 1. Requirements

- Node.js 24+
- An OpenAI API key
- A Meta WhatsApp Business Platform setup

### 2. Install

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=v23.0
```

### 4. Run

```bash
npm run dev
```

Health check:

```text
http://localhost:3000/health
```

## ☁️ Vercel deployment

The repository is designed to run as a Node.js backend on Vercel. Vercel currently supports Node.js 24 as the default runtime for new projects.

Import the GitHub repository into Vercel and add the environment variables under the appropriate environment. Vercel will redeploy when changes are pushed to the connected `main` branch.

After deployment, the webhook URL will be:

```text
https://YOUR-DOMAIN/webhook
```

The Meta webhook verification request uses:

```text
GET /webhook
```

Incoming WhatsApp messages are handled by:

```text
POST /webhook
```

## 🔐 Security notes

- Never commit `.env` or API keys.
- Use a strong random `WHATSAPP_VERIFY_TOKEN`.
- Keep WhatsApp and OpenAI credentials in Vercel environment variables.
- Add Meta webhook signature verification before production launch.
- Add rate limiting and abuse protection before opening the bot broadly.
- Review privacy and data-retention requirements before storing conversation history.

## 🩺 Health & safety

SEDAR Bot provides general nutrition education. It must not be used as a substitute for individualized medical advice, diagnosis or treatment.

Users with pregnancy-related nutrition needs, eating disorders, severe allergies, diabetes medication concerns, kidney/liver disease, serious symptoms, or other complex medical conditions should be directed to an appropriate qualified healthcare professional.

Potential emergencies should be directed to emergency medical services rather than handled by the bot.

## 🔭 Roadmap

- [ ] Meta webhook signature verification
- [ ] Persistent conversation context
- [ ] Image/meal photo analysis
- [ ] Structured nutrition calculations
- [ ] Malaysian food nutrition database
- [ ] Source-aware citations in WhatsApp responses
- [ ] User preference and language memory
- [ ] Human escalation workflow
- [ ] Analytics and monitoring
- [ ] Privacy-aware conversation storage
- [ ] Admin dashboard

## Disclaimer

SEDAR Bot is an AI-powered nutrition education tool. Information provided by the bot is for general educational purposes and does not constitute medical advice, diagnosis or treatment.
