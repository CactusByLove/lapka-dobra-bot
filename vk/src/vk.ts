import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { VK } from "vk-io";
import { GROUP_ID, VK_TOKEN } from "./config.js";

export const vk = new VK({ token: VK_TOKEN, pollingGroupId: GROUP_ID });
export const api = vk.api;

export type ButtonColor = "primary" | "secondary" | "negative" | "positive";

export interface VkButton {
  action: { type: "callback"; label: string; payload: string };
  color?: ButtonColor;
}

export interface VkKeyboard {
  one_time: boolean;
  inline: boolean;
  buttons: VkButton[][];
}

export function button(
  label: string,
  cmd: string,
  extra?: Record<string, unknown>,
  color: ButtonColor = "secondary",
): VkButton {
  return {
    action: {
      type: "callback",
      label,
      payload: JSON.stringify({ c: cmd, ...extra }),
    },
    color,
  };
}

const assetsDir = fileURLToPath(new URL("../assets/", import.meta.url));
const bannerAttachments = new Map<string, string>();
const lastMessages = new Map<number, number[]>();

async function uploadMessagePhoto(
  peerId: number,
  file: string,
): Promise<string | undefined> {
  try {
    const upload = await api.photos.getMessagesUploadServer({
      peer_id: peerId,
    });
    const buffer = await readFile(file);
    const form = new FormData();
    form.append("photo", new Blob([buffer], { type: "image/png" }), "banner.png");
    const response = await fetch(upload.upload_url, {
      method: "POST",
      body: form,
    });
    const data = (await response.json()) as {
      server?: number;
      photo?: string;
      hash?: string;
    };
    if (!data.server || !data.photo || !data.hash) return undefined;
    const saved = await api.photos.saveMessagesPhoto({
      server: data.server,
      photo: data.photo,
      hash: data.hash,
    });
    const photo = saved[0] as unknown as {
      owner_id?: number;
      ownerId?: number;
      id?: number;
    };
    const owner = photo.owner_id ?? photo.ownerId;
    if (!owner || !photo.id) return undefined;
    return `photo${owner}_${photo.id}`;
  } catch (error) {
    console.error("photo upload:", error);
    return undefined;
  }
}

export async function bannerAttachment(
  screen: string,
  peerId: number,
): Promise<string | undefined> {
  const cached = bannerAttachments.get(screen);
  if (cached) return cached;
  const file = join(assetsDir, `banner-${screen}.png`);
  if (!existsSync(file)) return undefined;
  try {
    const attachment = await uploadMessagePhoto(peerId, file);
    if (!attachment) return undefined;
    bannerAttachments.set(screen, attachment);
    return attachment;
  } catch (error) {
    console.error("banner upload:", error);
    return undefined;
  }
}

export interface SendOptions {
  keyboard?: VkKeyboard;
  attachment?: string;
}

export async function send(
  peerId: number,
  text: string,
  options?: SendOptions,
): Promise<number | null> {
  try {
    const result = await api.messages.send({
      peer_id: peerId,
      message: text,
      random_id: Math.floor(Math.random() * 2_000_000_000),
      keyboard: options?.keyboard ? JSON.stringify(options.keyboard) : undefined,
      attachment: options?.attachment,
    });
    return typeof result === "number" ? result : null;
  } catch (error) {
    console.error("messages.send:", error);
    return null;
  }
}

function track(peerId: number, messageId: number): void {
  const ids = lastMessages.get(peerId) ?? [];
  ids.push(messageId);
  lastMessages.set(peerId, ids);
}

export async function deletePrevious(peerId: number): Promise<void> {
  const ids = lastMessages.get(peerId);
  if (!ids || ids.length === 0) return;
  lastMessages.delete(peerId);
  try {
    await api.messages.delete({
      message_ids: ids,
      delete_for_all: 1,
    });
  } catch {
    // Сообщение уже удалено или прав не хватает — не критично.
  }
}

/** Сначала отправляет новый экран, затем удаляет предыдущий. */
export async function replaceScreen(
  peerId: number,
  text: string,
  options?: SendOptions,
): Promise<number | null> {
  const messageId = await send(peerId, text, options);
  if (messageId === null) return null;
  await deletePrevious(peerId);
  track(peerId, messageId);
  return messageId;
}

/** Экран с баннером: фото и текст в одном сообщении, клавиатура — снизу. */
export async function sendScreen(
  peerId: number,
  screen: string,
  text: string,
  keyboard?: VkKeyboard,
): Promise<void> {
  const attachment = await bannerAttachment(screen, peerId);
  await replaceScreen(peerId, text, { keyboard, attachment });
}

export async function answerEvent(
  eventId: string,
  userId: number,
  peerId: number,
  text?: string,
): Promise<void> {
  try {
    await api.messages.sendMessageEventAnswer({
      event_id: eventId,
      user_id: userId,
      peer_id: peerId,
      event_data: text
        ? JSON.stringify({ type: "show_snackbar", text })
        : undefined,
    });
  } catch {
    // Не критично: событие всё равно обработано.
  }
}
