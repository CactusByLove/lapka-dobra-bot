import { InlineKeyboard } from "grammy";
import { CALLBACKS, backToMenu, contactKeyboard, dailyKeyboard, ratesKeyboard, } from "./keyboards.js";
import { sendMenu } from "./helpers.js";
import { isAdmin, notifyAdmins } from "./notify.js";
import { addPawRequest, getUser, markDailyDone, touchStreak, } from "./storage.js";
import { pawRequestKeyboard } from "./keyboards.js";
import { sessionsStore } from "./state.js";
import { CONTACT_TEXT, DIRECTIONS_TEXT, HOW_IT_WORKS, MERCH_TEXT, SAFETY_TEXT, dailyTask, dealsText, escapeHtml, pawRatesText, profileText, } from "./texts.js";
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
        await sendMenu(ctx);
    });
    bot.command("menu", async (ctx) => {
        await sendMenu(ctx);
    });
    bot.command("help", async (ctx) => {
        await ctx.reply("🐾 <b>Что умеет бот</b>\n\n• принять заявку в команду\n• принять идею и провести её через разбор\n• показать лапки, уровень и серию\n• подсказать ближайшие дела\n• ответить на вопросы о проекте\n\nВсё остальное — в меню.", {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.MAIN, async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendMenu(ctx);
    });
    bot.callbackQuery(CALLBACKS.HOW, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(HOW_IT_WORKS, {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.DIRECTIONS, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(DIRECTIONS_TEXT, {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.MERCH, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(MERCH_TEXT, {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.DEALS, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(dealsText(), {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.SAFETY, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(SAFETY_TEXT, {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(ctx.from.id)),
        });
    });
    bot.callbackQuery(CALLBACKS.CONTACT, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(CONTACT_TEXT, {
            parse_mode: "HTML",
            reply_markup: contactKeyboard(),
            link_preview_options: { is_disabled: true },
        });
    });
    bot.callbackQuery(CALLBACKS.PROFILE, async (ctx) => {
        await ctx.answerCallbackQuery();
        const user = getUser(ctx.from.id);
        if (!user) {
            await ctx.reply("Ты пока не в команде. Заполни короткую заявку — откроются лапки, уровни и дела.", { reply_markup: registrationPrompt() });
            return;
        }
        await ctx.reply(profileText(user), {
            parse_mode: "HTML",
            reply_markup: profileKeyboard(),
        });
    });
    bot.callbackQuery(CALLBACKS.RATES, async (ctx) => {
        await ctx.answerCallbackQuery();
        await ctx.reply(pawRatesText(), {
            parse_mode: "HTML",
            reply_markup: ratesKeyboard(),
        });
    });
    bot.callbackQuery(CALLBACKS.DAILY, async (ctx) => {
        await ctx.answerCallbackQuery();
        const user = getUser(ctx.from.id);
        if (!user) {
            await ctx.reply("«Лапка дня» — для участников команды. Заполни заявку, и начнём.", { reply_markup: registrationPrompt() });
            return;
        }
        const task = dailyTask(dailyIndex());
        await ctx.reply(`🎯 <b>Лапка дня</b>\n\n<b>${escapeHtml(task.title)}</b>\n${escapeHtml(task.text)}\n\nОтметь выполнение — координатор подтвердит, и начислятся <b>3 лапки</b>.`, { parse_mode: "HTML", reply_markup: dailyKeyboard() });
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
        await ctx.reply("✅ Отмечено! <b>3 лапки</b> ушли на проверку координатору.\nСерия без пропусков обновится в профиле.", {
            parse_mode: "HTML",
            reply_markup: backToMenu(isAdmin(user.tgId)),
        });
        await notifyAdmins(ctx.api, `🐾 <b>Лапка дня</b>\n${escapeHtml(user.name)} отметил(а): ${escapeHtml(task.title)}\n+3 лапки на проверку.`, pawRequestKeyboard(request.id));
    });
}
