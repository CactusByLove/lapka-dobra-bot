import { InlineKeyboard, type Bot, type Context } from "grammy";
import { backToMenu, ideaReviewKeyboard } from "./keyboards.js";
import { isAdmin, notifyAdmins } from "./notify.js";
import { createIdea, getUser, listIdeas } from "./storage.js";
import { sessionsStore, type Session } from "./state.js";
import { bankText, escapeHtml } from "./texts.js";
import type { IdeaRecord } from "./types.js";

export function ideaCard(idea: IdeaRecord): string {
  return `💡 <b>Новая идея</b>

<b>${escapeHtml(idea.title)}</b>
👤 ${escapeHtml(idea.authorName)}

<b>Что:</b> ${escapeHtml(idea.what)}
<b>Для кого:</b> ${escapeHtml(idea.audience)}
<b>Зачем:</b> ${escapeHtml(idea.goal)}
<b>Нужно:</b> ${escapeHtml(idea.needs)}

🆔 <code>${idea.id}</code>`;
}

function afterIdeaKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🐾 В команду", "reg:start")
    .row()
    .text("💡 Ещё идея", "idea:start")
    .text("⬅️ В меню", "menu:home");
}

export function registerIdeas(bot: Bot): void {
  bot.callbackQuery("menu:bank", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(bankText(listIdeas()), {
      parse_mode: "HTML",
      reply_markup: backToMenu(isAdmin(ctx.from!.id)),
    });
  });

  bot.callbackQuery("idea:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    sessionsStore.set(ctx.from!.id, { kind: "idea:title" });
    await ctx.reply(
      "💡 <b>Твоя идея</b>\n\nЗдесь нет «не формата». Начнём с названия — как её назовём? Коротко, до 120 символов.",
      { parse_mode: "HTML" },
    );
  });
}

/** Текстовые шаги приёма идеи. */
export async function ideaTextStep(
  ctx: Context,
  session: Session,
): Promise<boolean> {
  const text = (ctx.message?.text ?? "").trim();

  if (session.kind === "idea:title") {
    if (text.length < 4 || text.length > 120) {
      await ctx.reply("Название — от 4 до 120 символов. Как назовём идею?");
      return true;
    }
    sessionsStore.set(ctx.from!.id, { kind: "idea:what", title: text });
    await ctx.reply(
      "<b>Что именно хочешь сделать?</b>\nОпиши своими словами, 1–2 абзаца. Не бойся, если звучит необычно.",
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "idea:what") {
    if (text.length < 10 || text.length > 600) {
      await ctx.reply("Опиши идею подробнее — от 10 до 600 символов.");
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "idea:audience",
      title: session.title,
      what: text,
    });
    await ctx.reply(
      "<b>Для кого это?</b>\nКому станет лучше: людям, животным, двору, школе, городу?",
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "idea:audience") {
    if (text.length < 2 || text.length > 200) {
      await ctx.reply("Напиши, для кого идея, — до 200 символов.");
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "idea:goal",
      title: session.title,
      what: session.what,
      audience: text,
    });
    await ctx.reply(
      "<b>Зачем тебе это?</b>\nЧто хочешь получить в итоге: опыт, команду, изменения вокруг?",
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "idea:goal") {
    if (text.length < 2 || text.length > 200) {
      await ctx.reply("Сформулируй цель — до 200 символов.");
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "idea:needs",
      title: session.title,
      what: session.what,
      audience: session.audience,
      goal: text,
    });
    await ctx.reply(
      "<b>Что нужно для старта?</b>\nПлощадка, материалы, люди, медиа — или пока только желание. Можно написать «ничего, нужна команда».",
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "idea:needs") {
    if (text.length < 2 || text.length > 200) {
      await ctx.reply("Опиши, что нужно, — до 200 символов.");
      return true;
    }

    const userId = ctx.from!.id;
    const author = getUser(userId);
    const idea = createIdea({
      authorTgId: userId,
      authorName: author?.name ?? ctx.from!.first_name ?? "Участник",
      title: session.title,
      what: session.what,
      audience: session.audience,
      goal: session.goal,
      needs: text,
    });
    sessionsStore.clear(userId);

    await ctx.reply(
      `✅ <b>Идея отправлена на разбор!</b>

Наставник или координатор ответит в течение 3 дней. Дальше — доработка, команда и реализация.

Твоя идея: <b>${escapeHtml(idea.title)}</b>`,
      { parse_mode: "HTML", reply_markup: afterIdeaKeyboard() },
    );

    await notifyAdmins(
      ctx.api,
      ideaCard(idea),
      ideaReviewKeyboard(idea.id),
    );

    if (!author) {
      await ctx.reply(
        "Хочешь не только предлагать, но и делать? Зарегистрируйся в команду — это добавит тебе лапки и откроет дела.",
        { reply_markup: new InlineKeyboard().text("🐾 Регистрация", "reg:start") },
      );
    }
    return true;
  }

  return false;
}
