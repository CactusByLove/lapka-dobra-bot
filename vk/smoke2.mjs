import { handleCallbackEvent } from "./dist/bot.js";
const user = 670153615;
const events = ["admin:apps", "admin:ideas", "admin:paws", "mentor", "mentor:apps", "mentor:paws"];
for (const c of events) {
  await handleCallbackEvent({ userId: user, peerId: user, eventId: "0", payload: { c } });
  await new Promise((r) => setTimeout(r, 900));
}
console.log("smoke2 ok");
