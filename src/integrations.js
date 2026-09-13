export async function exaSearch(query, numResults = 5) {
  if (!process.env.EXA_API_KEY) return "";
  const response = await fetch("https://api.exa.ai/search", { method: "POST", headers: { "x-api-key": process.env.EXA_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ query, numResults, contents: { highlights: { maxCharacters: 1200 } } }) });
  if (!response.ok) throw new Error(`Exa ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return (data.results || []).map(r => `${r.title}\n${r.url}\n${(r.highlights || []).join(" ")}`).join("\n\n");
}

export async function triggerNutritionMonitor(payload) {
  if (!process.env.TRIGGER_SECRET_KEY) return null;
  const { tasks } = await import("@trigger.dev/sdk");
  return tasks.trigger("nutrition-monitor", payload);
}

export async function ambiguousAssistant(message) {
  if (!process.env.AMBIGUOUS_API_KEY) return null;
  const response = await fetch(`${process.env.AMBIGUOUS_API_BASE || "https://app.ambiguous.ai/api"}/assistant`, { method: "POST", headers: { Authorization: `Bearer ${process.env.AMBIGUOUS_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ message, context: { audience: "agent" } }) });
  if (!response.ok) throw new Error(`Ambiguous ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function assuranceEvent(event) {
  if (!process.env.WORQ_AUDIT_URL) return null;
  const response = await fetch(process.env.WORQ_AUDIT_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.WORQ_API_KEY || ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ agent: "SEDAR", version: process.env.SEDAR_VERSION || "hackathon", event, synthetic: true }) });
  if (!response.ok) throw new Error(`Assurance endpoint ${response.status}: ${await response.text()}`);
  return response.json();
}
