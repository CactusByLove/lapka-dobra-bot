import {
  PAW_RATES,
  levelForPaws,
  nextLevel,
  IDEA_STATUS_LABEL,
  ROLE_EMOJI,
  ROLE_LABEL,
} from "./levels.js";
import type { IdeaRecord, UserRecord } from "./types.js";

export const VK_URL = process.env.VK_URL || "https://vk.ru/akindpaw";
export const CHAT_INVITE_URL =
  process.env.CHAT_INVITE_URL || "https://t.me/+q2NACub1UvU1Yjgy";

export const MENU_CAPTION = `🐾 <b>Лапка Добра</b> — волонтёрский конструктор.

Прийти можно в готовое. Мы помогаем <b>сделать своё</b>.

Здесь можно попробовать себя, предложить идею и вырасти до наставника. Выбери, с чего начнём 👇`;

export const HOW_IT_WORKS = `📚 <b>Как это работает</b>

<b>1. Заявка и знакомство</b>
Короткая анкета → чат новичков → координатор и правила безопасности.

<b>2. Обучение и проба</b>
Мини-курсы Добро.Университета и первое дело на 2–3 часа с наставником.

<b>3. Практика и разбор</b>
Серия реальных дел, разбор после каждого, лапки и бейджи.

<b>4. Рост до команды</b>
Новый уровень, выбор направления и роль в полноценной команде.

🐾 Лапки — не деньги. Их нельзя купить, обменять или передать. Только заработать делом. Уровни тоже не покупаются.`;

export const DIRECTIONS_TEXT = `🧭 <b>Направления</b>

Они открываются внутри сообщества — выбирать заранее не нужно:

• <b>Обучение</b> — курсы, практикумы, разборы
• <b>Практика</b> — реальные дела в городе
• <b>Идеи</b> — банк идей и сборка команд
• <b>Медиа</b> — съёмка, монтаж, тексты, соцсети
• <b>Проекты</b> — своё дело от идеи до результата
• <b>События</b> — практикумы, форумы, ярмарки
• <b>Команды</b> — клубы по интересам
• <b>Наставничество</b> — подготовка наставников
• <b>Экспертиза</b> — точечная помощь 25–35

Направление выбирают после первого дела — спокойно и без спешки.`;

export const SAFETY_TEXT = `🛡 <b>Правила и безопасность</b>

• 14–17 лет — только с согласия родителей. Без него заявка не активируется.
• Публикация фото — только с согласия.
• Лапки нельзя купить, продать или передать другому.
• На делах — инструктаж и сопровождение наставника.
• Спорные ситуации решают наставник и координатор.
• Никакой политики, религии и сборов денег.

Если что-то пошло не так — сразу пиши координатору, не оставайся с этим один.`;

export const CONTACT_TEXT = `✉️ <b>Связаться</b>

Наша группа ВКонтакте: ${VK_URL}

Там анонсы дел, фото и новости проекта. Отвечаем в течение дня, заявки и идеи разбираем до 3 дней.`;

export function approvalText(user: UserRecord, granted: number): string {
  return `🎉 <b>Ты в команде «Лапка Добра»!</b>

${escapeHtml(user.nickname)}, твоя заявка одобрена. Мы рады, что ты с нами.

<b>Что дальше:</b>
• зайди в общий чат команды — там знакомство и расписание;
• первое дело — 2–3 часа вместе с наставником;
• в «Моих лапках» уже <b>+${granted} 🐾</b> за входной практикум.

Добро начинается с маленького шага 🐾`;
}

export function profileText(user: UserRecord): string {
  const level = levelForPaws(user.paws);
  const upcoming = nextLevel(user.paws);
  const remaining = upcoming ? upcoming.minPaws - user.paws : 0;
  const statusLabel =
    user.status === "approved"
      ? "в команде ✅"
      : user.status === "pending"
        ? "на проверке ⏳"
        : user.status === "rejected"
          ? "отклонена"
          : "нужна доработка";

  const heading =
    user.role === "creator"
      ? `👑 <b>${user.nickname}</b> · Главная лапка · создатель проекта`
      : `🏅 <b>${user.nickname}</b> · ${ROLE_LABEL[user.role]} · ${user.age} лет`;

  const nameLine =
    user.nickname === user.name ? "" : `\n<b>Имя:</b> ${escapeHtml(user.name)}`;

  return `${heading}${nameLine}

<b>Уровень:</b> ${level.name}
<b>Лапки:</b> ${user.paws} 🐾
<b>За неделю:</b> ${user.pawsThisWeek}/100
${upcoming ? `<b>До «${upcoming.name}»:</b> ${remaining} лапок` : "<b>Максимальный уровень достигнут</b>"}
<b>Серия:</b> 🔥 ${user.streak} дн.
<b>Заявка:</b> ${statusLabel}
<b>Направление:</b> ${user.direction}`;
}

