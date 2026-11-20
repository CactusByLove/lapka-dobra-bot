import { isAdminId } from "./config.js";
import { DIRECTIONS, ROLE_LABEL } from "./levels.js";
import { moderationLine, moderateText } from "./moderation.js";
import { handleAdminEvent } from "./admin.js";
import { notifyCreator, notifyStaff } from "./notify.js";
import { sessionsStore, type RegBase, type Session } from "./state.js";
import {
  addPawRequest,
  createIdea,
  getUser,
  listPublishedIdeas,
  markDailyDone,
  touchStreak,
  upsertUser,
} from "./storage.js";
import {
  CONTACT_TEXT,
  DIRECTIONS_TEXT,
  HOW_IT_WORKS,
  MENU_CAPTION,
  SAFETY_TEXT,
  applicationText,
  dailyTask,
  dealsText,
  ideaCard,
  profileText,
} from "./texts.js";
import {
  backKeyboard,
  confirmKeyboard,
  consentKeyboard,
  dailyKeyboard,
  directionsKeyboard,
  menuKeyboard,
  rolesKeyboard,
} from "./keyboards.js";
import {
  answerEvent,
  deletePrevious,
  replaceScreen,
  send,
  sendScreen,
} from "./vk.js";
import type { Role, UserRecord } from "./types.js";

export interface AppEvent {
  userId: number;
  peerId: number;
  eventId: string;
  payload: Record<string, unknown>;
}

export interface AppMessage {
  userId: number;
  peerId: number;
  text: string;
  attachments: string[];
  payload?: Record<string, unknown>;
}

interface StaffFlags {
  admin: boolean;
  mentor: boolean;
}

function staffFlags(userId: number): StaffFlags {
  const user = getUser(userId);
  const admin =
    isAdminId(userId) ||
    user?.role === "creator" ||
    user?.role === "coordinator";
  const mentor = admin || user?.role === "mentor";
  return { admin, mentor };
}

function isCreatorUser(userId: number): boolean {
  return isAdminId(userId) || getUser(userId)?.role === "creator";
}

async function showMenu(peerId: number, userId: number): Promise<void> {
  const { admin, mentor } = staffFlags(userId);
  await sendScreen(peerId, "main", MENU_CAPTION, menuKeyboard(admin, mentor));
}

async function showInfo(
  peerId: number,
  userId: number,
  screen: string,
  text: string,
): Promise<void> {
  const { admin } = staffFlags(userId);
  await sendScreen(peerId, screen, text, backKeyboard(admin));
}

function regSummary(base: RegBase & { direction: string }): string {
  const minor =
    base.age <= 17
      ? `\n🛡 Согласие родителей: ${
          base.parentConsent && base.parentConsentFileId
            ? "документ получен ✅"
            : "не получено ❌"
        }`
      : "";
  return `Проверь заявку:

👤 ${base.nickname}
🏷 Имя: ${base.name}
🎂 Возраст: ${base.age}
🧩 Роль: ${ROLE_LABEL[base.role] ?? base.role}
🧭 Направление: ${base.direction}${minor}`;
}

async function startRegistration(
  peerId: number,
  userId: number,
): Promise<void> {
  const existing = getUser(userId);
  sessionsStore.clear(userId);
  if (existing?.status === "approved") {
    await replaceScreen(
      peerId,
      `Ты уже в команде, ${existing.nickname} 🐾\nОткрой «Мои лапки», чтобы увидеть уровень и историю.`,
      { keyboard: backKeyboard(staffFlags(userId).admin) },
    );
    return;
  }
  if (existing?.status === "pending") {
    await replaceScreen(
      peerId,
      "Твоя заявка уже на проверке ⏳\nОтветим в течение дня.",
      { keyboard: backKeyboard(staffFlags(userId).admin) },
    );
    return;
  }
  await replaceScreen(peerId, "Давай познакомимся 🐾\n\nКто ты?", {
    keyboard: rolesKeyboard(),
  });
}

