const token = process.env.TELEGRAM_BOT_TOKEN;
const api = token ? `https://api.telegram.org/bot${token}` : null;

export function parseTelegramUpdate(body) {
  const message = body?.message;
  if (!message?.chat?.id) return null;
  const photo = message.photo?.at(-1);
  return { chatId: message.chat.id, text: message.text || message.caption || "", photo: photo ? { fileId: photo.file_id } : null };
}

export async function sendTelegramMessage(chatId, text) {
  if (!api) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const response = await fetch(`${api}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error(`Telegram sendMessage ${response.status}: ${await response.text()}`);
}

export async function setTelegramWebhook(url) {
  if (!api) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const response = await fetch(`${api}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, allowed_updates: ["message"] })
  });
  return response.json();
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
