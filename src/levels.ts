import type { Role } from "./types.js";

/** Лимит лапок в неделю — то же правило, что и на сайте */
export const WEEKLY_PAW_LIMIT = 100;

export const LEVELS = [
  { slug: "novice", name: "Новичок", minPaws: 0 },
  { slug: "intern", name: "Стажёр", minPaws: 35 },
  { slug: "member", name: "Участник", minPaws: 150 },
  { slug: "team", name: "Член команды", minPaws: 320 },
  { slug: "mentor", name: "Наставник", minPaws: 550 },
  { slug: "leader", name: "Лидер направления", minPaws: 900 },
] as const;

export type LevelDef = (typeof LEVELS)[number];

export function levelForPaws(paws: number): LevelDef {
  let current: LevelDef = LEVELS[0];
  for (const level of LEVELS) {
    if (paws >= level.minPaws) current = level;
  }
  return current;
}

export function nextLevel(paws: number) {
  return LEVELS.find((level) => level.minPaws > paws) ?? null;
}

/** Прозрачная таблица начислений (показывается в разделе «Мои лапки») */
export const PAW_RATES: Array<{ title: string; paws: number }> = [
  { title: "Входной практикум", paws: 10 },
  { title: "Модуль теории (тест ≥ 80%)", paws: 15 },
  { title: "Практическое дело", paws: 25 },
  { title: "Разбор после дела", paws: 10 },
  { title: "Отзыв наставника «хорошо» / «отлично»", paws: 5 },
  { title: "Помощь новичку", paws: 10 },
  { title: "Городское событие", paws: 15 },
  { title: "Смена наставника", paws: 20 },
  { title: "Бонус за полный цикл", paws: 30 },
  { title: "Бонус за серию без пропусков", paws: 20 },
  { title: "«Лапка месяца»", paws: 50 },
];

export const DIRECTIONS = [
  { key: "help", label: "Приюты и животные", emoji: "🐾" },
  { key: "eco", label: "Эко и город", emoji: "🌱" },
  { key: "media", label: "Медиа и контент", emoji: "🎬" },
  { key: "events", label: "События и проекты", emoji: "🎪" },
  { key: "people", label: "Помощь людям", emoji: "🤝" },
  { key: "culture", label: "Культура и библиотеки", emoji: "📚" },
  { key: "it", label: "IT и технологии", emoji: "💻" },
  { key: "unknown", label: "Ещё не знаю — помогите выбрать", emoji: "🧭" },
] as const;

export const ROLE_LABEL: Record<Role, string> = {
  volunteer: "Волонтёр",
  author: "Автор идеи",
  mentor: "Наставник",
};

export const IDEA_STATUS_LABEL: Record<string, string> = {
  review: "на разборе",
  team: "команда собрана",
  running: "реализуется",
  done: "реализовано",
  rejected: "отклонена",
};
