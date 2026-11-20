import { bannerAttachment, send } from "./dist/vk.js";
import { menuKeyboard } from "./dist/keyboards.js";
import { MENU_CAPTION } from "./dist/texts.js";

const peerId = 670153615;
const attachment = await bannerAttachment("main", peerId);
const messageId = await send(peerId, MENU_CAPTION, {
  keyboard: menuKeyboard(true, true),
  attachment,
});
console.log("attachment:", attachment ? "ok" : "none");
console.log("message id:", messageId);
