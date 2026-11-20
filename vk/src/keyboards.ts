import { DIRECTIONS } from "./levels.js";
import { button, type VkButton, type VkKeyboard } from "./vk.js";

function keyboard(
  rows: VkButton[][],
  options?: { oneTime?: boolean; inline?: boolean },
): VkKeyboard {
  return {
    one_time: options?.oneTime ?? false,
    inline: options?.inline ?? false,
    buttons: rows,
  };
}

export function menuKeyboard(isAdmin: boolean, isMentor: boolean): VkKeyboard {
  const rows: VkButton[][] = [
    [button("🐾 Регистрация", "reg", undefined, "primary")],
    [button("💡 Предложить идею", "idea"), button("🗂 Банк идей", "bank")],
    [button("🧭 Направления", "dir"), button("📅 Ближайшие дела", "deals")],
    [button("🏅 Мои лапки", "profile"), button("🎯 Лапка дня", "daily")],
    [button("📚 Как это работает", "how"), button("🛡 Правила", "safety")],
    [button("✉️ Связаться", "contact")],
  ];
  if (isAdmin) rows.push([button("🛠 Админка", "admin", undefined, "primary")]);
  if (isMentor) rows.push([button("🦸 Наставнику", "mentor")]);
  return keyboard(rows);
}

export function backKeyboard(isAdmin = false): VkKeyboard {
  const row = [button("⬅️ В меню", "menu", undefined, "primary")];
  if (isAdmin) row.push(button("🛠 Админка", "admin"));
  return keyboard([row]);
}

export function rolesKeyboard(): VkKeyboard {
  return keyboard(
    [
      [button("🤝 Стать волонтёром", "reg:role:volunteer", undefined, "primary")],
      [button("💡 У меня есть идея", "reg:role:author")],
      [button("🦸 Стать наставником", "reg:role:mentor")],
      [button("⬅️ В меню", "menu")],
    ],
    { oneTime: true },
  );
}

export function directionsKeyboard(): VkKeyboard {
  const rows: VkButton[][] = [];
  for (let i = 0; i < DIRECTIONS.length; i += 2) {
    const pair = DIRECTIONS.slice(i, i + 2).map((direction) =>
      button(
        `${direction.emoji} ${direction.label}`,
        `reg:dir:${direction.key}`,
      ),
    );
    rows.push(pair);
  }
  rows.push([button("⬅️ В меню", "menu")]);
  return keyboard(rows);
}

export function confirmKeyboard(): VkKeyboard {
  return keyboard([
    [button("✅ Всё верно", "reg:confirm", undefined, "positive")],
    [button("✏️ Заново", "reg")],
  ]);
}

export function consentKeyboard(): VkKeyboard {
  return keyboard([
    [button("✅ Родители согласны", "reg:consent:yes", undefined, "positive")],
    [button("📎 Отправить документ", "reg:consent:doc")],
    [button("⬅️ В меню", "menu")],
  ]);
}

export function adminKeyboard(): VkKeyboard {
  return keyboard([
    [button("📊 Сводка", "admin:stats", undefined, "primary")],
    [button("📥 Заявки", "admin:apps"), button("👥 Пользователи", "admin:users")],
    [button("💡 Идеи", "admin:ideas"), button("🐾 Начисления", "admin:paws")],
    [button("⬅️ В меню", "menu")],
  ]);
}

export function mentorKeyboard(): VkKeyboard {
  return keyboard([
    [button("📥 Заявки", "mentor:apps"), button("🐾 Лапки на проверке", "mentor:paws")],
    [button("⬅️ В меню", "menu")],
  ]);
}

export function applicationInline(userId: number): VkKeyboard {
  return keyboard(
    [
      [
        button("✅ Одобрить", "app:approve", { id: userId }, "positive"),
        button("🔄 Доработка", "app:rework", { id: userId }),
      ],
      [button("❌ Отклонить", "app:reject", { id: userId }, "negative")],
    ],
    { inline: true },
  );
}

export function ideaModerationInline(ideaId: string): VkKeyboard {
  return keyboard(
    [
      [
        button("✅ Опубликовать", "idea:st:published", { id: ideaId }, "positive"),
        button("❌ Отклонить", "idea:st:rejected", { id: ideaId }, "negative"),
      ],
    ],
    { inline: true },
  );
}

export function pawInline(requestId: string): VkKeyboard {
  return keyboard(
    [
      [
        button("✅ Подтвердить", "pawreq:yes", { id: requestId }, "positive"),
        button("❌ Отклонить", "pawreq:no", { id: requestId }, "negative"),
      ],
    ],
    { inline: true },
  );
}

export function userCardInline(
  userId: number,
  blocked: boolean,
  canManage: boolean,
): VkKeyboard {
  const rows: VkButton[][] = [
    [button("👤 Профиль", "user:view", { id: userId })],
  ];
  if (canManage) {
    rows.push([
      blocked
        ? button("✅ Разблокировать", "user:unblock", { id: userId }, "positive")
        : button("🚫 Заблокировать", "user:block", { id: userId }, "negative"),
    ]);
    rows.push([button("🗑 Удалить", "user:del", { id: userId }, "negative")]);
  }
  rows.push([button("⬅️ К списку", "admin:users")]);
  return keyboard(rows, { inline: true });
}

export function deleteUserInline(userId: number): VkKeyboard {
  return keyboard(
    [
      [
        button("🗑 Да, удалить", "user:delok", { id: userId }, "negative"),
        button("Отмена", "admin:users"),
      ],
    ],
    { inline: true },
  );
}

export function usersNavKeyboard(page: number, pages: number): VkKeyboard {
  const row: VkButton[] = [];
  if (page > 0) row.push(button("◀️ Назад", `admin:users:${page - 1}`));
  if (page < pages - 1) row.push(button("Вперёд ▶️", `admin:users:${page + 1}`));
  const rows: VkButton[][] = [];
  if (row.length > 0) rows.push(row);
  rows.push([button("⬅️ В админку", "admin")]);
  return keyboard(rows);
}

export function dailyKeyboard(): VkKeyboard {
  return keyboard([
    [button("✅ Выполнил(а)", "daily:done", undefined, "positive")],
    [button("⬅️ В меню", "menu")],
  ]);
}
