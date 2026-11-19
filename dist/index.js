import "dotenv/config";
import { createServer } from "node:http";
import { Bot } from "grammy";
import { registerHandlers } from "./handlers.js";
import { ensureCreator } from "./storage.js";
const token = process.env.BOT_TOKEN?.trim();
if (!token) {
    console.error("BOT_TOKEN не задан.\nСкопируй bot/.env.example в bot/.env и вставь токен из @BotFather.");
    process.exit(1);
}
try {
    ensureCreator();
}
catch (error) {
    console.error("Не удалось создать аккаунт Главной лапки:", error);
}
const bot = new Bot(token);
bot.catch((error) => {
    const cause = error.error;
    if (cause?.error_code === 409) {
        console.warn("409: старый контейнер ещё держит Telegram — повторяю опрос.");
        return;
    }
    console.error("Ошибка обработчика:", error.error);
});
registerHandlers(bot);
async function main() {
    try {
        await bot.api.setMyCommands([
            { command: "start", description: "Меню «Лапки Добра»" },
            { command: "menu", description: "Открыть меню" },
            { command: "help", description: "Что умеет бот" },
        ]);
    }
    catch {
        console.warn("Не удалось обновить список команд (сеть или права).");
    }
    // Railway поднимает новый контейнер, пока старый ещё опрашивает Telegram.
    // Пауза снимает конфликт 409 при смене деплоя.
    await new Promise((resolve) => setTimeout(resolve, 8000));
    console.log("🐾 Бот «Лапка Добра» запущен");
    await bot.start();
}
void main();
// Health-эндпоинт для PaaS (Render, Koyeb, Railway): порт задаётся через PORT.
const port = Number(process.env.PORT ?? 0);
if (port > 0) {
    createServer((req, res) => {
        if (req.url === "/health" || req.url === "/") {
            res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
            res.end("ok");
            return;
        }
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
    }).listen(port, () => {
        console.log(`health endpoint on :${port}`);
    });
}
