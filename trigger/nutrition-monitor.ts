import { task } from "@trigger.dev/sdk";
import OpenAI from "openai";

export const nutritionMonitor = task({
  id: "nutrition-monitor",
  retry: { maxAttempts: 3 },
  run: async (payload: { userId: string; chatId: number; reason: string }) => {
    const { createClient } = await import("@supabase/supabase-js");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { skipped: true };
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: user } = await db.from("sedar_users").select("*").eq("id", payload.userId).maybeSingle();
    if (!user) return { skipped: true, reason: "not found" };
    const today = new Date().toISOString().slice(0, 10);
    const meals = (user.meals || []).filter((m: any) => m.loggedAt?.slice(0, 10) === today);
    const calories = meals.reduce((s: number, m: any) => s + Number(m.calories || 0), 0);
    const protein = meals.reduce((s: number, m: any) => s + Number(m.protein || 0), 0);
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await ai.responses.create({ model: process.env.OPENAI_MODEL || "gpt-5.6-luna", store: false, input: `You are SEDAR's proactive monitor. Goal: ${JSON.stringify(user.goal || {})}. Today: ${calories} kcal, ${protein}g protein, ${meals.length} meals. Decide whether a short Telegram nudge is useful. If yes output one message under 240 characters. Otherwise output NO_NUDGE.` });
    const message = response.output_text?.trim() || "NO_NUDGE";
    if (message !== "NO_NUDGE" && process.env.TELEGRAM_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: payload.chatId, text: `🧭 SEDAR check-in\n\n${message}` }) });
    }
    return { message, calories, protein, reason: payload.reason };
  }
});
