import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WEEKLY_PAW_LIMIT, levelForPaws } from "./levels.js";
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR?.trim() || join(here, "..", "data");
const dbPath = join(dataDir, "db.json");
const tz = process.env.TIMEZONE || "Asia/Yekaterinburg";
/** Дата в формате YYYY-MM-DD в часовом поясе проекта */
export function dateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}
/** Начало текущей недели (понедельник) в формате YYYY-MM-DD */
export function weekKey(date = new Date()) {
    const key = dateKey(date);
    const d = new Date(`${key}T00:00:00Z`);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (day - 1));
    return d.toISOString().slice(0, 10);
}
function emptyDb() {
    return { users: [], ideas: [], pawRequests: [], seq: 0 };
}
function load() {
    if (!existsSync(dbPath))
        return emptyDb();
    try {
        const parsed = JSON.parse(readFileSync(dbPath, "utf8"));
        return {
            users: (parsed.users ?? []).map((user) => ({
                ...user,
                nickname: user.nickname ?? user.name,
                blocked: user.blocked ?? false,
            })),
            ideas: parsed.ideas ?? [],
            pawRequests: parsed.pawRequests ?? [],
            seq: parsed.seq ?? 0,
        };
    }
    catch {
        return emptyDb();
    }
}
let db = load();
function persist() {
    if (!existsSync(dataDir))
        mkdirSync(dataDir, { recursive: true });
    const tmp = `${dbPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    renameSync(tmp, dbPath);
}
export function nextId(prefix) {
    db.seq += 1;
    return `${prefix}${db.seq}`;
}
// ---------- пользователи ----------
export function getUser(tgId) {
    return db.users.find((u) => u.tgId === tgId) ?? null;
}
export function upsertUser(record) {
    const index = db.users.findIndex((u) => u.tgId === record.tgId);
    if (index === -1)
        db.users.push(record);
    else
        db.users[index] = record;
    persist();
    return record;
}
export function updateUser(tgId, patch) {
    const user = getUser(tgId);
    if (!user)
        return null;
    Object.assign(user, patch);
    persist();
    return user;
}
export function allUsers() {
    return db.users;
}
/** Полное удаление пользователя и его заявок на лапки. */
export function removeUser(tgId) {
    const before = db.users.length;
    db.users = db.users.filter((user) => user.tgId !== tgId);
    db.pawRequests = db.pawRequests.filter((request) => request.tgId !== tgId);
    persist();
    return db.users.length < before;
}
/** Аккаунт Главной лапки: создатель с полным доступом. */
export function ensureCreator() {
    const creatorId = Number(process.env.CREATOR_ID ?? "8213415725");
    const existing = getUser(creatorId);
    if (!existing) {
        const record = {
            tgId: creatorId,
            username: null,
            name: "Тима",
            nickname: "Тима",
            age: 18,
            role: "creator",
            direction: "Проект",
            parentConsent: false,
            parentConsentFileId: null,
            status: "approved",
            blocked: false,
            paws: 0,
            pawsWeekStart: "",
            pawsThisWeek: 0,
            streak: 0,
            lastActivityDate: null,
            lastDailyDate: null,
            createdAt: new Date().toISOString(),
        };
        db.users.push(record);
        persist();
        return record;
    }
    existing.role = "creator";
    existing.status = "approved";
    existing.blocked = false;
    existing.name = "Тима";
    existing.nickname = "Тима";
    persist();
    return existing;
}
/** Начисление с лимитом 100 лапок в неделю на уровне данных */
export function awardPaws(tgId, amount, _reason) {
    const user = getUser(tgId);
    if (!user)
        return { ok: false, granted: 0, reason: "not_found", total: 0 };
    const currentWeek = weekKey();
    if (user.pawsWeekStart !== currentWeek) {
        user.pawsWeekStart = currentWeek;
        user.pawsThisWeek = 0;
    }
    const remaining = Math.max(0, WEEKLY_PAW_LIMIT - user.pawsThisWeek);
    const granted = Math.min(amount, remaining);
    if (granted <= 0) {
        return {
            ok: false,
            granted: 0,
            reason: "limit",
            total: user.paws,
            levelChangedTo: undefined,
        };
    }
    const beforeLevel = levelForPaws(user.paws).slug;
    user.paws += granted;
    user.pawsThisWeek += granted;
    const afterLevel = levelForPaws(user.paws);
    persist();
    return {
        ok: true,
        granted,
        total: user.paws,
        levelChangedTo: afterLevel.slug !== beforeLevel ? afterLevel.name : undefined,
    };
}
/** Отметка активности для серии без пропусков */
export function touchStreak(tgId) {
    const user = getUser(tgId);
    if (!user)
        return null;
    const today = dateKey();
    if (user.lastActivityDate === today)
        return user.streak;
    const yesterday = new Date(Date.now() - 86_400_000);
    user.streak =
        user.lastActivityDate === dateKey(yesterday) ? user.streak + 1 : 1;
    user.lastActivityDate = today;
    persist();
    return user.streak;
}
/** «Лапка дня» — один раз в сутки */
export function markDailyDone(tgId) {
    const user = getUser(tgId);
    if (!user)
        return false;
    const today = dateKey();
    if (user.lastDailyDate === today)
        return false;
    user.lastDailyDate = today;
    persist();
    return true;
}
// ---------- очередь начислений (антифрод) ----------
export function addPawRequest(tgId, userName, amount, reason) {
    const request = {
        id: nextId("p"),
        tgId,
        userName,
        amount,
        reason,
        status: "pending",
        createdAt: new Date().toISOString(),
    };
    db.pawRequests.push(request);
    persist();
    return request;
}
export function pendingPawRequests() {
    return db.pawRequests.filter((r) => r.status === "pending");
}
export function getPawRequest(id) {
    return db.pawRequests.find((r) => r.id === id) ?? null;
}
export function decidePawRequest(id, decision) {
    const request = db.pawRequests.find((r) => r.id === id);
    if (!request || request.status !== "pending")
        return null;
    request.status = decision;
    persist();
    return request;
}
// ---------- идеи ----------
export function createIdea(input) {
    const idea = {
        ...input,
        id: nextId("i"),
        status: "review",
        createdAt: new Date().toISOString(),
    };
    db.ideas.push(idea);
    persist();
    return idea;
}
export function getIdea(id) {
    return db.ideas.find((i) => i.id === id) ?? null;
}
export function listIdeas() {
    return [...db.ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** Идеи, которые уже прошли модерацию и видны в банке. */
export function listPublishedIdeas() {
    const visible = new Set(["published", "team", "running", "done"]);
    return listIdeas().filter((idea) => visible.has(idea.status));
}
export function setIdeaStatus(id, status) {
    const idea = getIdea(id);
    if (!idea)
        return null;
    idea.status = status;
    persist();
    return idea;
}
// ---------- сводка для админа ----------
export function stats() {
    const users = db.users;
    return {
        total: users.length,
        approved: users.filter((u) => u.status === "approved").length,
        pending: users.filter((u) => u.status === "pending").length,
        ideas: db.ideas.length,
        ideasInWork: db.ideas.filter((i) => i.status === "published" ||
            i.status === "team" ||
            i.status === "running").length,
        pawsPending: pendingPawRequests().length,
        blocked: db.users.filter((user) => user.blocked).length,
    };
}
