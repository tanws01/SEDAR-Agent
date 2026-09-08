import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PORT || 3000);
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are SEDAR Bot, a professional AI nutrition education assistant available through WhatsApp.

Your role:
- Give practical, evidence-informed nutrition education in a professional, calm and approachable tone.
- Prioritize authoritative public-health and clinical nutrition sources when current evidence is needed, especially Malaysian Ministry of Health, WHO, FAO, NHS, CDC and peer-reviewed research.
- Use web search when the question depends on current guidance, a specific product, food safety issue, or evidence that may have changed.
- Adapt examples to Malaysia when useful, including common Malaysian foods and eating patterns.
- Support English, Bahasa Melayu and Chinese. Reply in the language the user uses unless they request another language.
- For calorie or macro estimates, clearly label them as estimates and state the assumptions or portion size used.
- If information is insufficient, ask a short clarifying question instead of inventing details.

Safety boundaries:
- You are not a doctor, dietitian, pharmacist, or emergency service. Do not claim to diagnose, prescribe, or replace professional care.
- Do not diagnose medical conditions or tell users to start, stop, or change prescription medication.
- For pregnancy, eating disorders, severe allergies, diabetes medication, kidney/liver disease, serious symptoms, or other high-risk medical situations, provide general educational information and recommend speaking with an appropriate qualified healthcare professional.
- For possible emergencies (for example severe breathing difficulty, chest pain, loss of consciousness, severe allergic reaction, or signs of stroke), tell the user to seek emergency medical care immediately.
- Avoid extreme dieting, starvation, purging, or unsafe rapid-weight-loss advice.

Response style:
- Answer the user's question directly first.
- Keep WhatsApp responses easy to scan: short paragraphs and bullets where helpful.
- Do not overwhelm the user with citations. When web search is used, mention the most relevant sources naturally at the end.
- Never fabricate a study, guideline, number, citation, or food composition value.
- End with a useful next step or a brief follow-up question when appropriate.

Important disclaimer when relevant: SEDAR Bot provides general nutrition education and is not a substitute for individualized medical advice from a qualified healthcare professional.`;

app.get("/", (_req, res) => {
  res.json({ name: "SEDAR Bot", status: "ok", service: "nutrition-assistant" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  // Acknowledge Meta quickly; process the message asynchronously.
  res.sendStatus(200);

  try {
    const message = extractIncomingText(req.body);
    if (!message) return;

    if (message.text.trim().toLowerCase() === "/help") {
      await sendWhatsAppText(message.from, helpMessage());
      return;
    }

    if (message.text.trim().toLowerCase() === "/privacy") {
      await sendWhatsAppText(message.from, privacyMessage());
      return;
    }

    const response = await openai.responses.create({
      model,
      store: false,
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message.text }
      ]
    });

    const answer = response.output_text?.trim() || "Sorry, I couldn't generate an answer right now. Please try again.";
    await sendWhatsAppText(message.from, answer);
  } catch (error) {
    console.error("SEDAR webhook error:", error);
    const from = extractSender(req.body);
    if (from) {
      try {
        await sendWhatsAppText(from, "Sorry, SEDAR Bot is temporarily unavailable. Please try again in a moment.");
      } catch (sendError) {
        console.error("WhatsApp fallback error:", sendError);
      }
    }
  }
});

function extractIncomingText(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || message.type !== "text" || !message.from) return null;
  return { from: message.from, text: message.text?.body || "" };
}

function extractSender(body) {
  return body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || null;
}

async function sendWhatsAppText(to, body) {
  if (!accessToken || !phoneNumberId) {
    throw new Error("Missing WhatsApp credentials");
  }

  const url = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WhatsApp API ${response.status}: ${details}`);
  }
}

function helpMessage() {
  return `Hi, I'm SEDAR Bot 🥗\n\nI can help with:\n• Nutrition questions\n• Malaysian food choices\n• Calories & macronutrient estimates\n• Meal and portion guidance\n• Evidence-based nutrition information\n\nTry asking: “Is nasi lemak healthy?” or “How much protein should I eat?”\n\nFor medical conditions or personalized treatment, please consult a qualified healthcare professional.`;
}

function privacyMessage() {
  return `SEDAR Bot is designed for general nutrition education. Please avoid sharing passwords, financial information, identification numbers, or other unnecessary sensitive personal information. Do not use the bot for emergencies or as a substitute for professional medical care.`;
}

app.listen(port, () => {
  console.log(`SEDAR Bot listening on port ${port}`);
});
