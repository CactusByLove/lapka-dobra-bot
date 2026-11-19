import type { Bot, Context } from "grammy";
import {
  applicationReviewKeyboard,
  backToMenu,
  confirmKeyboard,
  consentKeyboard,
  directionsKeyboard,
  roleKeyboard,
} from "./keyboards.js";
import { DIRECTIONS, ROLE_LABEL } from "./levels.js";
import { isAdmin, notifyAdmins } from "./notify.js";
import { getUser, upsertUser } from "./storage.js";
import { sessionsStore, type RegDraft, type Session } from "./state.js";
import { escapeHtml } from "./texts.js";
import type { Role, UserRecord } from "./types.js";

function summary(draft: RegDraft): string {
  const minorLine =
    draft.age <= 17
      ? `\n🛡 Согласие родителей: ${
          draft.parentConsent && draft.parentConsentFileId
            ? "документ получен ✅"
            : "не получено ❌"
        }`
      : "";

  return `Проверь заявку:

👤 <b>${escapeHtml(draft.name)}</b>
🎂 Возраст: ${draft.age}
🧩 Роль: ${ROLE_LABEL[draft.role]}
🧭 Направление: ${escapeHtml(draft.direction)}${minorLine}`;
}

export function applicationText(user: UserRecord): string {
  const consent =
    user.age <= 17
      ? user.parentConsent && user.parentConsentFileId
        ? "документ получен ✅"
        : "НЕТ ❌"
      : "не требуется";
  return `🐾 <b>Новая заявка в команду</b>

👤 <b>${escapeHtml(user.name)}</b>${
    user.username ? ` (@${escapeHtml(user.username)})` : ""
  }
🎂 ${user.age} лет · ${ROLE_LABEL[user.role]}
🧭 ${escapeHtml(user.direction)}
🛡 Согласие родителей: ${consent}
🆔 <code>${user.tgId}</code>`;
}

