import type { Role } from "./types.js";

export interface RegBase {
  role: Role;
  name: string;
  nickname: string;
  age: number;
  parentConsent: boolean;
  parentConsentFileId: string | null;
}

export interface RegDraft extends RegBase {
  direction: string;
}

export type Session =
  | { kind: "reg:name"; role: Role }
  | { kind: "reg:nickname"; role: Role; name: string }
  | { kind: "reg:age"; role: Role; name: string; nickname: string }
  | { kind: "reg:consent"; role: Role; name: string; nickname: string; age: number }
  | { kind: "reg:consentDoc"; role: Role; name: string; nickname: string; age: number; parentConsent: boolean }
  | { kind: "reg:direction"; base: RegBase }
  | { kind: "reg:confirm"; draft: RegDraft }
  | { kind: "idea:title" }
  | { kind: "idea:what"; title: string }
  | { kind: "idea:audience"; title: string; what: string }
  | { kind: "idea:goal"; title: string; what: string; audience: string }
  | { kind: "idea:needs"; title: string; what: string; audience: string; goal: string };

const sessions = new Map<number, Session>();

export const sessionsStore = {
  get(tgId: number): Session | null {
    return sessions.get(tgId) ?? null;
  },
  set(tgId: number, session: Session): void {
    sessions.set(tgId, session);
  },
  clear(tgId: number): void {
    sessions.delete(tgId);
  },
};
