const sessions = new Map();
export const sessionsStore = {
    get(tgId) {
        return sessions.get(tgId) ?? null;
    },
    set(tgId, session) {
        sessions.set(tgId, session);
    },
    clear(tgId) {
        sessions.delete(tgId);
    },
};
