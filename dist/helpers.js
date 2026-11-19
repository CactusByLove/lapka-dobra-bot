import { MENU_CAPTION } from "./texts.js";
import { mainMenu } from "./keyboards.js";
import { isAdmin, isMentor } from "./notify.js";
const lastBotMessage = new Map();
function chatIdOf(ctx) {
    return ctx.chat?.id ?? null;
}
/** Удаляет предыдущий экран бота в этом чате. */
export async function deletePrevious(ctx) {
    const chatId = chatIdOf(ctx);
    if (!chatId)
        return;
    const messageId = lastBotMessage.get(chatId);
    if (!messageId)
        return;
    lastBotMessage.delete(chatId);
    try {
        await ctx.api.deleteMessage(chatId, messageId);
    }
    catch {
        // Сообщение старше 48 часов или уже удалено — не критично.
    }
}
function track(ctx, messageId) {
    const chatId = chatIdOf(ctx);
    if (chatId)
        lastBotMessage.set(chatId, messageId);
}
/** Текстовый экран: удаляет предыдущий экран бота и отправляет новый. */
export async function sendScreen(ctx, text, options) {
    await deletePrevious(ctx);
    const message = await ctx.reply(text, options);
    track(ctx, message.message_id);
}
/**
 * Экран раздела. Отправляется текстом: у сообщений с фото Telegram
 * рисует кнопки полупрозрачными и на всю ширину картинки.
 */
export async function sendSection(ctx, _screen, text, keyboard) {
    await sendScreen(ctx, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
    });
}
/** Удаляет сообщение пользователя (команду или ответ в диалоге). */
export async function deleteUserMessage(ctx) {
    if (!ctx.message)
        return;
    try {
        await ctx.deleteMessage();
    }
    catch {
        // Старое сообщение или нет прав — не критично.
    }
}
/** Отправляет «баннер с кнопками» — главное меню бота. */
export async function sendMenu(ctx) {
    const admin = ctx.from ? isAdmin(ctx.from.id) : false;
    const mentor = ctx.from ? isMentor(ctx.from.id) : false;
    await sendSection(ctx, "main", MENU_CAPTION, mainMenu(admin, mentor));
}
/** Снимает inline-клавиатуру с сообщения, чтобы кнопкой нельзя было нажать дважды. */
export async function clearKeyboard(ctx) {
    try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    }
    catch {
        // Сообщение могло устареть — не критично.
    }
}
