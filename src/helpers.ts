import type { Context, InlineKeyboard } from "grammy";
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

const lastBotMessage = new Map<number, number>();

function chatIdOf(ctx: Context): number | null {
  return ctx.chat?.id ?? null;
}

/** Удаляет предыдущий экран бота в этом чате. */
export async function deletePrevious(ctx: Context): Promise<void> {
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

/**
 * Экран раздела. Отправляется текстом: у сообщений с фото Telegram
 * рисует кнопки полупрозрачными и на всю ширину картинки.
 */
export async function sendSection(
  ctx: Context,
  _screen: Screen,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
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
