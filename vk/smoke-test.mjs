import { handleCallbackEvent } from "./dist/bot.js";

const user = 670153615;
const events = ["profile", "bank", "daily", "how", "admin", "admin:users"];

for (const c of events) {
  await handleCallbackEvent({
    userId: user,
    peerId: user,
    eventId: "0",
    payload: { c },
  });
  await new Promise((resolve) => setTimeout(resolve, 900));
}

console.log("smoke ok");
