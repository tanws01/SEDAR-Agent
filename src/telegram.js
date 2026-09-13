const token = process.env.TELEGRAM_BOT_TOKEN;
const api = token ? `https://api.telegram.org/bot${token}` : null;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

export function isValidTelegramWebhook(req) {
  if (!webhookSecret) return true;
  return req.get("x-telegram-bot-api-secret-token") === webhookSecret;
}

export function parseTelegramUpdate(body) {
  const message = body?.message;
  const callback = body?.callback_query;
  if (callback?.message?.chat?.id) return { type: "callback", updateId: body.update_id, chatId: callback.message.chat.id, callbackId: callback.id, data: callback.data || "", text: "" };
  if (!message?.chat?.id) return null;
  const photo = message.photo?.at(-1);
  return { type: "message", updateId: body.update_id, chatId: message.chat.id, text: message.text || message.caption || "", photo: photo ? { fileId: photo.file_id } : null };
}

async function call(method, body) {
  if (!api) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const response = await fetch(`${api}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${response.status} ${JSON.stringify(data)}`);
  return data.result;
}

export async function sendTelegramMessage(chatId, text, replyMarkup) {
  return call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup, disable_web_page_preview: true });
}

export async function sendTyping(chatId) { try { await call("sendChatAction", { chat_id: chatId, action: "typing" }); } catch {} }
export async function answerTelegramCallback(callbackId) { return call("answerCallbackQuery", { callback_query_id: callbackId }); }
export async function setTelegramCommands() {
  return call("setMyCommands", { commands: [
    { command: "start", description: "Start SEDAR" }, { command: "today", description: "Open today's dashboard" },
    { command: "goal", description: "Set your health goal" }, { command: "help", description: "See what SEDAR can do" },
    { command: "privacy", description: "Privacy & data" }, { command: "reset", description: "Reset nutrition state" }
  ] });
}
export async function setTelegramWebhook(url) {
  return call("setWebhook", { url, secret_token: webhookSecret || undefined, allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
}
export async function downloadTelegramPhoto(fileId) {
  if (!api) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const metaResponse = await fetch(`${api}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const meta = await metaResponse.json();
  if (!meta.ok) throw new Error(`Telegram getFile failed: ${JSON.stringify(meta)}`);
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${token}/${meta.result.file_path}`);
  if (!fileResponse.ok) throw new Error(`Telegram photo download failed: ${fileResponse.status}`);
  return { mimeType: fileResponse.headers.get("content-type") || "image/jpeg", base64: Buffer.from(await fileResponse.arrayBuffer()).toString("base64") };
}