export function registerRegistration(bot: Bot): void {
  bot.callbackQuery("reg:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from!.id;
    const existing = getUser(userId);
    sessionsStore.clear(userId);

    if (existing?.status === "approved") {
      await ctx.reply(
        `Ты уже в команде, <b>${escapeHtml(existing.name)}</b> 🐾\nОткрой «Мои лапки», чтобы увидеть уровень и историю.`,
        { parse_mode: "HTML", reply_markup: backToMenu(isAdmin(userId)) },
      );
      return;
    }
    if (existing?.status === "pending") {
      await ctx.reply(
        "Твоя заявка уже на проверке ⏳\nОтветим в течение дня. Если что-то изменилось — напиши координатору.",
        { reply_markup: backToMenu(isAdmin(userId)) },
      );
      return;
    }

    await ctx.reply("Давай познакомимся 🐾\n\n<b>Кто ты?</b>", {
      parse_mode: "HTML",
      reply_markup: roleKeyboard(),
    });
  });

  bot.callbackQuery(/^reg:role:(volunteer|author|mentor)$/, async (ctx) => {
    const role = ctx.match[1] as Role;
    await ctx.answerCallbackQuery();
    sessionsStore.set(ctx.from!.id, { kind: "reg:name", role });
    await ctx.reply(
      `<b>${ROLE_LABEL[role]}</b> — хороший вход.\n\nКак тебя зовут? Напиши имя, которым тебя зовут в проекте.`,
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("reg:consent:yes", async (ctx) => {
    const session = sessionsStore.get(ctx.from!.id);
    if (session?.kind !== "reg:consent") {
      await ctx.answerCallbackQuery({
        text: "Начни регистрацию заново",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();
    sessionsStore.set(ctx.from!.id, {
      kind: "reg:consentDoc",
      role: session.role,
      name: session.name,
      age: session.age,
      parentConsent: true,
    });
    await ctx.reply(
      "Хорошо. Теперь <b>прикрепи документ</b>: фото подписанного согласия или файл электронной формы.\n\nБез документа заявка не станет активной — это правило проекта, а не формальность.",
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery("reg:consent:doc", async (ctx) => {
    const session = sessionsStore.get(ctx.from!.id);
    if (session?.kind !== "reg:consent") {
      await ctx.answerCallbackQuery({
        text: "Начни регистрацию заново",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();
    sessionsStore.set(ctx.from!.id, {
      kind: "reg:consentDoc",
      role: session.role,
      name: session.name,
      age: session.age,
      parentConsent: false,
    });
    await ctx.reply(
      "Прикрепи фото или файл документа от родителей. Подойдёт подписанное согласие или скрин электронной формы.",
    );
  });

  bot.callbackQuery(/^reg:dir:(.+)$/, async (ctx) => {
    const session = sessionsStore.get(ctx.from!.id);
    if (session?.kind !== "reg:direction") {
      await ctx.answerCallbackQuery({
        text: "Начни регистрацию заново",
        show_alert: true,
      });
      return;
    }
    const key = ctx.match[1];
    const direction = DIRECTIONS.find((item) => item.key === key);
    if (!direction) {
      await ctx.answerCallbackQuery({
        text: "Не понял направление, попробуй ещё раз",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery();

    const draft: RegDraft = {
      ...session.base,
      direction: `${direction.emoji} ${direction.label}`,
    };
    sessionsStore.set(ctx.from!.id, { kind: "reg:confirm", draft });
    await ctx.reply(summary(draft), {
      parse_mode: "HTML",
      reply_markup: confirmKeyboard(),
    });
  });

  bot.callbackQuery("reg:confirm", async (ctx) => {
    const session = sessionsStore.get(ctx.from!.id);
    if (session?.kind !== "reg:confirm") {
      await ctx.answerCallbackQuery({
        text: "Заявка устарела, начни заново",
        show_alert: true,
      });
      return;
    }
    const draft = session.draft;

    if (
      draft.age >= 14 &&
      draft.age <= 17 &&
      !(draft.parentConsent && draft.parentConsentFileId)
    ) {
      await ctx.answerCallbackQuery({
        text: "Для 14–17 лет нужен документ от родителей",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery("Отправляем…");

    const user: UserRecord = {
      tgId: ctx.from!.id,
      username: ctx.from!.username ?? null,
      name: draft.name,
      age: draft.age,
      role: draft.role,
      direction: draft.direction,
      parentConsent: draft.parentConsent,
      parentConsentFileId: draft.parentConsentFileId,
      status: "pending",
      paws: 0,
      pawsWeekStart: "",
      pawsThisWeek: 0,
      streak: 0,
      lastActivityDate: null,
      lastDailyDate: null,
      createdAt: new Date().toISOString(),
    };
    upsertUser(user);
    sessionsStore.clear(ctx.from!.id);

    await ctx.reply(
      "✅ <b>Заявка отправлена!</b>\n\nКоординатор проверит её в течение дня. После одобрения откроются чат новичков, расписание и первое дело на 2–3 часа с наставником.",
      { parse_mode: "HTML", reply_markup: backToMenu(isAdmin(ctx.from!.id)) },
    );

    await notifyAdmins(
      ctx.api,
      applicationText(user),
      applicationReviewKeyboard(user.tgId),
    );
  });
}

/** Текстовые шаги регистрации: имя и возраст. */export async function regTextStep(
  ctx: Context,
  session: Session,
): Promise<boolean> {
  const text = (ctx.message?.text ?? "").trim();

  if (session.kind === "reg:name") {
    if (text.length < 2 || text.length > 60) {
      await ctx.reply("Имя — от 2 до 60 символов. Как тебя зовут?");
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "reg:age",
      role: session.role,
      name: text,
    });
    await ctx.reply(
      `Приятно познакомиться, <b>${escapeHtml(text)}</b>.\n\n<b>Сколько тебе лет?</b>\nНапиши числом — проект для 14–35 лет.`,
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "reg:age") {
    const age = Number(text.replace(",", "."));
    if (!Number.isInteger(age) || age < 14 || age > 35) {
      await ctx.reply("Возраст — целым числом от 14 до 35. Сколько тебе лет?");
      return true;
    }

    if (age <= 17) {
      sessionsStore.set(ctx.from!.id, {
        kind: "reg:consent",
        role: session.role,
        name: session.name,
        age,
      });
      await ctx.reply(
        "Тебе 14–17 — нужен документ от родителей.\n\nВыбери вариант: если родители уже согласны — пришли документ; можно сначала подтвердить, потом приложить файл.",
        { reply_markup: consentKeyboard() },
      );
      return true;
    }

    sessionsStore.set(ctx.from!.id, {
      kind: "reg:direction",
      base: {
        role: session.role,
        name: session.name,
        age,
        parentConsent: false,
        parentConsentFileId: null,
      },
    });
    await ctx.reply(
      "<b>Что тебе интереснее всего?</b>\nНаправление можно поменять позже — это не навсегда.",
      { parse_mode: "HTML", reply_markup: directionsKeyboard() },
    );
    return true;
  }

  return false;
}

/** Приём документа согласия родителей (фото или файл). */
export async function regMediaStep(
  ctx: Context,
  session: Session,
): Promise<boolean> {
  if (session.kind !== "reg:consentDoc") return false;

  const fileId =
    ctx.message?.photo?.at(-1)?.file_id ?? ctx.message?.document?.file_id;

  if (!fileId) {
    await ctx.reply("Не вижу файла. Прикрепи фото или документ согласия.");
    return true;
  }

  sessionsStore.set(ctx.from!.id, {
    kind: "reg:direction",
    base: {
      role: session.role,
      name: session.name,
      age: session.age,
      parentConsent: true,
      parentConsentFileId: fileId,
    },
  });

  await ctx.reply(
    "Документ получен ✅\n\n<b>Что тебе интереснее всего?</b>\nНаправление можно поменять позже.",
    { parse_mode: "HTML", reply_markup: directionsKeyboard() },
  );
  return true;
}
