export type Role = "volunteer" | "author" | "mentor";
export type AppStatus = "pending" | "approved" | "rejected" | "need_rework";
export type IdeaStatus = "review" | "team" | "running" | "done" | "rejected";
export type PawRequestStatus = "pending" | "approved" | "rejected";

export interface UserRecord {
  tgId: number;
  username: string | null;
  name: string;
  age: number;
  role: Role;
  direction: string;
  parentConsent: boolean;
  parentConsentFileId: string | null;
  status: AppStatus;
  paws: number;
  /** ISO-дата начала недели, к которой относится pawsThisWeek */
  pawsWeekStart: string;
  pawsThisWeek: number;
  streak: number;
  /** YYYY-MM-DD последней активности */
  lastActivityDate: string | null;
  /** YYYY-MM-DD последней «Лапки дня» */
  lastDailyDate: string | null;
  createdAt: string;
}

export interface IdeaRecord {
  id: string;
  authorTgId: number;
  authorName: string;
  title: string;
  what: string;
  audience: string;
  goal: string;
  needs: string;
  status: IdeaStatus;
  createdAt: string;
}

export interface PawRequest {
  id: string;
  tgId: number;
  userName: string;
  amount: number;
  reason: string;
  status: PawRequestStatus;
  createdAt: string;
}

export interface Database {
  users: UserRecord[];
  ideas: IdeaRecord[];
  pawRequests: PawRequest[];
  seq: number;
}
