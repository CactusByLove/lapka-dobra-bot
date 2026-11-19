export function adminIds() {
    return (process.env.ADMIN_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0);
}
export function isAdmin(tgId) {
    return adminIds().includes(tgId);
}
/** Рассылка уведомления всем админам. Ошибки не валят обработчик. */
export async function notifyAdmins(api, text, keyboard) {
    for (const adminId of adminIds()) {
        try {
            await api.sendMessage(adminId, text, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                link_preview_options: { is_disabled: true },
            });
        }
        catch {
            // Админ мог не начинать диалог с ботом — это не повод падать.
        }
    }
}
