import { InlineKeyboard, type Bot, type Context } from "grammy";
import {
  adminKeyboard,
  applicationReviewKeyboard,
  backToMenu,
  deleteUserKeyboard,
  ideaModerationKeyboard,
  ideaReviewKeyboard,
  pawRequestKeyboard,
  userCardKeyboard,
  usersNavKeyboard,
} from "./keyboards.js";
import { IDEA_STATUS_LABEL } from "./levels.js";
import { clearKeyboard, deletePrevious, sendScreen } from "./helpers.js";
import { isAdmin, isCreator, isStaff, notifyVolunteers } from "./notify.js";
import { applicationText, approvedKeyboard } from "./registration.js";
import { ideaCard } from "./ideas.js";
import {
  allUsers,
  awardPaws,
  decidePawRequest,
  getIdea,
  getPawRequest,
  getUser,
  listIdeas,
  pendingPawRequests,
  removeUser,
  setIdeaStatus,
  stats,
  updateUser,
} from "./storage.js";
import {
  adminUserCard,
  adminUserDetails,
  approvalText,
  escapeHtml,
} from "./texts.js";
import type { IdeaStatus } from "./types.js";

async function requireAdmin(ctx: Context): Promise<boolean> {
  if (ctx.from && isAdmin(ctx.from.id)) return true;
  await ctx.answerCallbackQuery({
    text: "Недостаточно прав",
    show_alert: true,
  });
  return false;
}

async function requireStaff(ctx: Context): Promise<boolean> {
  if (ctx.from && isStaff(ctx.from.id)) return true;
  await ctx.answerCallbackQuery({
    text: "Недостаточно прав",
    show_alert: true,
  });
  return false;
}

function statsText(tgId?: number): string {
  const summary = stats();
  const head = tgId && isCreator(tgId) ? "👑 <b>Главная лапка</b>\n\n" : "";
  return `${head}📊 <b>Сводка проекта</b>

👥 Пользователи: ${summary.total}
✅ В команде: ${summary.approved}
⏳ На проверке: ${summary.pending}
💡 Идей: ${summary.ideas} (в работе — ${summary.ideasInWork})
🐾 Начислений на проверке: ${summary.pawsPending}
🚫 Заблокированы: ${summary.blocked}`;
}

const USERS_PER_PAGE = 8;

