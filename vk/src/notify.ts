import { ADMIN_IDS, CREATOR_ID } from "./config.js";
import { allUsers } from "./storage.js";
import { send, type VkKeyboard } from "./vk.js";
import type { Role } from "./types.js";

function exactRoleIds(roles: Role[]): number[] {
  const ids = new Set<number>();
  for (const user of allUsers()) {
    if (user.status === "approved" && roles.includes(user.role)) {
      ids.add(user.tgId);
    }
  }
  return [...ids];
}

export function staffIds(roles?: Role[]): number[] {
  const ids = new Set<number>(ADMIN_IDS);
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

export async function notifyStaff(
  text: string,
  keyboard?: VkKeyboard,
  roles?: Role[],
): Promise<void> {
  for (const id of staffIds(roles)) {
    await send(id, text, { keyboard });
  }
}

/** Только Главная лапка: модерация идей и финальные решения. */
export async function notifyCreator(
  text: string,
  keyboard?: VkKeyboard,
): Promise<void> {
  const ids = new Set<number>([CREATOR_ID, ...exactRoleIds(["creator"])]);
  for (const id of ids) {
    await send(id, text, { keyboard });
  }
}

/** Только волонтёры: анонсы опубликованных идей. */
export async function notifyVolunteers(
  text: string,
  keyboard?: VkKeyboard,
): Promise<void> {
  for (const id of exactRoleIds(["volunteer"])) {
    await send(id, text, { keyboard });
  }
}
