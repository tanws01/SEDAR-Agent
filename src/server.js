import express from "express";
import { CopilotRuntime, OpenAIAdapter } from "@copilotkit/runtime";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser, getDailySummary, upsertUser, logMeal, resetUser } from "./store.js";
import { runAgent, analyseMealImage, planDinner, nextBestAction } from "./agent.js";
import { isValidTelegramWebhook, parseTelegramUpdate, sendTelegramMessage, sendTyping, setTelegramWebhook, setTelegramCommands } from "./telegram.js";
import { createHealthCheck, getIntegrationStatus } from "./integrations.js";
import { dashboardCard, mealCard, mainMenu, actionMenu } from "./ui.js";

const app = express();
const port = process.env.PORT || 3000;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => res.json({ name: "SEDAR Agent", status: "ok", channel: "telegram", agent: true, version: "3.0.0" }));
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), agent: "SEDAR Agent", channel: "telegram" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), agent: "SEDAR Agent", channel: "telegram" }));

app.post("/telegram/webhook", async (req, res) => {
  if (!isValidTelegramWebhook(req)) return res.sendStatus(401);
  res.sendStatus(200);
  try {
    const update = parseTelegramUpdate(req.body);
    if (!update) return;
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error("Telegram update error", error);
  }
});

async function handleTelegramUpdate(update) {
  const userId = String(update.userId);
  await upsertUser(userId, update.username || update.firstName || "Telegram user");

  if (update.type === "command" && update.command === "start") {
    return sendTelegramMessage(update.chatId, "🧬 <b>SEDAR</b>\n\nYour personal health intelligence agent.\n\nI don't just count calories. I learn your patterns. I understand your meals. I watch your progress. I help you make better decisions.", mainMenu());
  }
  if (update.type === "command" && update.command === "today") return sendDashboard(update.chatId, userId);
  if (update.type === "command" && update.command === "reset") {
    await resetUser(userId);
    return sendTelegramMessage(update.chatId, "🧹 Your SEDAR nutrition context has been reset.", mainMenu());
  }
  if (update.type === "command" && update.command === "goal") {
    const goal = update.text?.replace(/^\/goal\s*/i, "").trim();
    if (!goal) return sendTelegramMessage(update.chatId, "🎯 <b>Set your goal</b>\n\nUse:\n<code>/goal your goal here</code>", mainMenu());
    await upsertUser(userId, undefined, { goal });
    return sendTelegramMessage(update.chatId, `🎯 <b>Goal saved</b>\n\n${escapeHtml(goal)}\n\nI'll use this goal when analysing meals and planning your next action.`, mainMenu());
  }

  if (update.type === "photo") {
    await sendTyping(update.chatId);
    const result = await analyseMealImage(update.imageUrl, await getUser(userId));
    await logMeal(userId, result);
    return sendTelegramMessage(update.chatId, mealCard(result), actionMenu([{ label: "🍽 What should I do now?", data: "menu:dinner" }, { label: "📊 Dashboard", data: "menu:today" }]));
  }

  if (update.type === "callback") {
    if (update.data === "menu:today") return sendDashboard(update.chatId, userId);
    if (update.data === "menu:dinner") {
      await sendTyping(update.chatId);
      return sendTelegramMessage(update.chatId, await planDinner(await getUser(userId), await getDailySummary(userId)), actionMenu([{ label: "📊 Dashboard", data: "menu:today" }, { label: "🎯 Goals", data: "menu:goal" }]));
    }
    if (update.data === "menu:meal") return sendTelegramMessage(update.chatId, "📸 <b>Analyse a meal</b>\n\nSend SEDAR a clear photo of your meal.\n\nI'll estimate the visible food, portion size and macros, log it, then tell you what to do next.", mainMenu());
    if (update.data === "menu:goal") return sendTelegramMessage(update.chatId, "🎯 <b>Set your goal</b>\n\nUse:\n<code>/goal your goal here</code>\n\nExample:\n<code>/goal build muscle while staying lean</code>", mainMenu());
    if (update.data === "menu:ask") return sendTelegramMessage(update.chatId, "🧠 <b>Ask SEDAR</b>\n\nJust type your nutrition question naturally.\n\nExamples:\n• Is this breakfast balanced?\n• What should I eat after training?\n• How can I get more protein today?", mainMenu());
    if (update.data === "menu:help") return sendTelegramMessage(update.chatId, helpMessage(), mainMenu());
  }
}

async function sendDashboard(chatId, userId) {
  const user = await getUser(userId);
  return sendTelegramMessage(chatId, dashboardCard(await getDailySummary(userId), user), mainMenu());
}

app.post("/telegram/set-webhook", async (req, res) => {
  if (!telegramToken || !process.env.ADMIN_SETUP_TOKEN || req.get("x-sedar-admin-token") !== process.env.ADMIN_SETUP_TOKEN) return res.sendStatus(401);
  const webhookUrl = req.body?.url || `${process.env.PUBLIC_BASE_URL}/telegram/webhook`;
  const result = await setTelegramWebhook(webhookUrl);
  await setTelegramCommands();
  res.json({ ok: true, webhook: result, commands: true });
});

const checkJwt = process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE ? auth({ audience: process.env.AUTH0_AUDIENCE, issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`, tokenSigningAlg: "RS256" }) : (_req, _res, next) => next();
app.get("/api/admin/user/:id", checkJwt, async (req, res) => res.json(await getUser(req.params.id)));
app.get("/api/admin/summary/:id", checkJwt, async (req, res) => res.json(await getDailySummary(req.params.id)));

export { app };

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`SEDAR Agent listening on :${port}`));
}

function helpMessage() { return `🧬 <b>SEDAR — AI Health Intelligence Agent</b>\n\n<b>What I can do</b>\n📸 Analyse meal photos\n📊 Track today's nutrition\n🍽 Recommend your next meal\n🎯 Remember your goal\n🧠 Answer nutrition questions\n\n<b>Try</b>\n• Send a food photo\n• “Plan my dinner”\n• /today\n• /goal build muscle while staying lean\n\n<i>SEDAR provides general nutrition education and estimates. It does not diagnose or prescribe.</i>`; }
function privacyMessage() { return `🔐 <b>Privacy</b>\n\nSEDAR stores nutrition context needed to personalise the agent. Avoid sending passwords, ID numbers, financial information or other unnecessary sensitive data.\n\nUse /reset to clear your nutrition state.`; }
function escapeHtml(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }