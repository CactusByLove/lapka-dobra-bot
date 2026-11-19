import { InlineKeyboard, type Bot } from "grammy";
import { registerAdmin } from "./admin.js";
import { registerMentor } from "./mentor.js";
import { ideaTextStep, registerIdeas } from "./ideas.js";
import { registerProfile } from "./profile.js";
import { regMediaStep, regTextStep, registerRegistration } from "./registration.js";
import { sessionsStore } from "./state.js";
import { CALLBACKS } from "./keyboards.js";
import { deleteUserMessage, sendScreen } from "./helpers.js";
import { getUser } from "./storage.js";
import { isAdmin } from "./notify.js";

function menuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🐾 В меню", CALLBACKS.MAIN);
}

export function registerHandlers(bot: Bot): void {
  bot.use(async (ctx, next) => {
    const tgId = ctx.from?.id;
    if (!tgId) return next();
    const user = getUser(tgId);
    if (user?.blocked && !isAdmin(tgId)) {
      if (ctx.callbackQuery) {
        await ctx
          .answerCallbackQuery({ text: "Доступ ограничен", show_alert: true })
          .catch(() => undefined);
      } else if (ctx.message) {
        await ctx
          .reply("Доступ к боту ограничен координатором.")
          .catch(() => undefined);
      }
      return;
    }
    return next();
  });

  registerProfile(bot);
  registerRegistration(bot);
  registerIdeas(bot);
  registerAdmin(bot);
  registerMentor(bot);

  // Текстовые шаги диалогов: имя, возраст, вопросы идеи.
  bot.on("message:text", async (ctx) => {
    await deleteUserMessage(ctx);
    const session = sessionsStore.get(ctx.from.id);
    if (!session) {
      await sendScreen(
        ctx,
        "Я рядом 🐾 Открой меню — там заявка в команду, идеи, лапки и ближайшие дела.",
        { reply_markup: menuKeyboard() },
      );
      return;
    }
    if (await regTextStep(ctx, session)) return;
    if (await ideaTextStep(ctx, session)) return;
    await sendScreen(ctx, "Не понял шаг. Открой меню и начни заново.", {
      reply_markup: menuKeyboard(),
    });
  });

  // Документ согласия родителей.
  bot.on(["message:photo", "message:document"], async (ctx) => {
    const session = sessionsStore.get(ctx.from.id);
    if (!session) return;
    if (session.kind === "reg:consentDoc") {
      await regMediaStep(ctx, session);
      return;
    }
    if (session.kind.startsWith("reg:") || session.kind.startsWith("idea:")) {
      await sendScreen(
        ctx,
        "Сейчас это не нужно — продолжим по шагам. Отправь текст.",
      );
    }
  });

  // Всё остальное: стикеры, голосовые и прочее.
  bot.on("message", async (ctx) => {
    await sendScreen(
      ctx,
      "Я понимаю текст, фото и файлы. Открой меню кнопкой ниже.",
      { reply_markup: menuKeyboard() },
    );
  });
}
