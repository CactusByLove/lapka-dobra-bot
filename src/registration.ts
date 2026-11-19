import { InlineKeyboard, type Bot, type Context } from "grammy";
import {
  CALLBACKS,
  applicationReviewKeyboard,
  backToMenu,
  confirmKeyboard,
  consentKeyboard,
  directionsKeyboard,
  roleKeyboard,
} from "./keyboards.js";
import { DIRECTIONS, ROLE_LABEL } from "./levels.js";
import { sendScreen } from "./helpers.js";
import { isAdmin, notifyAdmins, notifyMentors } from "./notify.js";
import { getUser, upsertUser } from "./storage.js";
import { sessionsStore, type RegDraft, type Session } from "./state.js";
import { CHAT_INVITE_URL, escapeHtml } from "./texts.js";
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

👤 <b>${escapeHtml(draft.nickname)}</b>
🏷 Имя: ${escapeHtml(draft.name)}
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

👤 <b>${escapeHtml(user.nickname)}</b>${
    user.username ? ` (@${escapeHtml(user.username)})` : ""
  }
🏷 Имя: ${escapeHtml(user.name)}
🎂 ${user.age} лет · ${ROLE_LABEL[user.role]}
🧭 ${escapeHtml(user.direction)}
🛡 Согласие родителей: ${consent}
🆔 <code>${user.tgId}</code>`;
}

/** Кнопки в личном сообщении после одобрения заявки. */
export function approvedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url("💬 Войти в чат команды", CHAT_INVITE_URL)
    .row()
    .text("🐾 В меню", CALLBACKS.MAIN);
}

export function registerRegistration(bot: Bot): void {
  bot.callbackQuery("reg:start", async (ctx) => {
    await ctx.answerCallbackQuery();
    const userId = ctx.from!.id;
    const existing = getUser(userId);
    sessionsStore.clear(userId);

    if (existing?.status === "approved") {
      await sendScreen(ctx, 
        `Ты уже в команде, <b>${escapeHtml(existing.name)}</b> 🐾\nОткрой «Мои лапки», чтобы увидеть уровень и историю.`,
        { parse_mode: "HTML", reply_markup: backToMenu(isAdmin(userId)) },
      );
      return;
    }
    if (existing?.status === "pending") {
      await sendScreen(ctx, 
        "Твоя заявка уже на проверке ⏳\nОтветим в течение дня. Если что-то изменилось — напиши координатору.",
        { reply_markup: backToMenu(isAdmin(userId)) },
      );
      return;
    }

    await sendScreen(ctx, "Давай познакомимся 🐾\n\n<b>Кто ты?</b>", {
      parse_mode: "HTML",
      reply_markup: roleKeyboard(),
    });
  });

  bot.callbackQuery(/^reg:role:(volunteer|author|mentor)$/, async (ctx) => {
    const role = ctx.match[1] as Role;
    await ctx.answerCallbackQuery();
    sessionsStore.set(ctx.from!.id, { kind: "reg:name", role });
    await sendScreen(ctx, 
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
      nickname: session.nickname,
      age: session.age,
      parentConsent: true,
    });
    await sendScreen(ctx, 
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
      nickname: session.nickname,
      age: session.age,
      parentConsent: false,
    });
    await sendScreen(ctx, 
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
    await sendScreen(ctx, summary(draft), {
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
      nickname: draft.nickname,
      age: draft.age,
      role: draft.role,
      direction: draft.direction,
      parentConsent: draft.parentConsent,
      parentConsentFileId: draft.parentConsentFileId,
      status: "pending",
      blocked: false,
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

    await sendScreen(ctx, 
      "✅ <b>Заявка отправлена!</b>\n\nГлавная лапка и координатор проверят её в течение дня. После одобрения откроются чат команды, расписание и первое дело на 2–3 часа с наставником.",
      { parse_mode: "HTML", reply_markup: backToMenu(isAdmin(ctx.from!.id)) },
    );

    await notifyAdmins(
      ctx.api,
      applicationText(user),
      applicationReviewKeyboard(user.tgId),
    );

    await notifyMentors(
      ctx.api,
      `${applicationText(user)}\n\n<i>Решение принимает Главная лапка или координатор.</i>`,
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
      await sendScreen(ctx, "Имя — от 2 до 60 символов. Как тебя зовут?");
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "reg:nickname",
      role: session.role,
      name: text,
    });
    await sendScreen(ctx, 
      `Приятно познакомиться, <b>${escapeHtml(text)}</b>.\n\n<b>Придумай никнейм</b> — его увидят в профиле и заявках. 2–32 символа: буквы, цифры, пробел, _ или дефис.`,
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "reg:nickname") {
    const nickname = text.replace(/^@/, "").trim();
    if (!/^[A-Za-zА-Яа-яЁё0-9_ -]{2,32}$/.test(nickname)) {
      await sendScreen(
        ctx,
        "Никнейм — 2–32 символа: буквы, цифры, пробел, _ или дефис. Попробуй ещё раз.",
      );
      return true;
    }
    sessionsStore.set(ctx.from!.id, {
      kind: "reg:age",
      role: session.role,
      name: session.name,
      nickname,
    });
    await sendScreen(
      ctx,
      `Отлично, <b>${escapeHtml(nickname)}</b> — так тебя увидят в команде.\n\n<b>Сколько тебе лет?</b>\nНапиши числом — проект для 14–35 лет.`,
      { parse_mode: "HTML" },
    );
    return true;
  }

  if (session.kind === "reg:age") {
    const age = Number(text.replace(",", "."));
    if (!Number.isInteger(age) || age < 14 || age > 35) {
      await sendScreen(ctx, "Возраст — целым числом от 14 до 35. Сколько тебе лет?");
      return true;
    }

    if (age <= 17) {
      sessionsStore.set(ctx.from!.id, {
        kind: "reg:consent",
        role: session.role,
        name: session.name,
        nickname: session.nickname,
        age,
      });
      await sendScreen(ctx, 
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
        nickname: session.nickname,
        age,
        parentConsent: false,
        parentConsentFileId: null,
      },
    });
    await sendScreen(ctx, 
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
    await sendScreen(ctx, "Не вижу файла. Прикрепи фото или документ согласия.");
    return true;
  }

  sessionsStore.set(ctx.from!.id, {
    kind: "reg:direction",
    base: {
      role: session.role,
      name: session.name,
      nickname: session.nickname,
      age: session.age,
      parentConsent: true,
      parentConsentFileId: fileId,
    },
  });

  await sendScreen(ctx, 
    "Документ получен ✅\n\n<b>Что тебе интереснее всего?</b>\nНаправление можно поменять позже.",
    { parse_mode: "HTML", reply_markup: directionsKeyboard() },
  );
  return true;
}
