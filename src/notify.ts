import type { Api, InlineKeyboard } from "grammy";
import { allUsers, getUser } from "./storage.js";
import type { Role } from "./types.js";

/** Главная лапка проекта. Можно переопределить через CREATOR_ID. */
export const CREATOR_ID = Number(process.env.CREATOR_ID ?? "8213415725");

export function adminIds(): number[] {
  return (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function isCreator(tgId: number): boolean {
  return tgId === CREATOR_ID || getUser(tgId)?.role === "creator";
}

export function isCoordinator(tgId: number): boolean {
  return getUser(tgId)?.role === "coordinator";
}

/** Полный доступ к админке: Главная лапка, координаторы и ADMIN_IDS. */
export function isAdmin(tgId: number): boolean {
  return isCreator(tgId) || isCoordinator(tgId) || adminIds().includes(tgId);
}

export function isMentor(tgId: number): boolean {
  return getUser(tgId)?.role === "mentor";
}

/** Наставник или кто-то выше — допущен к панели наставника. */
export function isStaff(tgId: number): boolean {
  return isAdmin(tgId) || isMentor(tgId);
}

/**
 * Кому отправлять уведомление.
 * Без roles — вся команда: создатель, координаторы, наставники.
 * env ADMIN_IDS всегда считаются координаторами.
 */
export function staffIds(roles?: Role[]): number[] {
  const ids = new Set<number>(adminIds());
  for (const user of allUsers()) {
    if (user.status !== "approved") continue;
    if (roles) {
      if (roles.includes(user.role)) ids.add(user.tgId);
      continue;
    }
    if (
      user.role === "creator" ||
      user.role === "coordinator" ||
      user.role === "mentor"
    ) {
      ids.add(user.tgId);
    }
  }
  return [...ids];
}

/** Строго по ролям, без добавления ADMIN_IDS. */
function exactRoleIds(roles: Role[]): number[] {
  const ids = new Set<number>();
  for (const user of allUsers()) {
    if (user.status === "approved" && roles.includes(user.role)) {
      ids.add(user.tgId);
    }
  }
  return [...ids];
}

async function sendToIds(
  api: Api,
  ids: number[],
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  for (const tgId of ids) {
    try {
      await api.sendMessage(tgId, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch {
      // Собеседник мог не начинать диалог с ботом — это не повод падать.
    }
  }
}

/** Рассылка выбранной группе ролей. */
export async function notifyRoles(
  api: Api,
  roles: Role[] | undefined,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await sendToIds(api, staffIds(roles), text, keyboard);
}

/** Создатель и координаторы — те, кто принимает решения по заявкам. */
export async function notifyAdmins(
  api: Api,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await notifyRoles(api, ["creator", "coordinator"], text, keyboard);
}

/** Наставники — информирование и их собственные задачи. */
export async function notifyMentors(
  api: Api,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await notifyRoles(api, ["mentor"], text, keyboard);
}

/** Вся команда: создатель, координаторы, наставники. */
export async function notifyAllStaff(
  api: Api,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await notifyRoles(api, undefined, text, keyboard);
}

/** Только Главная лапка — модерация идей и финальные решения. */
export async function notifyCreator(
  api: Api,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await sendToIds(api, exactRoleIds(["creator"]), text, keyboard);
}

/** Только волонтёры — публичные анонсы идей. */
export async function notifyVolunteers(
  api: Api,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await sendToIds(api, exactRoleIds(["volunteer"]), text, keyboard);
}
