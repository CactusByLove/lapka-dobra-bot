import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { InputFile, type Context, type InlineKeyboard } from "grammy";
import { MENU_CAPTION } from "./texts.js";
import { mainMenu } from "./keyboards.js";
import { isAdmin, isMentor } from "./notify.js";

export type Screen =
  | "main"
  | "volunteer"
  | "idea"
  | "mentor"
  | "bank"
  | "profile"
  | "info"
  | "contact"
  | "admin"
  | "registration";

const assetsDir = fileURLToPath(new URL("../assets/", import.meta.url));
const lastBotMessages = new Map<number, number[]>();
const bannerFileIds = new Map<Screen, string>();

function chatIdOf(ctx: Context): number | null {
  return ctx.chat?.id ?? null;
}

/** Удаляет предыдущий экран бота в этом чате. */
export async function deletePrevious(ctx: Context): Promise<void> {
  const chatId = chatIdOf(ctx);
  if (!chatId) return;
  const ids = lastBotMessages.get(chatId);
  if (!ids || ids.length === 0) return;
  lastBotMessages.delete(chatId);
  for (const id of ids) {
    try {
      await ctx.api.deleteMessage(chatId, id);
    } catch {
      // Сообщение старше 48 часов или уже удалено — не критично.
    }
  }
}

function track(ctx: Context, messageId: number): void {
  const chatId = chatIdOf(ctx);
  if (!chatId) return;
  const ids = lastBotMessages.get(chatId) ?? [];
  ids.push(messageId);
  lastBotMessages.set(chatId, ids);
}

/** Текстовый экран: сначала отправляет новый, затем удаляет предыдущий. */
export async function sendScreen(
  ctx: Context,
  text: string,
  options?: Parameters<Context["reply"]>[1],
): Promise<void> {
  const message = await ctx.reply(text, options);
  await deletePrevious(ctx);
  track(ctx, message.message_id);
}

/**
 * Экран раздела: баннер отдельным фото, текст с кнопками — отдельным
 * сообщением. Клавиатура под фото рисуется полупрозрачной и на всю
 * ширину картинки, поэтому кнопки живут на текстовом сообщении.
 */
export async function sendSection(
  ctx: Context,
  screen: Screen,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  const file = join(assetsDir, `banner-${screen}.png`);

  if (text.length <= 1024 && existsSync(file)) {
    const cached = bannerFileIds.get(screen);
    let photoId: number | null = null;
    let fileId: string | null = null;
    try {
      const photo = await ctx.replyWithPhoto(cached ?? new InputFile(file));
      photoId = photo.message_id;
      fileId = photo.photo?.at(-1)?.file_id ?? null;
    } catch {
      photoId = null;
    }

    if (photoId) {
      if (fileId) bannerFileIds.set(screen, fileId);
      const message = await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      await deletePrevious(ctx);
      track(ctx, photoId);
      track(ctx, message.message_id);
      return;
    }
  }

  await sendScreen(ctx, text, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

/** Удаляет сообщение пользователя (команду или ответ в диалоге). */
export async function deleteUserMessage(ctx: Context): Promise<void> {
  if (!ctx.message) return;
  try {
    await ctx.deleteMessage();
  } catch {
    // Старое сообщение или нет прав — не критично.
  }
}

/** Отправляет «баннер с кнопками» — главное меню бота. */
export async function sendMenu(ctx: Context): Promise<void> {
  const admin = ctx.from ? isAdmin(ctx.from.id) : false;
  const mentor = ctx.from ? isMentor(ctx.from.id) : false;
  await sendSection(ctx, "main", MENU_CAPTION, mainMenu(admin, mentor));
}

/** Снимает inline-клавиатуру с сообщения, чтобы кнопкой нельзя было нажать дважды. */
export async function clearKeyboard(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Сообщение могло устареть — не критично.
  }
}
