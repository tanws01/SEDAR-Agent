const BAR = 10;

export function mainMenu() {
  return { inline_keyboard: [
    [{ text: "📸 Analyse Meal", callback_data: "menu:meal" }, { text: "📊 Dashboard", callback_data: "menu:today" }],
    [{ text: "🍽 Plan My Meal", callback_data: "menu:dinner" }, { text: "🎯 Goals", callback_data: "menu:goal" }],
    [{ text: "🧠 Ask SEDAR", callback_data: "menu:ask" }, { text: "⚙️ Personalise", callback_data: "menu:help" }]
  ] };
}

export function actionMenu(actions = []) {
  return { inline_keyboard: actions.map(a => [{ text: a.label, callback_data: a.data }]) };
}

export function welcomeCard() {
  return `🧬 <b>SEDAR</b>\n<i>Your AI Health Intelligence Agent</i>\n\nI don't just count calories.\nI connect your meals, goals and patterns — then help you decide what to do next.\n\n<b>Start anywhere.</b> Send a meal photo, set a goal, or ask me a nutrition question.`;
}

export function dashboardCard(summary, user) {
  const target = Number(user?.goal?.calorieTarget || 0);
  const proteinTarget = Number(user?.goal?.proteinTarget || 0);
  const calorieProgress = target ? `${progress(summary.calories, target)} ${Math.round(summary.calories)}/${Math.round(target)} kcal` : `${Math.round(summary.calories)} kcal`;
  const proteinProgress = proteinTarget ? `${progress(summary.protein, proteinTarget)} ${Math.round(summary.protein)}/${Math.round(proteinTarget)} g` : `${Math.round(summary.protein)} g`;
  return `📊 <b>TODAY — SEDAR DASHBOARD</b>\n\n🔥 Energy\n${calorieProgress}\n\n💪 Protein\n${proteinProgress}\n\n🥗 Meals logged: <b>${summary.meals}</b>\n🍚 Carbs: <b>${Math.round(summary.carbs)} g</b>\n🥑 Fat: <b>${Math.round(summary.fat)} g</b>\n\n🎯 <b>Current goal</b>\n${user?.goal?.description || "Not set yet"}\n\n<i>Estimates are directional, not clinical measurements.</i>`;
}

export function mealCard(meal, summary) {
  return `🍽️ <b>MEAL INTELLIGENCE</b>\n\n<b>${escapeHtml(meal.name)}</b>\n\n🔥 <b>${Math.round(meal.calories)} kcal</b>\n💪 ${Math.round(meal.protein)}g protein  ·  🍚 ${Math.round(meal.carbs)}g carbs  ·  🥑 ${Math.round(meal.fat)}g fat\n\n🔎 <b>SEDAR read</b>\n${escapeHtml(meal.portionAssumptions || "Portion estimated from the photo.")}\n\n📈 <b>Today so far:</b> ${Math.round(summary.calories)} kcal · ${Math.round(summary.protein)}g protein\n\n⚠️ ${escapeHtml(meal.confidenceNote || "Image-based estimates can vary with portion size and hidden ingredients.")}`;
}

export function errorCard() {
  return `⚠️ <b>SEDAR hit a temporary issue.</b>\n\nYour request was not lost. Please try again in a moment.`;
}

function progress(value, target) {
  const ratio = Math.max(0, Math.min(1, value / target));
  const filled = Math.round(ratio * BAR);
  return `[${"█".repeat(filled)}${"░".repeat(BAR - filled)}] ${Math.round(ratio * 100)}%`;
}

function escapeHtml(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
