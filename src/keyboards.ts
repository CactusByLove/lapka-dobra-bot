import { InlineKeyboard } from "grammy";
import { DIRECTIONS } from "./levels.js";

export const CALLBACKS = {
  MAIN: "menu:home",
  REG_START: "reg:start",
  IDEA_START: "idea:start",
  HOW: "menu:how",
  DIRECTIONS: "menu:directions",
  DAILY: "menu:daily",
  PROFILE: "menu:profile",
  MENTOR: "mentor:menu",
  DEALS: "menu:deals",
  BANK: "menu:bank",
  SAFETY: "menu:safety",
  CONTACT: "menu:contact",
  RATES: "menu:rates",
  ADMIN: "admin:menu",
} as const;

/** Главное меню — оно же «банер с кнопками» */
export function mainMenu(isAdmin = false, isMentor = false): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("🐾 Регистрация в команду", CALLBACKS.REG_START)
    .row()
    .text("💡 Предложить идею", CALLBACKS.IDEA_START)
    .text("🗂 Банк идей", CALLBACKS.BANK)
    .row()
    .text("🧭 Направления", CALLBACKS.DIRECTIONS)
    .text("📅 Ближайшие дела", CALLBACKS.DEALS)
    .row()
    .text("🏅 Мои лапки", CALLBACKS.PROFILE)
    .text("🎯 Лапка дня", CALLBACKS.DAILY)
    .row()
    .text("📚 Как это работает", CALLBACKS.HOW)
    .text("🛡 Правила и безопасность", CALLBACKS.SAFETY)
    .row()
    .text("✉️ Связаться", CALLBACKS.CONTACT);

  if (isAdmin) kb.row().text("🛠 Админка", CALLBACKS.ADMIN);
  if (isMentor) kb.row().text("🦸 Наставнику", CALLBACKS.MENTOR);
  return kb;
}

/** Кнопка «назад в меню» */
export function backToMenu(isAdmin = false): InlineKeyboard {
  const kb = new InlineKeyboard().text("⬅️ В меню", CALLBACKS.MAIN);
  if (isAdmin) kb.text("🛠 Админка", CALLBACKS.ADMIN);
  return kb;
}

export function ratesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⬅️ В меню", CALLBACKS.MAIN)
    .text("🏅 Мои лапки", CALLBACKS.PROFILE);
}

export function roleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🤝 Стать волонтёром", "reg:role:volunteer")
    .row()
    .text("💡 У меня есть идея", "reg:role:author")
    .row()
    .text("🦸 Стать наставником", "reg:role:mentor")
    .row()
    .text("⬅️ В меню", CALLBACKS.MAIN);
}

export function directionsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const direction of DIRECTIONS) {
    kb.text(`${direction.emoji} ${direction.label}`, `reg:dir:${direction.key}`).row();
  }
  kb.text("⬅️ В меню", CALLBACKS.MAIN);
  return kb;
}

export function consentKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Родители согласны", "reg:consent:yes")
    .row()
    .text("📎 Отправить документ", "reg:consent:doc")
    .row()
    .text("⬅️ В меню", CALLBACKS.MAIN);
}

export function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Всё верно, отправить", "reg:confirm")
    .text("✏️ Заново", CALLBACKS.REG_START);
}

export function applicationReviewKeyboard(tgId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Одобрить", `app:approve:${tgId}`)
    .text("🔄 Доработка", `app:rework:${tgId}`)
    .row()
    .text("❌ Отклонить", `app:reject:${tgId}`);
}

export function ideaModerationKeyboard(id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Опубликовать", `idea:st:${id}:published`)
    .text("❌ Отклонить", `idea:st:${id}:rejected`);
}

export function ideaReviewKeyboard(id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("👥 В команду", `idea:st:${id}:team`)
    .text("🚀 В работу", `idea:st:${id}:running`)
    .row()
    .text("✅ Реализовано", `idea:st:${id}:done`)
    .text("❌ Отклонить", `idea:st:${id}:rejected`);
}

export function pawRequestKeyboard(id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить", `pawreq:yes:${id}`)
    .text("❌ Отклонить", `pawreq:no:${id}`);
}

export function dailyKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Выполнил(а)", "daily:done")
    .row()
    .text("⬅️ В меню", CALLBACKS.MAIN);
}

export function adminKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Сводка", "admin:stats")
    .row()
    .text("📥 Заявки", "admin:apps")
    .text("👥 Пользователи", "admin:users")
    .row()
    .text("💡 Идеи", "admin:ideas")
    .text("🐾 Начисления", "admin:paws")
    .row()
    .text("⬅️ В меню", CALLBACKS.MAIN);
}

export function usersNavKeyboard(page: number, pages: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (page > 0) kb.text("◀️ Назад", `admin:users:${page - 1}`);
  if (page < pages - 1) kb.text("Вперёд ▶️", `admin:users:${page + 1}`);
  kb.row().text("⬅️ В админку", "admin:menu");
  return kb;
}

export function userCardKeyboard(
  tgId: number,
  blocked: boolean,
  canManage = true,
): InlineKeyboard {
  const kb = new InlineKeyboard().text("👤 Профиль", `user:view:${tgId}`).row();
  if (canManage) {
    if (blocked) kb.text("✅ Разблокировать", `user:unblock:${tgId}`);
    else kb.text("🚫 Заблокировать", `user:block:${tgId}`);
    kb.text("🗑 Удалить", `user:del:${tgId}`).row();
  }
  kb.text("⬅️ К списку", "admin:users");
  return kb;
}

export function deleteUserKeyboard(tgId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("🗑 Да, удалить", `user:delok:${tgId}`)
    .text("Отмена", "admin:users")
    .row()
    .text("⬅️ В админку", "admin:menu");
}

export function contactKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const vk = process.env.VK_URL || "https://vk.ru/akindpaw";
  kb.url("💬 Группа ВКонтакте", vk).row();
  kb.text("⬅️ В меню", CALLBACKS.MAIN);
  return kb;
}

export function mentorKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📥 Заявки", "mentor:apps")
    .text("🐾 Лапки на проверке", "mentor:paws")
    .row()
    .text("⬅️ В меню", CALLBACKS.MAIN);
}
