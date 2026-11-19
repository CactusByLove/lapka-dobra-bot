import { adminKeyboard, applicationReviewKeyboard, backToMenu, ideaReviewKeyboard, pawRequestKeyboard, } from "./keyboards.js";
import { IDEA_STATUS_LABEL } from "./levels.js";
import { clearKeyboard } from "./helpers.js";
import { isAdmin } from "./notify.js";
import { applicationText } from "./registration.js";
import { ideaCard } from "./ideas.js";
import { allUsers, awardPaws, decidePawRequest, getIdea, getPawRequest, getUser, listIdeas, pendingPawRequests, setIdeaStatus, stats, updateUser, } from "./storage.js";
import { escapeHtml } from "./texts.js";
async function requireAdmin(ctx) {
    if (ctx.from && isAdmin(ctx.from.id))
        return true;
    await ctx.answerCallbackQuery({
        text: "Недостаточно прав",
        show_alert: true,
    });
    return false;
}
function statsText() {
    const summary = stats();
    return `📊 <b>Сводка проекта</b>

👥 Пользователи: ${summary.total}
✅ В команде: ${summary.approved}
⏳ На проверке: ${summary.pending}
💡 Идей: ${summary.ideas} (в работе — ${summary.ideasInWork})
🐾 Начислений на проверке: ${summary.pawsPending}`;
}
export function registerAdmin(bot) {
    bot.command("admin", async (ctx) => {
        if (!ctx.from || !isAdmin(ctx.from.id)) {
            await ctx.reply("Эта команда доступна координаторам проекта.");
            return;
        }
        await ctx.reply(statsText(), {
            parse_mode: "HTML",
            reply_markup: adminKeyboard(),
        });
    });
    bot.callbackQuery("admin:menu", async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply(statsText(), {
            parse_mode: "HTML",
            reply_markup: adminKeyboard(),
        });
    });
    bot.callbackQuery("admin:stats", async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        await ctx.answerCallbackQuery();
        await ctx.reply(statsText(), {
            parse_mode: "HTML",
            reply_markup: adminKeyboard(),
        });
    });
    bot.callbackQuery("admin:apps", async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        await ctx.answerCallbackQuery();
        const pending = allUsers().filter((user) => user.status === "pending");
        if (pending.length === 0) {
            await ctx.reply("Новых заявок нет — всё разобрано 🐾", {
                reply_markup: adminKeyboard(),
            });
            return;
        }
        for (const user of pending) {
            await ctx.reply(applicationText(user), {
                parse_mode: "HTML",
                reply_markup: applicationReviewKeyboard(user.tgId),
            });
        }
    });
    bot.callbackQuery("admin:ideas", async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        await ctx.answerCallbackQuery();
        const ideas = listIdeas().filter((idea) => idea.status === "review");
        if (ideas.length === 0) {
            await ctx.reply("Идей на разборе нет 🐾", { reply_markup: adminKeyboard() });
            return;
        }
        for (const idea of ideas) {
            await ctx.reply(ideaCard(idea), {
                parse_mode: "HTML",
                reply_markup: ideaReviewKeyboard(idea.id),
            });
        }
    });
    bot.callbackQuery("admin:paws", async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        await ctx.answerCallbackQuery();
        const requests = pendingPawRequests();
        if (requests.length === 0) {
            await ctx.reply("Начислений на проверке нет 🐾", {
                reply_markup: adminKeyboard(),
            });
            return;
        }
        for (const request of requests) {
            await ctx.reply(`🐾 <b>${escapeHtml(request.userName)}</b>: +${request.amount}\n${escapeHtml(request.reason)}`, { parse_mode: "HTML", reply_markup: pawRequestKeyboard(request.id) });
        }
    });
    bot.callbackQuery(/^app:(approve|reject|rework):(\d+)$/, async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        const action = ctx.match[1];
        const tgId = Number(ctx.match[2]);
        const user = getUser(tgId);
        if (!user) {
            await ctx.answerCallbackQuery({
                text: "Заявка не найдена",
                show_alert: true,
            });
            return;
        }
        if (action === "approve" &&
            user.age <= 17 &&
            !(user.parentConsent && user.parentConsentFileId)) {
            await ctx.answerCallbackQuery({
                text: "Нет документа согласия родителей — одобрить нельзя",
                show_alert: true,
            });
            return;
        }
        await ctx.answerCallbackQuery("Готово");
        await clearKeyboard(ctx);
        if (action === "approve") {
            updateUser(tgId, { status: "approved" });
            const award = awardPaws(tgId, 10, "Входной практикум");
            await ctx.reply(`✅ <b>${escapeHtml(user.name)}</b> принят(а) в команду. Начислено: +${award.granted} 🐾`, { parse_mode: "HTML" });
            await ctx.api
                .sendMessage(tgId, `🎉 <b>Ты в команде!</b>\n\nЗаявка одобрена. +${award.granted} лапок за входной практикум.\n\nДальше: чат новичков, расписание и первое дело на 2–3 часа с наставником.`, { parse_mode: "HTML", reply_markup: backToMenu(false) })
                .catch(() => undefined);
            return;
        }
        if (action === "reject") {
            updateUser(tgId, { status: "rejected" });
            await ctx.reply(`❌ Заявка ${escapeHtml(user.name)} отклонена.`);
            await ctx.api
                .sendMessage(tgId, "Заявка отклонена. Если это ошибка или хочешь уточнить — напиши координатору.", { reply_markup: backToMenu(false) })
                .catch(() => undefined);
            return;
        }
        updateUser(tgId, { status: "need_rework" });
        await ctx.reply(`🔄 По заявке ${escapeHtml(user.name)} запрошена доработка.`);
        await ctx.api
            .sendMessage(tgId, "Нужно доработать заявку: напиши координатору, что поправить — и продолжим.", { reply_markup: backToMenu(false) })
            .catch(() => undefined);
    });
    bot.callbackQuery(/^idea:st:(i\d+):(team|running|done|rejected)$/, async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        const id = ctx.match[1];
        const next = ctx.match[2];
        const idea = getIdea(id);
        if (!idea) {
            await ctx.answerCallbackQuery({
                text: "Идея не найдена",
                show_alert: true,
            });
            return;
        }
        await ctx.answerCallbackQuery("Готово");
        await clearKeyboard(ctx);
        const previous = idea.status;
        setIdeaStatus(id, next);
        let awardLine = "";
        const shouldAward = (next === "team" && previous === "review") ||
            (next === "done" && previous !== "done");
        if (shouldAward) {
            const award = awardPaws(idea.authorTgId, 25, next === "team" ? "Идея принята в команду" : "Идея реализована");
            if (award.ok)
                awardLine = ` Автору +${award.granted} 🐾.`;
        }
        const label = IDEA_STATUS_LABEL[next] ?? next;
        await ctx.reply(`💡 «${escapeHtml(idea.title)}» → <b>${label}</b>.${awardLine}`, { parse_mode: "HTML" });
        await ctx.api
            .sendMessage(idea.authorTgId, `💡 Твоя идея «${escapeHtml(idea.title)}»: <b>${label}</b>.${awardLine}`, { parse_mode: "HTML", reply_markup: backToMenu(false) })
            .catch(() => undefined);
    });
    bot.callbackQuery(/^pawreq:(yes|no):(p\d+)$/, async (ctx) => {
        if (!(await requireAdmin(ctx)))
            return;
        const approve = ctx.match[1] === "yes";
        const id = ctx.match[2];
        const request = getPawRequest(id);
        if (!request || request.status !== "pending") {
            await ctx.answerCallbackQuery({
                text: "Запрос уже обработан",
                show_alert: true,
            });
            return;
        }
        if (!approve) {
            decidePawRequest(id, "rejected");
            await ctx.answerCallbackQuery("Отклонено");
            await clearKeyboard(ctx);
            await ctx.reply(`❌ Отклонено: ${escapeHtml(request.userName)} — ${escapeHtml(request.reason)}.`);
            return;
        }
        const award = awardPaws(request.tgId, request.amount, request.reason);
        if (!award.ok) {
            await ctx.answerCallbackQuery({
                text: "Недельный лимит 100 лапок исчерпан",
                show_alert: true,
            });
            return;
        }
        decidePawRequest(id, "approved");
        await ctx.answerCallbackQuery("Подтверждено");
        await clearKeyboard(ctx);
        await ctx.reply(`✅ ${escapeHtml(request.userName)}: +${award.granted} 🐾 (${escapeHtml(request.reason)}).`);
        await ctx.api
            .sendMessage(request.tgId, `🐾 Начислено <b>+${award.granted} лапок</b>: ${escapeHtml(request.reason)}.`, { parse_mode: "HTML" })
            .catch(() => undefined);
    });
}