async function showBank(peerId: number, userId: number): Promise<void> {
  const ideas = listPublishedIdeas().slice(0, 5);
  await deletePrevious(peerId);
  if (ideas.length === 0) {
    await replaceScreen(peerId, "В банке пока пусто — стань первым автором 💡", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return;
  }
  for (const idea of ideas) {
    await send(peerId, ideaCard(idea));
  }
  await replaceScreen(
    peerId,
    `🗂 Банк идей: ${ideas.length} из ${listPublishedIdeas().length}.\nИдеи прошли автопроверку и модерацию Главной лапки.`,
    { keyboard: backKeyboard(staffFlags(userId).admin) },
  );
}

async function showProfile(peerId: number, userId: number): Promise<void> {
  const user = getUser(userId);
  if (!user) {
    await replaceScreen(
      peerId,
      "Ты пока не в команде. Заполни короткую заявку — откроются лапки, уровни и дела.",
      { keyboard: backKeyboard(staffFlags(userId).admin) },
    );
    return;
  }
  await sendScreen(
    peerId,
    "profile",
    profileText(user),
    backKeyboard(staffFlags(userId).admin),
  );
}

async function showDaily(peerId: number, userId: number): Promise<void> {
  const user = getUser(userId);
  if (!user) {
    await replaceScreen(peerId, "«Лапка дня» — для участников команды. Заполни заявку.", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return;
  }
  const task = dailyTask(Math.floor(Date.now() / 86_400_000));
  await replaceScreen(
    peerId,
    `🎯 Лапка дня\n\n${task.title}\n${task.text}\n\nОтметь выполнение — наставник или координатор подтвердит, и начислятся 3 лапки.`,
    { keyboard: dailyKeyboard() },
  );
}

async function completeDaily(peerId: number, userId: number): Promise<void> {
  const user = getUser(userId);
  if (!user) {
    await send(peerId, "Сначала зарегистрируйся в команду.");
    return;
  }
  if (!markDailyDone(user.tgId)) {
    await send(peerId, "Сегодня уже отмечено — возвращайся завтра 🐾");
    return;
  }
  touchStreak(user.tgId);
  const task = dailyTask(Math.floor(Date.now() / 86_400_000));
  const request = addPawRequest(
    user.tgId,
    user.nickname,
    3,
    `Лапка дня: ${task.title}`,
  );
  await replaceScreen(
    peerId,
    "✅ Отмечено! 3 лапки ушли на проверку наставнику или координатору.",
    { keyboard: backKeyboard(staffFlags(userId).admin) },
  );
  await notifyStaff(
    `🐾 Лапка дня\n${user.nickname} отметил(а): ${task.title}\n+3 лапки на проверку.`,
    {
      one_time: true,
      inline: true,
      buttons: [
        [
          {
            action: {
              type: "callback",
              label: "✅ Подтвердить",
              payload: JSON.stringify({ c: "pawreq:yes", id: request.id }),
            },
            color: "positive",
          },
          {
            action: {
              type: "callback",
              label: "❌ Отклонить",
              payload: JSON.stringify({ c: "pawreq:no", id: request.id }),
            },
            color: "negative",
          },
        ],
      ],
    },
  );
}

async function startIdea(peerId: number, userId: number): Promise<void> {
  sessionsStore.set(userId, { kind: "idea:title" });
  await replaceScreen(
    peerId,
    "💡 Предложить идею\n\nШаг 1 из 5. Как назовём идею? Коротко, до 100 символов.",
    { keyboard: backKeyboard(staffFlags(userId).admin) },
  );
}

async function finishIdea(
  peerId: number,
  userId: number,
  session: Extract<Session, { kind: "idea:needs" }>,
  needs: string,
): Promise<void> {
  const user = getUser(userId);
  const check = moderateText([
    session.title,
    session.what,
    session.audience,
    session.goal,
    needs,
  ]);
  sessionsStore.clear(userId);
  if (!check.ok) {
    await replaceScreen(
      peerId,
      `⚠️ Идея не прошла автопроверку:\n• ${check.reasons.join("\n• ")}\n\nПоправь текст и пришли заново.`,
      { keyboard: backKeyboard(staffFlags(userId).admin) },
    );
    return;
  }
  const idea = createIdea({
    authorTgId: userId,
    authorName: user?.nickname ?? "Автор",
    title: session.title,
    what: session.what,
    audience: session.audience,
    goal: session.goal,
    needs,
  });
  await replaceScreen(
    peerId,
    `✅ Идея «${idea.title}» ушла на модерацию.\n\n${moderationLine(check)}\nГлавная лапка проверит и скажет, что дальше.`,
    { keyboard: backKeyboard(staffFlags(userId).admin) },
  );
  await notifyCreator(
    `${ideaCard(idea)}\n\n${moderationLine(check)}`,
    {
      one_time: true,
      inline: true,
      buttons: [
        [
          {
            action: {
              type: "callback",
              label: "✅ Опубликовать",
              payload: JSON.stringify({ c: "idea:st:published", id: idea.id }),
            },
            color: "positive",
          },
          {
            action: {
              type: "callback",
              label: "❌ Отклонить",
              payload: JSON.stringify({ c: "idea:st:rejected", id: idea.id }),
            },
            color: "negative",
          },
        ],
      ],
    },
  );
}

function attachmentString(attachment: {
  type?: string;
  ownerId?: number;
  id?: number;
  accessKey?: string;
  toString?: () => string;
}): string {
  if (typeof attachment.toString === "function") {
    const value = attachment.toString();
    if (value && value !== "[object Object]") return value;
  }
  if (attachment.type && attachment.ownerId && attachment.id) {
    const key = attachment.accessKey ? `_${attachment.accessKey}` : "";
    return `${attachment.type}${attachment.ownerId}_${attachment.id}${key}`;
  }
  return "";
}

export async function handleCallbackEvent(event: AppEvent): Promise<void> {
  const { userId, peerId, eventId, payload } = event;
  const cmd = typeof payload.c === "string" ? payload.c : "";
  if (!cmd) return;

  await answerEvent(eventId, userId, peerId);

  if (
    cmd.startsWith("admin") ||
    cmd.startsWith("app:") ||
    cmd.startsWith("idea:st:") ||
    cmd.startsWith("pawreq:") ||
    cmd.startsWith("user:") ||
    cmd.startsWith("mentor")
  ) {
    const handled = await handleAdminEvent({
      userId,
      peerId,
      payload,
      isCreator: isCreatorUser(userId),
      flags: staffFlags(userId),
    });
    if (handled) return;
  }

  switch (cmd) {
    case "menu":
      await showMenu(peerId, userId);
      return;
    case "reg":
      await startRegistration(peerId, userId);
      return;
    case "reg:role:volunteer":
    case "reg:role:author":
    case "reg:role:mentor": {
      const role = cmd.split(":")[2] as Role;
      sessionsStore.set(userId, { kind: "reg:name", role });
      await replaceScreen(peerId, "Как тебя зовут? Напиши имя, которым тебя зовут в проекте.", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return;
    }
    case "reg:consent:yes":
    case "reg:consent:doc": {
      const session = sessionsStore.get(userId);
      if (session?.kind !== "reg:consent") {
        await replaceScreen(peerId, "Начни регистрацию заново.", {
          keyboard: backKeyboard(false),
        });
        return;
      }
      sessionsStore.set(userId, {
        kind: "reg:consentDoc",
        role: session.role,
        name: session.name,
        nickname: session.nickname,
        age: session.age,
        parentConsent: true,
      });
      await replaceScreen(
        peerId,
        "Прикрепи фото или файл подписанного согласия родителей. Без документа заявка не станет активной.",
        { keyboard: backKeyboard(false) },
      );
      return;
    }
    case "reg:connect:doc": {
      const session = sessionsStore.get(userId);
      if (session?.kind !== "reg:consentDoc") {
        await replaceScreen(peerId, "Начни регистрацию заново.", {
          keyboard: backKeyboard(false),
        });
        return;
      }
      await replaceScreen(
        peerId,
        "Прикрепи фото или файл документа от родителей — подойдёт подписанное согласие или скрин электронной формы.",
        { keyboard: backKeyboard(false) },
      );
      return;
    }
    case "reg:confirm": {
      const session = sessionsStore.get(userId);
      if (session?.kind !== "reg:confirm") {
        await replaceScreen(peerId, "Заявка устарела, начни заново.", {
          keyboard: backKeyboard(false),
        });
        return;
      }
      const draft = session.draft;
      if (
        draft.age >= 14 &&
        draft.age <= 17 &&
        !(draft.parentConsent && draft.parentConsentFileId)
      ) {
        await replaceScreen(
          peerId,
          "Для 14–17 лет нужен документ от родителей. Прикрепи файл ещё раз.",
          { keyboard: consentKeyboard() },
        );
        return;
      }
      const user: UserRecord = {
        tgId: userId,
        username: null,
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
      sessionsStore.clear(userId);
      await replaceScreen(
        peerId,
        "✅ Заявка отправлена! Главная лапка и координатор проверят её в течение дня.",
        { keyboard: backKeyboard(staffFlags(userId).admin) },
      );
      await notifyStaff(
        applicationText(user),
        {
          one_time: true,
          inline: true,
          buttons: [
            [
              {
                action: {
                  type: "callback",
                  label: "✅ Одобрить",
                  payload: JSON.stringify({ c: "app:approve", id: user.tgId }),
                },
                color: "positive",
              },
              {
                action: {
                  type: "callback",
                  label: "🔄 Доработка",
                  payload: JSON.stringify({ c: "app:rework", id: user.tgId }),
                },
              },
            ],
            [
              {
                action: {
                  type: "callback",
                  label: "❌ Отклонить",
                  payload: JSON.stringify({ c: "app:reject", id: user.tgId }),
                },
                color: "negative",
              },
            ],
          ],
        },
      );
      await notifyStaff(
        `${applicationText(user)}\n\nРешение принимает Главная лапка или координатор.`,
        undefined,
        ["mentor"],
      );
      return;
    }
    case "idea":
      await startIdea(peerId, userId);
      return;
    case "bank":
      await showBank(peerId, userId);
      return;
    case "dir":
      await showInfo(peerId, userId, "info", DIRECTIONS_TEXT);
      return;
    case "deals":
      await showInfo(peerId, userId, "info", dealsText());
      return;
    case "profile":
      await showProfile(peerId, userId);
      return;
    case "daily":
      await showDaily(peerId, userId);
      return;
    case "daily:done":
      await completeDaily(peerId, userId);
      return;
    case "how":
      await showInfo(peerId, userId, "info", HOW_IT_WORKS);
      return;
    case "safety":
      await showInfo(peerId, userId, "info", SAFETY_TEXT);
      return;
    case "contact":
      await showInfo(peerId, userId, "contact", CONTACT_TEXT);
      return;
    default:
      return;
  }
}

async function regTextStep(
  peerId: number,
  userId: number,
  session: Session,
  text: string,
): Promise<boolean> {
  if (session.kind === "reg:name") {
    if (text.length < 2 || text.length > 60) {
      await replaceScreen(peerId, "Имя — от 2 до 60 символов. Как тебя зовут?", {
        keyboard: backKeyboard(false),
      });
      return true;
    }
    sessionsStore.set(userId, {
      kind: "reg:nickname",
      role: session.role,
      name: text,
    });
    await replaceScreen(
      peerId,
      `Приятно познакомиться, ${text}.\n\nПридумай никнейм — его увидят в профиле и заявках. 2–32 символа: буквы, цифры, пробел, _ или дефис.`,
      { keyboard: backKeyboard(false) },
    );
    return true;
  }

  if (session.kind === "reg:nickname") {
    const nickname = text.replace(/^@/, "").trim();
    if (!/^[A-Za-zА-Яа-яЁё0-9_ -]{2,32}$/.test(nickname)) {
      await replaceScreen(
        peerId,
        "Никнейм — 2–32 символа: буквы, цифры, пробел, _ или дефис. Попробуй ещё раз.",
        { keyboard: backKeyboard(false) },
      );
      return true;
    }
    sessionsStore.set(userId, {
      kind: "reg:age",
      role: session.role,
      name: session.name,
      nickname,
    });
    await replaceScreen(
      peerId,
      `Отлично, ${nickname} — так тебя увидят в команде.\n\nСколько тебе лет? Напиши числом — проект для 14–35 лет.`,
      { keyboard: backKeyboard(false) },
    );
    return true;
  }

  if (session.kind === "reg:age") {
    const age = Number(text.replace(",", "."));
    if (!Number.isInteger(age) || age < 14 || age > 35) {
      await replaceScreen(peerId, "Возраст — целым числом от 14 до 35. Сколько тебе лет?", {
        keyboard: backKeyboard(false),
      });
      return true;
    }
    if (age <= 17) {
      sessionsStore.set(userId, {
        kind: "reg:consent",
        role: session.role,
        name: session.name,
        nickname: session.nickname,
        age,
      });
      await replaceScreen(
        peerId,
        "Тебе 14–17 — нужно письменное согласие родителей.\n\nЕсли родители уже согласны, нажми «Родители согласны» и прикрепи документ.",
        { keyboard: consentKeyboard() },
      );
      return true;
    }
    sessionsStore.set(userId, {
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
    await replaceScreen(peerId, "Что тебе интереснее всего?", {
      keyboard: directionsKeyboard(),
    });
    return true;
  }

  return false;
}

async function ideaTextStep(
  peerId: number,
  userId: number,
  session: Session,
  text: string,
): Promise<boolean> {
  if (session.kind === "idea:title") {
    if (text.length < 5 || text.length > 100) {
      await replaceScreen(peerId, "Название — от 5 до 100 символов. Как назовём идею?", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return true;
    }
    sessionsStore.set(userId, { kind: "idea:what", title: text });
    await replaceScreen(peerId, "Шаг 2 из 5. Что именно предлагаешь сделать?", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return true;
  }

  if (session.kind === "idea:what") {
    if (text.length < 20 || text.length > 1000) {
      await replaceScreen(peerId, "Опиши идею подробнее: от 20 до 1000 символов.", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return true;
    }
    sessionsStore.set(userId, {
      kind: "idea:audience",
      title: session.title,
      what: text,
    });
    await replaceScreen(peerId, "Шаг 3 из 5. Для кого это? Кому станет лучше?", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return true;
  }

  if (session.kind === "idea:audience") {
    if (text.length < 10 || text.length > 300) {
      await replaceScreen(peerId, "Опиши аудиторию: от 10 до 300 символов.", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return true;
    }
    sessionsStore.set(userId, {
      kind: "idea:goal",
      title: session.title,
      what: session.what,
      audience: text,
    });
    await replaceScreen(peerId, "Шаг 4 из 5. Какой результат хочешь получить?", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return true;
  }

  if (session.kind === "idea:goal") {
    if (text.length < 10 || text.length > 300) {
      await replaceScreen(peerId, "Опиши результат: от 10 до 300 символов.", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return true;
    }
    sessionsStore.set(userId, {
      kind: "idea:needs",
      title: session.title,
      what: session.what,
      audience: session.audience,
      goal: text,
    });
    await replaceScreen(peerId, "Шаг 5 из 5. Что нужно, чтобы это сделать?", {
      keyboard: backKeyboard(staffFlags(userId).admin),
    });
    return true;
  }

  if (session.kind === "idea:needs") {
    if (text.length < 10 || text.length > 300) {
      await replaceScreen(peerId, "Опиши, что нужно: от 10 до 300 символов.", {
        keyboard: backKeyboard(staffFlags(userId).admin),
      });
      return true;
    }
    await finishIdea(peerId, userId, session, text);
    return true;
  }

  return false;
}

export async function handleMessageEvent(message: AppMessage): Promise<void> {
  const { userId, peerId } = message;
  const user = getUser(userId);

  if (user?.blocked && !isAdminId(userId)) {
    await send(peerId, "Доступ к боту ограничен координатором.");
    return;
  }

  const text = message.text.trim();
  const session = sessionsStore.get(userId);

  if (session?.kind === "reg:consentDoc") {
    const attachment = message.attachments[0];
    if (!attachment) {
      await send(peerId, "Не вижу файла. Прикрепи фото или документ согласия.");
      return;
    }
    sessionsStore.set(userId, {
      kind: "reg:direction",
      base: {
        role: session.role,
        name: session.name,
        nickname: session.nickname,
        age: session.age,
        parentConsent: true,
        parentConsentFileId: attachment,
      },
    });
    await replaceScreen(peerId, "Документ получен ✅\n\nЧто тебе интереснее всего?", {
      keyboard: directionsKeyboard(),
    });
    return;
  }

  if (session && text) {
    if (await regTextStep(peerId, userId, session, text)) return;
    if (await ideaTextStep(peerId, userId, session, text)) return;
  }

  if (session?.kind === "reg:direction" && message.payload?.c) {
    // направление выбирается кнопкой, здесь ничего не делаем
    return;
  }

  if (session?.kind === "reg:direction") {
    const direction = DIRECTIONS.find((item) => text.includes(item.label));
    if (direction) {
      const draft = {
        ...session.base,
        direction: `${direction.emoji} ${direction.label}`,
      };
      sessionsStore.set(userId, { kind: "reg:confirm", draft });
      await replaceScreen(peerId, regSummary(draft), {
        keyboard: confirmKeyboard(),
      });
      return;
    }
  }

  const command = text.toLowerCase();
  if (
    command === "начать" ||
    command === "start" ||
    command === "меню" ||
    command === "menu" ||
    command === "/start" ||
    message.payload?.c === "start"
  ) {
    sessionsStore.clear(userId);
    await showMenu(peerId, userId);
    return;
  }

  if (!user) {
    await send(peerId, "Я рядом 🐾 Открой меню — там заявка в команду, идеи, лапки и ближайшие дела.", {
      keyboard: menuKeyboard(staffFlags(userId).admin, staffFlags(userId).mentor),
    });
    return;
  }

  await send(peerId, "Не понял шаг. Открой меню и начни заново.", {
    keyboard: menuKeyboard(staffFlags(userId).admin, staffFlags(userId).mentor),
  });
}

export { attachmentString };
