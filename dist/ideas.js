import { InlineKeyboard } from "grammy";
import { sendScreen, sendSection } from "./helpers.js";
import { backToMenu, ideaModerationKeyboard } from "./keyboards.js";
import { moderateText, moderationLine } from "./moderation.js";
import { isAdmin, notifyCreator } from "./notify.js";
import { createIdea, getUser, listPublishedIdeas } from "./storage.js";
import { sessionsStore } from "./state.js";
import { bankText, escapeHtml } from "./texts.js";
export function ideaCard(idea) {
    const check = moderateText([
        idea.title,
        idea.what,
        idea.audience,
        idea.goal,
        idea.needs,
    ]);
    return `💡 <b>Новая идея</b>

<b>${escapeHtml(idea.title)}</b>
👤 ${escapeHtml(idea.authorName)}

<b>Что:</b> ${escapeHtml(idea.what)}
<b>Для кого:</b> ${escapeHtml(idea.audience)}
<b>Зачем:</b> ${escapeHtml(idea.goal)}
<b>Нужно:</b> ${escapeHtml(idea.needs)}

🆔 <code>${idea.id}</code>

${moderationLine(check)}`;
}
function ideaRetryKeyboard() {
    return new InlineKeyboard()
        .text("💡 Попробовать снова", "idea:start")
        .row()
        .text("⬅️ В меню", "menu:home");
}
function afterIdeaKeyboard() {
    return new InlineKeyboard()
        .text("🐾 В команду", "reg:start")
        .row()
        .text("💡 Ещё идея", "idea:start")
        .text("⬅️ В меню", "menu:home");
}
export function registerIdeas(bot) {
    bot.callbackQuery("menu:bank", async (ctx) => {
        await ctx.answerCallbackQuery();
        await sendSection(ctx, "bank", bankText(listPublishedIdeas()), backToMenu(isAdmin(ctx.from.id)));
    });
    bot.callbackQuery("idea:start", async (ctx) => {
        await ctx.answerCallbackQuery();
        sessionsStore.set(ctx.from.id, { kind: "idea:title" });
        await sendScreen(ctx, "💡 <b>Твоя идея</b>\n\nЗдесь нет «не формата». Начнём с названия — как её назовём? Коротко, до 120 символов.", { parse_mode: "HTML" });
    });
}
/** Текстовые шаги приёма идеи. */
export async function ideaTextStep(ctx, session) {
    const text = (ctx.message?.text ?? "").trim();
    if (session.kind === "idea:title") {
        if (text.length < 4 || text.length > 120) {
            await sendScreen(ctx, "Название — от 4 до 120 символов. Как назовём идею?");
            return true;
        }
        sessionsStore.set(ctx.from.id, { kind: "idea:what", title: text });
        await sendScreen(ctx, "<b>Что именно хочешь сделать?</b>\nОпиши своими словами, 1–2 абзаца. Не бойся, если звучит необычно.", { parse_mode: "HTML" });
        return true;
    }
    if (session.kind === "idea:what") {
        if (text.length < 10 || text.length > 600) {
            await sendScreen(ctx, "Опиши идею подробнее — от 10 до 600 символов.");
            return true;
        }
        sessionsStore.set(ctx.from.id, {
            kind: "idea:audience",
            title: session.title,
            what: text,
        });
        await sendScreen(ctx, "<b>Для кого это?</b>\nКому станет лучше: людям, животным, двору, школе, городу?", { parse_mode: "HTML" });
        return true;
    }
    if (session.kind === "idea:audience") {
        if (text.length < 2 || text.length > 200) {
            await sendScreen(ctx, "Напиши, для кого идея, — до 200 символов.");
            return true;
        }
        sessionsStore.set(ctx.from.id, {
            kind: "idea:goal",
            title: session.title,
            what: session.what,
            audience: text,
        });
        await sendScreen(ctx, "<b>Зачем тебе это?</b>\nЧто хочешь получить в итоге: опыт, команду, изменения вокруг?", { parse_mode: "HTML" });
        return true;
    }
    if (session.kind === "idea:goal") {
        if (text.length < 2 || text.length > 200) {
            await sendScreen(ctx, "Сформулируй цель — до 200 символов.");
            return true;
        }
        sessionsStore.set(ctx.from.id, {
            kind: "idea:needs",
            title: session.title,
            what: session.what,
            audience: session.audience,
            goal: text,
        });
        await sendScreen(ctx, "<b>Что нужно для старта?</b>\nПлощадка, материалы, люди, медиа — или пока только желание. Можно написать «ничего, нужна команда».", { parse_mode: "HTML" });
        return true;
    }
    if (session.kind === "idea:needs") {
        if (text.length < 2 || text.length > 200) {
            await sendScreen(ctx, "Опиши, что нужно, — до 200 символов.");
            return true;
        }
        const check = moderateText([
            session.title,
            session.what,
            session.audience,
            session.goal,
            text,
        ]);
        if (!check.ok) {
            sessionsStore.clear(ctx.from.id);
            await sendScreen(ctx, `⚠️ <b>Идея не прошла автопроверку</b>

${check.reasons.map((reason) => `• ${escapeHtml(reason)}`).join("\n")}

Исправь формулировки и отправь заново — я рядом.`, { parse_mode: "HTML", reply_markup: ideaRetryKeyboard() });
            return true;
        }
        const userId = ctx.from.id;
        const author = getUser(userId);
        const idea = createIdea({
            authorTgId: userId,
            authorName: author?.nickname ?? author?.name ?? ctx.from.first_name ?? "Участник",
            title: session.title,
            what: session.what,
            audience: session.audience,
            goal: session.goal,
            needs: text,
        });
        sessionsStore.clear(userId);
        await sendSection(ctx, "idea", `✅ <b>Идея отправлена на модерацию</b>

Главная лапка проверит её в ближайшее время. Если всё чисто — идея появится в банке, а волонтёры получат уведомление.

Твоя идея: <b>${escapeHtml(idea.title)}</b>`, afterIdeaKeyboard());
        await notifyCreator(ctx.api, ideaCard(idea), ideaModerationKeyboard(idea.id));
        if (!author) {
            await sendScreen(ctx, "Хочешь не только предлагать, но и делать? Зарегистрируйся в команду — это добавит тебе лапки и откроет дела.", { reply_markup: new InlineKeyboard().text("🐾 Регистрация", "reg:start") });
        }
        return true;
    }
    return false;
}