function usersPage(page: number) {
  const users = [...allUsers()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const pages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const current = Math.min(Math.max(page, 0), pages - 1);
  return {
    users: users.slice(
      current * USERS_PER_PAGE,
      (current + 1) * USERS_PER_PAGE,
    ),
    page: current,
    pages,
    total: users.length,
  };
}

export function registerAdmin(bot: Bot): void {
  bot.command("admin", async (ctx) => {
    if (!ctx.from || !isAdmin(ctx.from.id)) {
      await sendScreen(ctx, "Эта команда доступна координаторам проекта.");
      return;
    }
    await sendScreen(ctx, statsText(ctx.from?.id), {
      parse_mode: "HTML",
      reply_markup: adminKeyboard(),
    });
  });

  bot.callbackQuery("admin:menu", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await sendScreen(ctx, statsText(ctx.from?.id), {
      parse_mode: "HTML",
      reply_markup: adminKeyboard(),
    });
  });

  bot.callbackQuery("admin:stats", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    await sendScreen(ctx, statsText(ctx.from?.id), {
      parse_mode: "HTML",
      reply_markup: adminKeyboard(),
    });
  });

  bot.callbackQuery("admin:apps", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    const pending = allUsers().filter((user) => user.status === "pending");
    if (pending.length === 0) {
      await sendScreen(ctx, "Новых заявок нет — всё разобрано 🐾", {
        reply_markup: adminKeyboard(),
      });
      return;
    }
    await deletePrevious(ctx);
    for (const user of pending) {
      await ctx.reply(applicationText(user), {
        parse_mode: "HTML",
        reply_markup: applicationReviewKeyboard(user.tgId),
      });
    }
  });

  bot.callbackQuery("admin:ideas", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    const ideas = listIdeas().filter((idea) => idea.status === "review");
    if (ideas.length === 0) {
      await sendScreen(ctx, "Идей на разборе нет 🐾", { reply_markup: adminKeyboard() });
      return;
    }
    await deletePrevious(ctx);
    for (const idea of ideas) {
      await ctx.reply(ideaCard(idea), {
        parse_mode: "HTML",
        reply_markup: ideaModerationKeyboard(idea.id),
      });
    }
  });

  bot.callbackQuery("admin:paws", async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    const requests = pendingPawRequests();
    if (requests.length === 0) {
      await sendScreen(ctx, "Начислений на проверке нет 🐾", {
        reply_markup: adminKeyboard(),
      });
      return;
    }
    await deletePrevious(ctx);
    for (const request of requests) {
      await ctx.reply(
        `🐾 <b>${escapeHtml(request.userName)}</b>: +${request.amount}\n${escapeHtml(request.reason)}`,
        { parse_mode: "HTML", reply_markup: pawRequestKeyboard(request.id) },
      );
    }
  });

  bot.callbackQuery(/^admin:users(?::(\d+))?$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    await ctx.answerCallbackQuery();
    const data = usersPage(Number(ctx.match[1] ?? 0));
    await sendScreen(ctx, 
      `👥 <b>Пользователи</b>\nВсего: ${data.total} · страница ${data.page + 1}/${data.pages}`,
      {
        parse_mode: "HTML",
        reply_markup: usersNavKeyboard(data.page, data.pages),
      },
    );
    if (data.users.length === 0) {
      await sendScreen(ctx, "Пока ни одного пользователя.");
      return;
    }
    for (const user of data.users) {
      await ctx.reply(adminUserCard(user), {
        parse_mode: "HTML",
        reply_markup: userCardKeyboard(
          user.tgId,
          user.blocked,
          user.role !== "creator" && user.tgId !== ctx.from!.id,
        ),
      });
    }
  });

  bot.callbackQuery(/^user:view:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const user = getUser(Number(ctx.match[1]));
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Пользователь не найден",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();
    await sendScreen(ctx, adminUserDetails(user), {
      parse_mode: "HTML",
      reply_markup: userCardKeyboard(
        user.tgId,
        user.blocked,
        user.role !== "creator" && user.tgId !== ctx.from!.id,
      ),
    });
  });

  bot.callbackQuery(/^user:(block|unblock):(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const blocked = ctx.match[1] === "block";
    const tgId = Number(ctx.match[2]);
    const user = getUser(tgId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Пользователь не найден",
        show_alert: true,
      });
      return;
    }
    if (user.role === "creator" || tgId === ctx.from!.id) {
      await ctx.answerCallbackQuery({
        text: "Нельзя заблокировать создателя или себя",
        show_alert: true,
      });
      return;
    }
    updateUser(tgId, { blocked });
    await ctx.answerCallbackQuery(blocked ? "Заблокирован" : "Разблокирован");
    await clearKeyboard(ctx);
    await sendScreen(ctx, 
      `${blocked ? "🚫" : "✅"} <b>${escapeHtml(user.nickname)}</b> ${
        blocked ? "заблокирован(а)" : "разблокирован(а)"
      }.`,
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery(/^user:del:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const tgId = Number(ctx.match[1]);
    const user = getUser(tgId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Пользователь не найден",
        show_alert: true,
      });
      return;
    }
    if (user.role === "creator" || tgId === ctx.from!.id) {
      await ctx.answerCallbackQuery({
        text: "Нельзя удалить создателя или себя",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();
    await sendScreen(ctx, 
      `🗑 Удалить <b>${escapeHtml(user.nickname)}</b>?\n\nПрофиль, лапки и заявки исчезнут. Это необратимо.`,
      { parse_mode: "HTML", reply_markup: deleteUserKeyboard(tgId) },
    );
  });

  bot.callbackQuery(/^user:delok:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const tgId = Number(ctx.match[1]);
    const user = getUser(tgId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Пользователь не найден",
        show_alert: true,
      });
      return;
    }
    if (user.role === "creator" || tgId === ctx.from!.id) {
      await ctx.answerCallbackQuery({
        text: "Нельзя удалить создателя или себя",
        show_alert: true,
      });
      return;
    }
    removeUser(tgId);
    await ctx.answerCallbackQuery("Удалён");
    await clearKeyboard(ctx);
    await sendScreen(ctx, 
      `Пользователь <b>${escapeHtml(user.nickname)}</b> удалён.`,
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery(/^app:(approve|reject|rework):(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const action = ctx.match[1] as "approve" | "reject" | "rework";
    const tgId = Number(ctx.match[2]);
    const user = getUser(tgId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Заявка не найдена",
        show_alert: true,
      });
      return;
    }

    if (
      action === "approve" &&
      user.age <= 17 &&
      !(user.parentConsent && user.parentConsentFileId)
    ) {
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
      await sendScreen(ctx, 
        `✅ <b>${escapeHtml(user.name)}</b> принят(а) в команду. Начислено: +${award.granted} 🐾`,
        { parse_mode: "HTML" },
      );
      await ctx.api
        .sendMessage(tgId, approvalText(user, award.granted), {
          parse_mode: "HTML",
          reply_markup: approvedKeyboard(),
        })
        .catch(() => undefined);
      return;
    }

    if (action === "reject") {
      updateUser(tgId, { status: "rejected" });
      await sendScreen(ctx, `❌ Заявка ${escapeHtml(user.name)} отклонена.`);
      await ctx.api
        .sendMessage(
          tgId,
          "Заявка отклонена. Если это ошибка или хочешь уточнить — напиши координатору.",
          { reply_markup: backToMenu(false) },
        )
        .catch(() => undefined);
      return;
    }

    updateUser(tgId, { status: "need_rework" });
    await sendScreen(ctx, 
      `🔄 По заявке ${escapeHtml(user.name)} запрошена доработка.`,
    );
    await ctx.api
      .sendMessage(
        tgId,
        "Нужно доработать заявку: напиши координатору, что поправить — и продолжим.",
        { reply_markup: backToMenu(false) },
      )
      .catch(() => undefined);
  });

  bot.callbackQuery(/^idea:st:(i\d+):(published|team|running|done|rejected)$/, async (ctx) => {
    if (!ctx.from || !isCreator(ctx.from.id)) {
      await ctx.answerCallbackQuery({
        text: "Решение по идеям принимает Главная лапка",
        show_alert: true,
      });
      return;
    }
    const id = ctx.match[1];
    const next = ctx.match[2] as IdeaStatus;
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
    const shouldAward =
      (next === "team" && (previous === "published" || previous === "review")) ||
      (next === "done" && previous !== "done");
    if (shouldAward) {
      const award = awardPaws(
        idea.authorTgId,
        25,
        next === "team" ? "Идея принята в команду" : "Идея реализована",
      );
      if (award.ok) awardLine = ` Автору +${award.granted} 🐾.`;
    }

    const label = IDEA_STATUS_LABEL[next] ?? next;
    await sendScreen(ctx, 
      `💡 «${escapeHtml(idea.title)}» → <b>${label}</b>.${awardLine}`,
      { parse_mode: "HTML" },
    );

    if (next === "published") {
      await ctx.api
        .sendMessage(
          ctx.from!.id,
          `💡 «${escapeHtml(idea.title)}» опубликована. Дальше можно собрать команду или взять идею в работу.`,
          { parse_mode: "HTML", reply_markup: ideaReviewKeyboard(id) },
        )
        .catch(() => undefined);

      await notifyVolunteers(
        ctx.api,
        `${ideaCard(idea)}\n\n<i>Идея прошла модерацию и опубликована в банке.</i>`,
        new InlineKeyboard()
          .text("🗂 Открыть банк идей", "menu:bank")
          .row()
          .text("💡 Предложить свою", "idea:start"),
      );
    }

    await ctx.api
      .sendMessage(
        idea.authorTgId,
        `💡 Твоя идея «${escapeHtml(idea.title)}»: <b>${label}</b>.${awardLine}`,
        { parse_mode: "HTML", reply_markup: backToMenu(false) },
      )
      .catch(() => undefined);
  });

  bot.callbackQuery(/^pawreq:(yes|no):(p\d+)$/, async (ctx) => {
    if (!(await requireStaff(ctx))) return;
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
      await sendScreen(ctx, 
        `❌ Отклонено: ${escapeHtml(request.userName)} — ${escapeHtml(request.reason)}.`,
      );
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
    await sendScreen(ctx, 
      `✅ ${escapeHtml(request.userName)}: +${award.granted} 🐾 (${escapeHtml(request.reason)}).`,
    );
    await ctx.api
      .sendMessage(
        request.tgId,
        `🐾 Начислено <b>+${award.granted} лапок</b>: ${escapeHtml(request.reason)}.`,
        { parse_mode: "HTML" },
      )
      .catch(() => undefined);
  });
}
