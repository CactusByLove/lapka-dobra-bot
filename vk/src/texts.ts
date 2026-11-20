import { CHAT_LINK, COMMUNITY_LINK } from "./config.js";
import {
  DIRECTIONS,
  IDEA_STATUS_LABEL,
  PAW_RATES,
  ROLE_EMOJI,
  ROLE_LABEL,
  levelForPaws,
  nextLevel,
} from "./levels.js";
import type { IdeaRecord, UserRecord } from "./types.js";

export const MENU_CAPTION = `🐾 Лапка Добра — волонтёрский конструктор.

Прийти можно в готовое. Мы помогаем сделать своё.

Здесь можно попробовать себя, предложить идею и вырасти до наставника. Выбери, с чего начнём 👇`;

export const HOW_IT_WORKS = `📚 Как это работает

1. Заполняешь заявку — рассказываешь о себе и выбираешь направление.
2. Главная лапка или координатор проверяет её.
3. После одобрения открываются чат команды, расписание и первое дело на 2–3 часа с наставником.
4. За дела начисляются лапки — это внутренняя валюта проекта. Копишь уровень и бонусы.
5. Предлагаешь идеи — они проходят проверку и попадают в банк идей.

Никаких взносов и обязательств: пробуешь столько, сколько хочешь.`;

export const SAFETY_TEXT = `🛡 Правила и безопасность

• Мы не просим деньги, паспорт и банковские данные.
• Личные контакты и реклама — только через координатора, не в заявках и идеях.
• Участникам 14–17 лет нужно письменное согласие родителей.
• Встречи — в людных местах, о выездах предупреждаем заранее.
• Если что-то тревожит — напиши координатору сообщества, разберёмся.

Бережём людей и животных: сначала безопасность, потом результат.`;

export const CONTACT_TEXT = `✉️ Связаться

Все новости, набор и ответы на вопросы — в сообществе проекта.

💬 ${COMMUNITY_LINK}

Напиши в сообщения сообщества — ответит Главная лапка или координатор.`;

export const DIRECTIONS_TEXT = `🧭 Направления

${DIRECTIONS.map((d) => `${d.emoji} ${d.label}`).join("\n")}

Направление можно поменять позже — это не навсегда.`;

export function dealsText(): string {
  return `📅 Ближайшие дела

• Знакомство с командой — онлайн, 40 минут
• Вводный практикум по направлению
• Первое дело с наставником — 2–3 часа
• Разбор после дела — 20 минут

Точное расписание приходит в чат команды после одобрения заявки.`;
}

const DAILY_TASKS = [
  { title: "Напиши короткий отзыв о деле", text: "Пять предложений: что получилось, что было трудно, что повторишь." },
  { title: "Помоги новичку", text: "Ответь на один вопрос новичка в чате команды или подскажи, с чего начать." },
  { title: "Идея на 1 час", text: "Придумай маленькое доброе дело, которое можно сделать за час." },
  { title: "Собери обратную связь", text: "Спроси у двух человек, что бы они улучшили в проекте." },
  { title: "Подготовь анонс", text: "Напиши короткий пост о ближайшем деле — 3–5 строк." },
  { title: "Разбери чужую идею", text: "Возьми идею из банка и напиши, как её усилить." },
  { title: "Проверь своё направление", text: "Найди одно событие рядом и расскажи о нём команде." },
];

export function dailyTask(index: number): { title: string; text: string } {
  return DAILY_TASKS[index % DAILY_TASKS.length];
}

export function pawRatesText(): string {
  return `🐾 За что дают лапки

${PAW_RATES.map((rate) => `• ${rate.title} — ${rate.paws}`).join("\n")}

Лимит — 100 лапок в неделю. Начисления подтверждает наставник или координатор.`;
}

export function profileText(user: UserRecord): string {
  const level = levelForPaws(user.paws);
  const next = nextLevel(user.paws);
  return `${ROLE_EMOJI[user.role]} ${user.nickname}, ты в команде

${ROLE_LABEL[user.role]} · ${user.direction}
Уровень: ${level.name}
Лапки: ${user.paws}${next ? ` (до «${next.name}» — ${next.minPaws - user.paws})` : " — максимум"}
Серия: ${user.streak} дн. подряд
Статус заявки: ${user.status === "approved" ? "одобрена" : "на проверке"}`;
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
Направление: ${user.direction}
Возраст: ${user.age}
Лапки: ${user.paws} · серия: ${user.streak}
Блокировка: ${user.blocked ? "да" : "нет"}
Создан: ${user.createdAt.slice(0, 10)}`;
}

export function applicationText(user: UserRecord): string {
  const consent =
    user.age <= 17
      ? user.parentConsent && user.parentConsentFileId
        ? "документ получен ✅"
        : "НЕТ ❌"
      : "не требуется";
  return `🐾 Новая заявка в команду

👤 ${user.nickname}${user.username ? ` (vk.com/${user.username})` : ""}
🏷 Имя: ${user.name}
🎂 ${user.age} лет · ${ROLE_LABEL[user.role]}
🧭 ${user.direction}
🛡 Согласие родителей: ${consent}
🆔 ${user.tgId}`;
}

export function approvalText(user: UserRecord, paws: number): string {
  const chat = CHAT_LINK ? `\n\n💬 Чат команды: ${CHAT_LINK}` : "";
  return `✅ ${user.nickname}, заявка одобрена!

Добро пожаловать в команду. Для входа и первого дела начислено +${paws} 🐾.${chat}

Посмотри «Как это работает» и «Ближайшие дела» — и выбирай, с чего начнём.`;
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
