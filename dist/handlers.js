import { InlineKeyboard } from "grammy";
import { registerAdmin } from "./admin.js";
import { ideaTextStep, registerIdeas } from "./ideas.js";
import { registerProfile } from "./profile.js";
import { regMediaStep, regTextStep, registerRegistration } from "./registration.js";
import { sessionsStore } from "./state.js";
import { CALLBACKS } from "./keyboards.js";
function menuKeyboard() {
    return new InlineKeyboard().text("🐾 В меню", CALLBACKS.MAIN);
}
export function registerHandlers(bot) {
    registerProfile(bot);
    registerRegistration(bot);
    registerIdeas(bot);
    registerAdmin(bot);
    // Текстовые шаги диалогов: имя, возраст, вопросы идеи.
    bot.on("message:text", async (ctx) => {
        const session = sessionsStore.get(ctx.from.id);
        if (!session) {
            await ctx.reply("Я рядом 🐾 Открой меню — там заявка в команду, идеи, лапки и ближайшие дела.", { reply_markup: menuKeyboard() });
            return;
        }
        if (await regTextStep(ctx, session))
            return;
        if (await ideaTextStep(ctx, session))
            return;
        await ctx.reply("Не понял шаг. Открой меню и начни заново.", {
            reply_markup: menuKeyboard(),
        });
    });
    // Документ согласия родителей.
    bot.on(["message:photo", "message:document"], async (ctx) => {
        const session = sessionsStore.get(ctx.from.id);
        if (!session)
            return;
        if (session.kind === "reg:consentDoc") {
            await regMediaStep(ctx, session);
            return;
        }
        if (session.kind.startsWith("reg:") || session.kind.startsWith("idea:")) {
            await ctx.reply("Сейчас это не нужно — продолжим по шагам. Отправь текст.");
        }
    });
    // Всё остальное: стикеры, голосовые и прочее.
    bot.on("message", async (ctx) => {
        await ctx.reply("Я понимаю текст, фото и файлы. Открой меню кнопкой ниже.", {
            reply_markup: menuKeyboard(),
        });
    });
}
