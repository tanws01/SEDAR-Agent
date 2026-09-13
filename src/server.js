import express from "express";
import { createCopilotExpressHandler } from "@copilotkit/runtime/v2/express";
import { CopilotRuntime, BuiltInAgent } from "@copilotkit/runtime/v2";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser, addMeal, updateGoal, getDailySummary, resetState } from "./store.js";
import { answerNutritionQuestion, analyzeMealImage, planDinner } from "./agent.js";
import { sendTelegramMessage, setTelegramWebhook, setTelegramCommands, parseTelegramUpdate, downloadTelegramPhoto, isValidTelegramWebhook, sendTyping, answerTelegramCallback } from "./telegram.js";
import { triggerNutritionMonitor } from "./integrations.js";
import { mainMenu, actionMenu, welcomeCard, dashboardCard, mealCard, errorCard } from "./ui.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
const port = Number(process.env.PORT || 3000);
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const processedUpdates = new Map();

const copilotRuntime = new CopilotRuntime({ agents: { default: new BuiltInAgent({ model: process.env.COPILOTKIT_MODEL || "openai/gpt-5-mini", prompt: "You are the SEDAR Agent nutrition operations copilot. Help review nutrition state, meal logs, goals and agent decisions. Do not diagnose or prescribe." }) } });

app.get("/", (_req, res) => res.json({ name: "SEDAR Agent", status: "ok", channel: "telegram", agent: true, version: "3.0.0" }));
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), agent: "SEDAR Agent" }));
app.use(createCopilotExpressHandler({ runtime: copilotRuntime, basePath: "/api/copilotkit", cors: true }));
app.get("/dashboard", (_req, res) => res.sendFile("dashboard.html", { root: new URL("../public", import.meta.url).pathname }));

app.post("/telegram/webhook", async (req, res) => {
  if (!isValidTelegramWebhook(req)) return res.sendStatus(401);
  res.sendStatus(200);
  const update = parseTelegramUpdate(req.body);
  if (!update) return;
  if (update.updateId != null && processedUpdates.has(update.updateId)) return;
  if (update.updateId != null) { processedUpdates.set(update.updateId, Date.now()); if (processedUpdates.size > 500) processedUpdates.delete(processedUpdates.keys().next().value); }
  try { await handleTelegramUpdate(update); }
  catch (error) {
    console.error("SEDAR Agent Telegram error:", error);
    try { await sendTelegramMessage(update.chatId, errorCard(), mainMenu()); } catch (sendError) { console.error("SEDAR fallback error:", sendError); }
  }
});

async function handleTelegramUpdate(update) {
  if (update.type === "callback") return handleCallback(update);
  const userId = String(update.chatId);
  const text = update.text?.trim() || "";
  if (text === "/start") return sendTelegramMessage(update.chatId, welcomeCard(), mainMenu());
  if (text === "/help") return sendTelegramMessage(update.chatId, helpMessage(), mainMenu());
  if (text === "/privacy") return sendTelegramMessage(update.chatId, privacyMessage(), mainMenu());
  if (text.startsWith("/goal ")) {
    const goal = text.slice(6).trim();
    if (!goal) return sendTelegramMessage(update.chatId, "🎯 Tell me the goal after /goal.\nExample: /goal build muscle while staying lean", mainMenu());
    await updateGoal(userId, { description: goal });
    return sendTelegramMessage(update.chatId, `🎯 <b>Goal saved.</b>\n\n${escapeHtml(goal)}\n\nSEDAR will use this context when recommending meals.`, mainMenu());
  }
  if (text === "/today") return sendDashboard(update.chatId, userId);
  if (text === "/reset") { await resetState(userId); return sendTelegramMessage(update.chatId, "♻️ <b>Nutrition state reset.</b>\n\nSEDAR is ready for a fresh start.", mainMenu()); }

  if (update.photo) {
    await sendTyping(update.chatId);
    const meal = await analyzeMealImage(await downloadTelegramPhoto(update.photo.fileId), await getUser(userId));
    await addMeal(userId, meal);
    const summary = await getDailySummary(userId);
    await sendTelegramMessage(update.chatId, mealCard(meal, summary), actionMenu([
      { label: "🍽 Plan My Next Meal", data: "menu:dinner" }, { label: "📊 Today's Dashboard", data: "menu:today" }, { label: "🧠 Ask SEDAR", data: "menu:ask" }
    ]));
    await triggerNutritionMonitor({ userId, chatId: update.chatId, reason: "meal_logged" });
    return;
  }

  const user = await getUser(userId);
  if (/plan my dinner|what should i eat|dinner/i.test(text)) {
    await sendTyping(update.chatId);
    return sendTelegramMessage(update.chatId, await planDinner(user, await getDailySummary(userId)), actionMenu([{ label: "📊 Dashboard", data: "menu:today" }, { label: "🧠 Ask SEDAR", data: "menu:ask" }]));
  }
  if (!text) return sendTelegramMessage(update.chatId, helpMessage(), mainMenu());
  await sendTyping(update.chatId);
  await sendTelegramMessage(update.chatId, await answerNutritionQuestion(text, user), mainMenu());
  await triggerNutritionMonitor({ userId, chatId: update.chatId, reason: "conversation" });
}

async function handleCallback(update) {
  await answerTelegramCallback(update.callbackId).catch(() => {});
  const userId = String(update.chatId);
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

app.listen(port, () => console.log(`SEDAR Agent listening on :${port}`));

function helpMessage() { return `🧬 <b>SEDAR — AI Health Intelligence Agent</b>\n\n<b>What I can do</b>\n📸 Analyse meal photos\n📊 Track today's nutrition\n🍽 Recommend your next meal\n🎯 Remember your goal\n🧠 Answer nutrition questions\n\n<b>Try</b>\n• Send a food photo\n• “Plan my dinner”\n• /today\n• /goal build muscle while staying lean\n\n<i>SEDAR provides general nutrition education and estimates. It does not diagnose or prescribe.</i>`; }
function privacyMessage() { return `🔐 <b>Privacy</b>\n\nSEDAR stores nutrition context needed to personalise the agent. Avoid sending passwords, ID numbers, financial information or other unnecessary sensitive data.\n\nUse /reset to clear your nutrition state.`; }
function escapeHtml(value = "") { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
