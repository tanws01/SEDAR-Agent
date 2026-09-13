import OpenAI from "openai";
import { exaSearch, ambiguousAssistant, assuranceEvent } from "./integrations.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-4o";
const SYSTEM = `You are SEDAR, a professional AI nutrition education companion inside Telegram. Never diagnose or prescribe. Use user context. Be practical, concise, evidence-informed and Malaysia-aware. Clearly label estimates.`;

export async function answerNutritionQuestion(question, user) {
  const research = /latest|current|safe|guideline|research|study|supplement|food safety/i.test(question) ? await exaSearch(`${question} nutrition evidence Malaysia`, 4) : "";
  const response = await openai.responses.create({ model, store: false, input: [{ role: "system", content: `${SYSTEM}\nUser state: ${JSON.stringify(user)}\nResearch: ${research}` }, { role: "user", content: question }] });
  const answer = response.output_text?.trim() || "I couldn't generate an answer right now.";
  await assuranceEvent({ action: "nutrition_answer", metadata: { researchUsed: Boolean(research) } });
  return answer;
}

export async function analyzeMealImage(photo, user) {
  const response = await openai.responses.create({ model, store: false, input: [{ role: "user", content: [{ type: "input_text", text: `Analyze this meal for a nutrition log. User context: ${JSON.stringify(user)}. Return JSON: name, calories, protein, carbs, fat, portionAssumptions, confidenceNote. Estimates only.` }, { type: "input_image", image_url: `data:${photo.mimeType};base64,${photo.base64}` }] }], text: { format: { type: "json_schema", name: "meal_estimate", strict: true, schema: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, portionAssumptions: { type: "string" }, confidenceNote: { type: "string" } }, required: ["name", "calories", "protein", "carbs", "fat", "portionAssumptions", "confidenceNote"] } } } });
  const meal = JSON.parse(response.output_text);
  await assuranceEvent({ action: "meal_image_analysis", metadata: { confidence: meal.confidenceNote } });
  return meal;
}

export async function planDinner(user, summary) {
  const research = await exaSearch("Malaysia dinner protein calories nasi kandar mamak economy rice", 5);
  const prompt = `Plan dinner for this user. Goal: ${JSON.stringify(user.goal || {})}. Today's intake: ${JSON.stringify(summary)}. Recent meals: ${JSON.stringify(user.meals?.slice(-5) || [])}. Research: ${research}. Give 3 Malaysian options with estimated calories/protein, explain the best option and one simple swap.`;
  const candidate = await openRouterChat(prompt, JSON.stringify(user), research);
  const polished = await openai.responses.create({ model, store: false, input: [{ role: "system", content: SYSTEM }, { role: "user", content: candidate }] });
  await ambiguousAssistant(`Create a lightweight action note for this dinner plan:\n${polished.output_text}`);
  await assuranceEvent({ action: "dinner_plan", metadata: { researched: true } });
  return `🍽️ Dinner plan\n\n${polished.output_text.trim()}`;
}

async function openRouterChat(prompt, context, research) {
  // OpenRouter is an optional model-routing layer. When it isn't configured,
  // fall back to the primary OpenAI path so dinner planning still works.
  if (!process.env.OPENROUTER_API_KEY) {
    const response = await openai.responses.create({ model, store: false, input: [{ role: "system", content: `${SYSTEM}\nContext: ${context}\nResearch: ${research}` }, { role: "user", content: prompt }] });
    return response.output_text?.trim() || "I couldn't generate an answer right now.";
  }
  const client = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY, defaultHeaders: { "HTTP-Referer": process.env.PUBLIC_BASE_URL || "http://localhost:3000", "X-OpenRouter-Title": "SEDAR" } });
  const response = await client.chat.completions.create({ model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini", messages: [{ role: "system", content: `${SYSTEM}\nContext: ${context}\nResearch: ${research}` }, { role: "user", content: prompt }] });
  return response.choices?.[0]?.message?.content?.trim() || "I couldn't generate an answer right now.";
}
