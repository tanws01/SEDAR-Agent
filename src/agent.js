import OpenAI from "openai";
import { exaSearch, ambiguousAssistant, assuranceEvent } from "./integrations.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const SYSTEM = `You are SEDAR, a professional AI nutrition education companion inside Telegram. Never diagnose or prescribe. Use user context. Be practical, concise, evidence-informed and Malaysia-aware. Clearly label estimates.`;

export async function answerNutritionQuestion(question, user) {
  const research = /latest|current|safe|guideline|research|study|supplement|food safety/i.test(question) ? await exaSearch(`${question} nutrition evidence Malaysia`, 4) : "";
  const response = await openai.responses.create({ model, store: false, tools: [{ type: "web_search" }], input: [{ role: "system", content: `${SYSTEM}\nUser state: ${JSON.stringify(user)}\nResearch: ${research}` }, { role: "user", content: question }] });
  const answer = response.output_text?.trim() || "I couldn't generate an answer right now.";
  await assuranceEvent({ action: "nutrition_answer", metadata: { researchUsed: Boolean(research) } });
  return answer;
}

export async function analyzeMealImage(photo, user) {
  const response = await openai.responses.create({
    model, store: false,
    input: [{ role: "user", content: [
      { type: "input_text", text: `Analyze this meal for a nutrition log. User context: ${JSON.stringify(user)}. Return JSON: name, calories, protein, carbs, fat, portionAssumptions, confidenceNote. Estimates only.` },
      { type: "input_image", image_url: `data:${photo.mimeType};base64,${photo.base64}` }
    ] }],
    text: { format: { type: "json_schema", name: "meal_estimate", strict: true, schema: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, calories: { type: "number" }, protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" }, portionAssumptions: { type: "string" }, confidenceNote: { type: "string" } }, required: ["name", "calories", "protein", "carbs", "fat", "portionAssumptions", "confidenceNote"] } } }
  });
  const meal = JSON.parse(response.output_text);
  await assuranceEvent({ action: "meal_image_analysis", metadata: { confidence: meal.confidenceNote } });
  return meal;
}
