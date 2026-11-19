import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { InputFile, type Context, type InlineKeyboard } from "grammy";
import { MENU_CAPTION } from "./texts.js";
import { mainMenu } from "./keyboards.js";
import { isAdmin, isMentor } from "./notify.js";

const assetsDir = fileURLToPath(new URL("../assets/", import.meta.url));

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

const lastBotMessage = new Map<number, number>();
const bannerFileIds = new Map<Screen, string>();

function chatIdOf(ctx: Context): number | null {
  return ctx.chat?.id ?? null;
}

async function deletePrevious(ctx: Context): Promise<void> {
  const chatId = chatIdOf(ctx);
  if (!chatId) return;
  const messageId = lastBotMessage.get(chatId);
  if (!messageId) return;
  lastBotMessage.delete(chatId);
  try {
    await ctx.api.deleteMessage(chatId, messageId);
  } catch {
    // Сообщение старше 48 часов или уже удалено — не критично.
  }
}

function track(ctx: Context, messageId: number): void {
  const chatId = chatIdOf(ctx);
  if (chatId) lastBotMessage.set(chatId, messageId);
}

/** Текстовый экран: удаляет предыдущий экран бота и отправляет новый. */
export async function sendScreen(
  ctx: Context,
  text: string,
  options?: Parameters<Context["reply"]>[1],
): Promise<void> {
  await deletePrevious(ctx);
  const message = await ctx.reply(text, options);
  track(ctx, message.message_id);
}

async function sendBanner(
  ctx: Context,
  photo: string | InputFile,
  caption: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await deletePrevious(ctx);
  const message = await ctx.replyWithPhoto(photo, {
    caption,
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
  track(ctx, message.message_id);
}

/**
 * Экран с баннером раздела. Если готового баннера нет или подпись
 * длиннее лимита Telegram — отправляет обычный текст.
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
    if (cached) {
      await sendBanner(ctx, cached, text, keyboard);
      return;
    }
    try {
      await deletePrevious(ctx);
      const message = await ctx.replyWithPhoto(new InputFile(file), {
        caption: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      track(ctx, message.message_id);
      const fileId = message.photo?.at(-1)?.file_id;
      if (fileId) bannerFileIds.set(screen, fileId);
      return;
    } catch {
      // Если фото не принято — отправим текстом ниже.
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

/** Отправляет «баннер + кнопки» — главное меню бота. */
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
