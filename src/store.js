import { createClient } from "@supabase/supabase-js";

const memory = new Map();
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;
const TIME_ZONE = process.env.SEDAR_TIME_ZONE || "Asia/Kuala_Lumpur";

const emptyUser = id => ({ id, goal: { description: "", calorieTarget: null, proteinTarget: null }, meals: [], preferences: {}, createdAt: new Date().toISOString() });

export async function getUser(id) {
  if (supabase) {
    const { data, error } = await supabase.from("sedar_users").select("*").eq("id", id).maybeSingle();
    if (!error && data) return normalize(data);
    if (error) console.error("Supabase getUser error:", error.message);
  }
  if (!memory.has(id)) memory.set(id, emptyUser(id));
  return memory.get(id);
}

export async function updateGoal(id, goal) { const user = await getUser(id); user.goal = { ...user.goal, ...goal }; return save(user); }
export async function addMeal(id, meal) { const user = await getUser(id); user.meals.push({ ...meal, loggedAt: new Date().toISOString() }); user.meals = user.meals.slice(-100); return save(user); }

export async function getDailySummary(id) {
  const user = await getUser(id); const today = localDate();
  const meals = user.meals.filter(m => m.loggedAt && localDate(new Date(m.loggedAt)) === today);
  return meals.reduce((s, m) => ({ calories: s.calories + safeNum(m.calories), protein: s.protein + safeNum(m.protein), carbs: s.carbs + safeNum(m.carbs), fat: s.fat + safeNum(m.fat), meals: s.meals + 1 }), { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

export async function resetState(id) { return save(emptyUser(id)); }

async function save(user) {
  memory.set(user.id, user);
  if (supabase) {
    const { error } = await supabase.from("sedar_users").upsert({ id: user.id, goal: user.goal, meals: user.meals, preferences: user.preferences, updated_at: new Date().toISOString() });
    if (error) console.error("Supabase save error:", error.message);
  }
  return user;
}

function normalize(row) { const user = { id: row.id, goal: row.goal || {}, meals: Array.isArray(row.meals) ? row.meals : [], preferences: row.preferences || {}, createdAt: row.created_at || new Date().toISOString() }; memory.set(user.id, user); return user; }
function safeNum(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, n) : 0; }
function localDate(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
