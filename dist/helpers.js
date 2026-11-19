import { fileURLToPath } from "node:url";
import { InputFile } from "grammy";
import { MENU_CAPTION } from "./texts.js";
import { mainMenu } from "./keyboards.js";
import { isAdmin } from "./notify.js";
const bannerPath = fileURLToPath(new URL("../assets/banner.png", import.meta.url));
/** Отправляет «банер + кнопки» — главное меню бота. */
export async function sendMenu(ctx) {
    const admin = ctx.from ? isAdmin(ctx.from.id) : false;
    try {
        await ctx.replyWithPhoto(new InputFile(bannerPath), {
            caption: MENU_CAPTION,
            parse_mode: "HTML",
            reply_markup: mainMenu(admin),
        });
    }
    catch {
        // Баннер ещё не сгенерирован или фото не принято — меню всё равно работает.
        await ctx.reply(MENU_CAPTION, {
            parse_mode: "HTML",
            reply_markup: mainMenu(admin),
        });
    }
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
