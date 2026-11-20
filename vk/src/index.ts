import "dotenv/config";
import { createServer } from "node:http";
import { PORT, VK_TOKEN } from "./config.js";
import { ensureCreator } from "./storage.js";
import { vk } from "./vk.js";
import {
  attachmentString,
  handleCallbackEvent,
  handleMessageEvent,
} from "./bot.js";

if (!VK_TOKEN) {
  console.error(
    "VK_TOKEN не задан. Скопируй .env.example в .env и вставь ключ сообщества.",
  );
  process.exit(1);
}

try {
  ensureCreator();
} catch (error) {
  console.error("Не удалось создать аккаунт Главной лапки:", error);
}

vk.updates.on("message_new", async (context: any) => {
  try {
    console.log(
      "message_new:",
      context.senderId,
      String(context.text ?? "").slice(0, 80),
    );
    const attachments = (context.attachments ?? [])
      .map((attachment: any) => attachmentString(attachment))
      .filter(Boolean);
    await handleMessageEvent({
      userId: context.senderId ?? context.userId ?? 0,
      peerId: context.peerId,
      text: context.text ?? "",
      attachments,
      payload: context.messagePayload ?? undefined,
    });
  } catch (error) {
    console.error("message_new:", error);
  }
});

vk.updates.on("message_event", async (context: any) => {
  try {
    console.log("message_event:", context.userId, context.eventPayload);
    await handleCallbackEvent({
      userId: context.userId ?? 0,
      peerId: context.peerId,
      eventId: String(context.eventId ?? ""),
      payload: (context.eventPayload ?? {}) as Record<string, unknown>,
    });
  } catch (error) {
    console.error("message_event:", error);
  }
});

void (async () => {
  try {
    await vk.updates.start();
    console.log("🐾 VK-бот запущен");
  } catch (error) {
    console.error("Не удалось запустить LongPoll:", error);
    process.exit(1);
  }
})();

if (PORT > 0) {
  createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }).listen(PORT, () => {
    console.log(`health endpoint on :${PORT}`);
  });
}
