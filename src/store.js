import { createClient } from "@supabase/supabase-js";

const memory = new Map();
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;

export async function getUser(id) {
  if (supabase) {
    const { data, error } = await supabase.from("sedar_users").select("*").eq("id", id).maybeSingle();
    if (!error && data) return normalize(data);
  }
  if (!memory.has(id)) memory.set(id, { id, goal: { description: "", calorieTarget: null, proteinTarget: null }, meals: [], preferences: {} });
  return memory.get(id);
}

export async function updateGoal(id, goal) { const user = await getUser(id); user.goal = { ...user.goal, ...goal }; return save(user); }
export async function addMeal(id, meal) { const user = await getUser(id); user.meals.push({ ...meal, loggedAt: new Date().toISOString() }); user.meals = user.meals.slice(-50); return save(user); }

export async function getDailySummary(id) {
  const user = await getUser(id); const today = new Date().toISOString().slice(0, 10);
  const meals = user.meals.filter(m => m.loggedAt?.slice(0, 10) === today);
  return meals.reduce((s, m) => ({ calories: s.calories + Number(m.calories || 0), protein: s.protein + Number(m.protein || 0), carbs: s.carbs + Number(m.carbs || 0), fat: s.fat + Number(m.fat || 0), meals: s.meals + 1 }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

export async function resetState(id) { return save({ id, goal: { description: "", calorieTarget: null, proteinTarget: null }, meals: [], preferences: {} }); }

async function save(user) {
  memory.set(user.id, user);
  if (supabase) await supabase.from("sedar_users").upsert({ id: user.id, goal: user.goal, meals: user.meals, preferences: user.preferences, updated_at: new Date().toISOString() });
  return user;
}
function normalize(row) { const user = { id: row.id, goal: row.goal || {}, meals: row.meals || [], preferences: row.preferences || {} }; memory.set(user.id, user); return user; }
