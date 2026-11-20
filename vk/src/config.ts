import "dotenv/config";

export const VK_TOKEN = process.env.VK_TOKEN?.trim() ?? "";
export const GROUP_ID = Number(process.env.VK_GROUP_ID ?? "243456924");

/** Владелец сообщества — Главная лапка. */
export const CREATOR_ID = Number(process.env.VK_CREATOR_ID ?? "670153615");

export const ADMIN_IDS = (process.env.ADMIN_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map(Number)
  .filter((value) => Number.isFinite(value) && value > 0);

export const CHAT_LINK = process.env.VK_CHAT_LINK?.trim() ?? "";
export const COMMUNITY_LINK =
  process.env.VK_COMMUNITY_LINK?.trim() || "https://vk.ru/akindpaw";

export const PORT = Number(process.env.PORT ?? 0);

export function isCreatorId(vkId: number): boolean {
  return vkId === CREATOR_ID;
}

export function isAdminId(vkId: number): boolean {
  return isCreatorId(vkId) || ADMIN_IDS.includes(vkId);
}
