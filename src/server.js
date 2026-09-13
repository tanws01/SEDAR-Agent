import express from "express";
import { createCopilotExpressHandler } from "@copilotkit/runtime/v2/express";
import { CopilotRuntime, BuiltInAgent } from "@copilotkit/runtime/v2";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser, addMeal, updateGoal, getDailySummary, resetState } from "./store.js";
import { answerNutritionQuestion, analyzeMealImage, planDinner } from "./agent.js";
import { sendTelegramMessage, setTelegramWebhook, parseTelegramUpdate, downloadTelegramPhoto } from "./telegram.js";
import { triggerNutritionMonitor } from "./integrations.js";

const app = express();
app.use(express.json({ limit: "10mb" }));
const port = Number(process.env.PORT || 3000);
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;

const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: process.env.COPILOTKIT_MODEL || "openai/gpt-5-mini",
      prompt: "You are the SEDAR Agent nutrition operations copilot. Help review nutrition state, meal logs, goals and agent decisions. Do not diagnose or prescribe."
    })
  }
});

app.get("/", (_req, res) => res.json({ name: "SEDAR Agent", status: "ok", channel: "telegram", agent: true }));
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString(), agent: "SEDAR Agent" }));

app.use(createCopilotExpressHandler({ runtime: copilotRuntime, basePath: "/api/copilotkit", cors: true }));
app.get("/dashboard", (_req, res) => res.sendFile("dashboard.html", { root: new URL("../public", import.meta.url).pathname }));

app.post("/telegram/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const update = parseTelegramUpdate(req.body);
    if (!update) return;
    const userId = String(update.chatId);
    const text = update.text?.trim() || "";

    if (text === "/start" || text === "/help") return void await sendTelegramMessage(update.chatId, helpMessage());
    if (text === "/privacy") return void await sendTelegramMessage(update.chatId, privacyMessage());
    if (text.startsWith("/goal ")) {
      const goal = text.slice(6).trim();
      await updateGoal(userId, { description: goal });
      return void await sendTelegramMessage(update.chatId, `Saved. Your current goal is now: ${goal}`);
    }
    if (text === "/today") return void await sendTelegramMessage(update.chatId, formatSummary(await getDailySummary(userId)));
    if (text === "/reset") {
      await resetState(userId);
      return void await sendTelegramMessage(update.chatId, "Your SEDAR Agent nutrition state has been reset.");
    }

    if (update.photo) {
      const meal = await analyzeMealImage(await downloadTelegramPhoto(update.photo.fileId), await getUser(userId));
      await addMeal(userId, meal);
      const summary = await getDailySummary(userId);
      await sendTelegramMessage(update.chatId, mealReply(meal, summary));
      await triggerNutritionMonitor({ userId, chatId: update.chatId, reason: "meal_logged" });
      return;
    }

    const user = await getUser(userId);
    if (/plan my dinner|what should i eat|dinner/i.test(text)) {
      return void await sendTelegramMessage(update.chatId, await planDinner(user, await getDailySummary(userId)));
    }

    await sendTelegramMessage(update.chatId, await answerNutritionQuestion(text, user));
    await triggerNutritionMonitor({ userId, chatId: update.chatId, reason: "conversation" });
  } catch (error) {
    console.error("SEDAR Agent Telegram error:", error);
    const chatId = parseTelegramUpdate(req.body)?.chatId;
    if (chatId) await sendTelegramMessage(chatId, "SEDAR Agent is temporarily unavailable. Please try again in a moment.");
  }
});

app.post("/telegram/set-webhook", async (req, res) => {
  if (!telegramToken || req.get("x-sedar-admin-token") !== process.env.ADMIN_SETUP_TOKEN) return res.sendStatus(401);
  const webhookUrl = req.body?.url || `${process.env.PUBLIC_BASE_URL}/telegram/webhook`;
  res.json(await setTelegramWebhook(webhookUrl));
});

const checkJwt = process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE
  ? auth({ audience: process.env.AUTH0_AUDIENCE, issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`, tokenSigningAlg: "RS256" })
  : (_req, _res, next) => next();

app.get("/api/admin/user/:id", checkJwt, async (req, res) => res.json(await getUser(req.params.id)));
app.get("/api/admin/summary/:id", checkJwt, async (req, res) => res.json(await getDailySummary(req.params.id)));

app.listen(port, () => console.log(`SEDAR Agent listening on :${port}`));

function helpMessage() {
  return `🥗 SEDAR Agent — your AI nutrition companion\n\nSend me a meal photo and I'll estimate what's on your plate, update today's nutrition state and help you decide what to eat next.\n\nTry:\n• Send a food photo\n• “Plan my dinner”\n• /today\n• /goal build muscle while staying lean\n• /privacy\n\nSEDAR Agent provides general nutrition education, not diagnosis or treatment.`;
}
function privacyMessage() {
  return `SEDAR Agent stores only the nutrition context needed to make the agent useful. Avoid sending passwords, ID numbers, financial data or other unnecessary sensitive information. You can reset your nutrition state with /reset.`;
}
function formatSummary(summary) {
  return `📊 Today\nCalories: ${Math.round(summary.calories)} kcal\nProtein: ${Math.round(summary.protein)} g\nCarbs: ${Math.round(summary.carbs)} g\nFat: ${Math.round(summary.fat)} g\nMeals logged: ${summary.meals}`;
}
function mealReply(meal, summary) {
  return `🍽️ Meal logged\n${meal.name}\n≈ ${meal.calories} kcal · ${meal.protein}g protein · ${meal.carbs}g carbs · ${meal.fat}g fat\n\nToday so far: ${Math.round(summary.calories)} kcal · ${Math.round(summary.protein)}g protein\n\n${meal.confidenceNote || "These are estimates based on the visible portion."}\n\nAsk “plan my dinner” and SEDAR Agent will use today's intake + your goal to recommend what to eat next.`;
}
