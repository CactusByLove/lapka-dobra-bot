import { mentorKeyboard, pawRequestKeyboard } from "./keyboards.js";
import { isStaff } from "./notify.js";
import { applicationText } from "./registration.js";
import { allUsers, pendingPawRequests } from "./storage.js";
import { escapeHtml } from "./texts.js";
async function requireStaff(ctx) {
    if (ctx.from && isStaff(ctx.from.id))
        return true;
    await ctx.answerCallbackQuery({
        text: "Недостаточно прав",
        show_alert: true,
    });
    return false;
}
export function registerMentor(bot) {
    bot.callbackQuery("mentor:menu", async (ctx) => {
        if (!(await requireStaff(ctx)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply("🦸 <b>Панель наставника</b>\n\nЗдесь новые заявки и начисления на проверке. Решение по заявкам принимает Главная лапка или координатор.", { parse_mode: "HTML", reply_markup: mentorKeyboard() });
    });
    bot.callbackQuery("mentor:apps", async (ctx) => {
        if (!(await requireStaff(ctx)))
            return;
        await ctx.answerCallbackQuery();
        const pending = allUsers().filter((user) => user.status === "pending");
        if (pending.length === 0) {
            await ctx.reply("Новых заявок нет — всё разобрано 🐾", {
                reply_markup: mentorKeyboard(),
            });
            return;
        }
        for (const user of pending) {
            await ctx.reply(`${applicationText(user)}\n\n<i>Решение принимает Главная лапка или координатор.</i>`, { parse_mode: "HTML", reply_markup: mentorKeyboard() });
        }
    });
    bot.callbackQuery("mentor:paws", async (ctx) => {
        if (!(await requireStaff(ctx)))
            return;
        await ctx.answerCallbackQuery();
        const requests = pendingPawRequests();
        if (requests.length === 0) {
            await ctx.reply("Начислений на проверке нет 🐾", {
                reply_markup: mentorKeyboard(),
            });
            return;
        }
        for (const request of requests) {
            await ctx.reply(`🐾 <b>${escapeHtml(request.userName)}</b>: +${request.amount}\n${escapeHtml(request.reason)}`, { parse_mode: "HTML", reply_markup: pawRequestKeyboard(request.id) });
        }
    });
}