export function adminUserCard(user: UserRecord): string {
  const statusLabel =
    user.status === "approved"
      ? "в команде ✅"
      : user.status === "pending"
        ? "на проверке ⏳"
        : user.status === "rejected"
          ? "отклонена"
          : "нужна доработка";
  const roleLine =
    user.role === "creator"
      ? "👑 Главная лапка · создатель"
      : `${ROLE_EMOJI[user.role]} ${ROLE_LABEL[user.role]} · ${user.age} лет`;

  return `👤 <b>${escapeHtml(user.nickname)}</b>${
    user.username ? ` (@${escapeHtml(user.username)})` : ""
  }
🏷 Имя: ${escapeHtml(user.name)}
${roleLine}
🧭 ${escapeHtml(user.direction)}
📌 ${statusLabel}${user.blocked ? " · 🚫 заблокирован(а)" : ""}
🐾 ${user.paws} · 🔥 ${user.streak} дн.
🆔 <code>${user.tgId}</code>`;
}

export function adminUserDetails(user: UserRecord): string {
  const created = new Date(user.createdAt).toLocaleDateString("ru-RU", {
    timeZone: process.env.TIMEZONE || "Asia/Yekaterinburg",
  });
  return `${adminUserCard(user)}

📅 В проекте с: ${created}
🕒 Последняя активность: ${user.lastActivityDate ?? "—"}
🎯 Лапка дня: ${user.lastDailyDate ?? "—"}
🏅 Неделя: ${user.pawsThisWeek}/${100}`;
}

export function pawRatesText(): string {
  const rows = PAW_RATES.map((r) => `• ${r.title} — <b>${r.paws}</b>`).join("\n");
  return `🐾 <b>За что дают лапки</b>

${rows}

Лимит — <b>100 лапок в неделю</b>. Часть начислений подтверждает наставник или координатор. История и статусы — в разделе «Мои лапки».`;
}

export function bankText(ideas: IdeaRecord[]): string {
  if (ideas.length === 0) {
    return `🗂 <b>Банк идей</b>

Пока пусто. Твоя идея может стать первой — нажми «Предложить идею» в меню.`;
  }
  const rows = ideas
    .slice(0, 7)
    .map(
      (idea) =>
        `• <b>${escapeHtml(idea.title)}</b> — ${IDEA_STATUS_LABEL[idea.status] ?? idea.status}\n  <i>${escapeHtml(idea.authorName)}</i>`,
    )
    .join("\n");
  return `🗂 <b>Банк идей</b>

${rows}

Идея проходит путь: разбор → команда → реализация → признание.`;
}

export function dealsText(): string {
  const fmt = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      timeZone: process.env.TIMEZONE || "Asia/Yekaterinburg",
    }).format(d);
  };
  return `📅 <b>Ближайшие дела</b>

🐾 <b>Помощь приюту «Верный друг»</b>
${fmt(3)} · 3 часа · ул. Строителей, 12

📚 <b>Разбор книг для библиотеки</b>
${fmt(6)} · 2 часа · Городская библиотека

🎓 <b>Практикум «Первая лапка»</b>
${fmt(8)} · 2 часа · Добро.Центр

Записаться можно через координатора. Первое дело — всегда с наставником.`;
}

export const DAILY_TASKS: Array<{ title: string; text: string }> = [
  {
    title: "Доброе сообщение",
    text: "Напиши одному человеку, которому будет приятно. Без повода, просто так.",
  },
  {
    title: "10 минут тишины",
    text: "Остановись на 10 минут и честно ответь себе: что мне интересно делать? Запиши три пункта.",
  },
  {
    title: "Один вопрос координатору",
    text: "Задай координатору любой вопрос о проекте, который давно откладывал.",
  },
  {
    title: "Идея на салфетке",
    text: "Придумай одну идею, которая улучшит двор, школу или библиотеку. Пока не отправляй — просто запиши.",
  },
  {
    title: "Разбери один страх",
    text: "Назови, чего ты боишься в волонтёрстве. Одно предложение. С этим уже можно работать.",
  },
  {
    title: "Помоги новичку",
    text: "Если знаешь кого-то, кто хочет начать, — расскажи ему про «Лапку Добра».",
  },
  {
    title: "Посмотри одно дело",
    text: "Открой «Ближайшие дела» и выбери то, на которое готов прийти. Без обязательств.",
  },
];

export function dailyTask(index: number) {
  return DAILY_TASKS[index % DAILY_TASKS.length];
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
