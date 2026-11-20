import { CHAT_LINK, COMMUNITY_LINK } from "./config.js";
import {
  IDEA_STATUS_LABEL,
  ROLE_EMOJI,
  ROLE_LABEL,
  levelForPaws,
  nextLevel,
} from "./levels.js";
import type { IdeaRecord, UserRecord } from "./types.js";

export const PROJECT_NAME = "Лапка Добра";

export const MENU_CAPTION = `🐾 Лапка Добра — волонтёрский конструктор.

Прийти можно в готовое. Мы помогаем сделать своё.

Здесь можно попробовать себя, предложить идею и вырасти до наставника. Выбери, с чего начнём 👇`;

export const HOW_IT_WORKS = `📚 Как это работает

1. Заявка. Заполняешь короткую анкету: имя, никнейм, возраст. Без документов и лишних формальностей.
2. Проверка. Главная лапка или координатор смотрит заявку и одобряет её в течение дня.
3. Команда. После одобрения открываются чат команды, расписание и первое дело на 2–3 часа с наставником.
4. Лапки. За каждое дело начисляются лапки — это уровень, а не деньги. Лимит — 100 лапок в неделю.
5. Рост. Новичок → Стажёр → Участник → Член команды → Наставник → Лидер направления.
6. Идеи. Предлагаешь идею — автопроверка убирает мат и спам, затем Главная лапка решает, публиковать ли её.
7. Банк идей. Одобренные идеи видны всей команде: название, автор и номер. Дальше — обсуждение и работа.

Никаких взносов и обязательств: пробуешь столько, сколько хочешь.`;

export const SAFETY_TEXT = `🛡 Правила и безопасность

• Мы не просим деньги, паспорт и банковские данные.
• Уважение обязательно: без оскорблений, травли и провокаций.
• В заявках и идеях запрещены мат, реклама, ссылки и телефоны — это проверяет модератор.
• Участникам 14–17 лет: расскажи родителям, где ты участвуешь.
• Встречи — в людных местах, о выездах предупреждаем заранее.
• Не публикуй чужие личные данные и фото без согласия.
• Если что-то тревожит — напиши Главной лапке: @tima.ugansk, +7 922 772-95-56.

Бережём людей и животных: сначала безопасность, потом результат.`;

export const CONTACT_TEXT = `✉️ Связаться

Главная лапка проекта:
• ВКонтакте: @tima.ugansk
• Телефон: +7 922 772-95-56

Сообщество: ${COMMUNITY_LINK}

Пиши по любым вопросам: заявки, идеи, встречи, сложные ситуации.`;

export function dealsText(): string {
  return `📅 Ближайшие дела

• Знакомство с командой — онлайн, 40 минут
• Вводный практикум по выбранному направлению
• Первое дело с наставником — 2–3 часа
• Разбор после дела — 20 минут

Точное расписание приходит в чат команды после одобрения заявки.`;
}

export function leaderboardText(users: UserRecord[]): string {
  if (users.length === 0) {
    return `🏆 Лучшие волонтёры

Пока никого нет — стань первым: заполни заявку и получи первые лапки.`;
  }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = users.map((user, index) => {
    const level = levelForPaws(user.paws);
    return `${medals[index] ?? "•"} ${user.nickname} — ${user.paws} 🐾 · ${level.name}`;
  });
  return `🏆 Лучшие волонтёры проекта

${lines.join("\n")}

Лапки — это уровень участия. Топ обновляется по итогам дел.`;
}

export function profileText(user: UserRecord): string {
  const level = levelForPaws(user.paws);
  const next = nextLevel(user.paws);
  const progress = next
    ? `До «${next.name}»: ${next.minPaws - user.paws} 🐾`
    : "Максимальный уровень — ты легенда ✨";
  const status =
    user.status === "approved"
      ? "в команде"
      : user.status === "pending"
        ? "заявка на проверке"
        : user.status === "need_rework"
          ? "нужна доработка"
          : "заявка отклонена";
  return `${ROLE_EMOJI[user.role]} Мой профиль

👤 ${user.nickname}
${ROLE_LABEL[user.role]} · ${status}
🏅 ${level.name}
🐾 Лапки: ${user.paws}
${progress}
🔥 Серия: ${user.streak} дн. подряд
🎂 ${user.age} лет
📅 В проекте с ${user.createdAt.slice(0, 10)}`;
}

export function adminUserCard(user: UserRecord): string {
  return `${ROLE_EMOJI[user.role]} ${user.nickname} · ${user.tgId}
${ROLE_LABEL[user.role]} · ${user.status}${user.blocked ? " · заблокирован" : ""} · ${user.paws} 🐾`;
}

export function adminUserDetails(user: UserRecord): string {
  return `${ROLE_EMOJI[user.role]} ${user.nickname}

Имя: ${user.name}
VK: ${user.username ? `vk.com/${user.username}` : "—"}
ID: ${user.tgId}
Роль: ${ROLE_LABEL[user.role]}
Статус: ${user.status}
Возраст: ${user.age}
Лапки: ${user.paws} · серия: ${user.streak}
Блокировка: ${user.blocked ? "да" : "нет"}
Создан: ${user.createdAt.slice(0, 10)}`;
}

export function applicationText(user: UserRecord): string {
  return `🐾 Новая заявка в команду

👤 ${user.nickname}${user.username ? ` (vk.com/${user.username})` : ""}
🏷 Имя: ${user.name}
🎂 ${user.age} лет · ${ROLE_LABEL[user.role]}
🆔 ${user.tgId}`;
}

export function approvalText(user: UserRecord, paws: number): string {
  const chat = CHAT_LINK ? `\n\n💬 Чат команды: ${CHAT_LINK}` : "";
  return `✅ ${user.nickname}, заявка одобрена!

Добро пожаловать в команду. Для входа и первого дела начислено +${paws} 🐾.${chat}

Открой «Мой профиль» и «Как это работает» — и выбирай, с чего начнём.`;
}

export function ideaCard(idea: IdeaRecord): string {
  return `💡 ${idea.title}

Автор: ${idea.authorName}
Статус: ${IDEA_STATUS_LABEL[idea.status] ?? idea.status}

Что: ${idea.what}
Для кого: ${idea.audience}
Зачем: ${idea.goal}
Что нужно: ${idea.needs}`;
}

export function bankLine(index: number, idea: IdeaRecord): string {
  return `${index}. ${idea.title} — ${idea.authorName} · «${PROJECT_NAME}»`;
}
