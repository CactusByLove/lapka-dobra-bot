import { InlineKeyboard } from "grammy";
import { CALLBACKS, backToMenu, contactKeyboard, dailyKeyboard, pawRequestKeyboard, ratesKeyboard, } from "./keyboards.js";
import { deleteUserMessage, sendMenu, sendSection } from "./helpers.js";
import { isAdmin, notifyAdmins, notifyMentors } from "./notify.js";
import { addPawRequest, getUser, markDailyDone, touchStreak, } from "./storage.js";
import { sessionsStore } from "./state.js";
import { CONTACT_TEXT, DIRECTIONS_TEXT, HOW_IT_WORKS, SAFETY_TEXT, dailyTask, dealsText, escapeHtml, pawRatesText, profileText, } from "./texts.js";
function dailyIndex() {
    return Math.floor(Date.now() / 86_400_000);
}
function profileKeyboard() {
    return new InlineKeyboard()
        .text("🐾 За что дают лапки", CALLBACKS.RATES)
        .row()
        .text("⬅️ В меню", CALLBACKS.MAIN);
}
function registrationPrompt() {
    return new InlineKeyboard()
        .text("🐾 Заполнить заявку", CALLBACKS.REG_START)
        .row()
        .text("⬅️ В меню", CALLBACKS.MAIN);
}
export function registerProfile(bot) {
    bot.command("start", async (ctx) => {
        sessionsStore.clear(ctx.from.id);
        await deleteUserMessage(ctx);
        await sendMenu(ctx);
    });
    bot.command("menu", async (ctx) => {
        await deleteUserMessage(ctx);
        await sendMenu(ctx);
    });
    bot.command("help", async (ctx) => {
        await deleteUserMessage(ctx);
        await sendSection(ctx, "info", "🐾 <b>Что умеет бот</b>\n\n• принять заявку в команду\n• принять идею и провести её через модерацию\n• показать лапки, уровень и серию\n• подсказать ближайшие дела\n• ответить на вопросы о проекте\n\nВсё остальное — в меню.", backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery(CALLBACKS.MAIN, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendMenu(ctx);
    });
    bot.callbackQuery(CALLBACKS.HOW, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "info", HOW_IT_WORKS, backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery(CALLBACKS.DIRECTIONS, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "info", DIRECTIONS_TEXT, backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery(CALLBACKS.DEALS, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "info", dealsText(), backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery(CALLBACKS.SAFETY, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "info", SAFETY_TEXT, backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery(CALLBACKS.CONTACT, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "contact", CONTACT_TEXT, contactKeyboard());
    });
    bot.callbackQuery(CALLBACKS.PROFILE, async (ctx) => {
        await ctx.answerCallbackQuery();
        const user = getUser(ctx.from.id);
        if (!user) {
            await sendSection(ctx, "registration", "Ты пока не в команде. Заполни короткую заявку — откроются лапки, уровни и дела.", registrationPrompt());
            return;
        }
        await sendSection(ctx, "profile", profileText(user), profileKeyboard());
    });
    bot.callbackQuery(CALLBACKS.RATES, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "profile", pawRatesText(), ratesKeyboard());
    });
    bot.callbackQuery(CALLBACKS.DAILY, async (ctx) => {
        await ctx.answerCallbackQuery();
        const user = getUser(ctx.from.id);
        if (!user) {
            await sendSection(ctx, "registration", "«Лапка дня» — для участников команды. Заполни заявку, и начнём.", registrationPrompt());
            return;
        }
        const task = dailyTask(dailyIndex());
        await sendSection(ctx, "info", `🎯 <b>Лапка дня</b>\n\n<b>${escapeHtml(task.title)}</b>\n${escapeHtml(task.text)}\n\nОтметь выполнение — наставник или координатор подтвердит, и начислятся <b>3 лапки</b>.`, dailyKeyboard());
    });
    bot.callbackQuery("daily:done", async (ctx) => {
        const user = getUser(ctx.from.id);
        if (!user) {
            await ctx.answerCallbackQuery({
                text: "Сначала зарегистрируйся в команду",
                show_alert: true,
            });
            return;
        }
        if (!markDailyDone(user.tgId)) {
            await ctx.answerCallbackQuery({
                text: "Сегодня уже отмечено — возвращайся завтра 🐾",
                show_alert: true,
            });
            return;
        }
        await ctx.answerCallbackQuery("Отмечено!");
        const task = dailyTask(dailyIndex());
        touchStreak(user.tgId);
        const request = addPawRequest(user.tgId, user.name, 3, `Лапка дня: ${task.title}`);
        await sendSection(ctx, "info", "✅ Отмечено! <b>3 лапки</b> ушли на проверку наставнику или координатору.\nСерия без пропусков обновится в профиле.", backToMenu(isAdmin(user.tgId)));
        await notifyAdmins(ctx.api, `🐾 <b>Лапка дня</b>\n${escapeHtml(user.name)} отметил(а): ${escapeHtml(task.title)}\n+3 лапки на проверку.`, pawRequestKeyboard(request.id));
        await notifyMentors(ctx.api, `🐾 <b>Лапка дня</b>\n${escapeHtml(user.name)} отметил(а): ${escapeHtml(task.title)}\n+3 лапки на проверку.`, pawRequestKeyboard(request.id));
    });
}
