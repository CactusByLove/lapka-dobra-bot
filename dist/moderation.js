/**
 * Простые правила автопроверки: нецензурная лексика, реклама,
 * ссылки, телефоны, крик капсом и перебор эмодзи.
 */
const PROFANITY = [
    /(^|[^а-яё])х[уy]й/,
    /(^|[^а-яё])х[уy][её]в/,
    /п[ие]зд/,
    /бл[яа]т/,
    /(^|[^а-яё])[её]б[ао]/,
    /(^|[^а-яё])[её]б[а-я]*н/,
    /(^|[^а-яё])муд[ао]/,
    /(^|[^а-яё])срак/,
    /(^|[^а-яё])говн/,
    /(^|[^а-яё])дерьм/,
    /(^|[^а-яё])дроч/,
    /(^|[^а-яё])шлюх/,
    /(^|[^а-яё])бляд/,
    /\b(fuck|shit|bitch|asshole)\b/i,
];
const SPAM = [
    {
        re: /https?:\/\/|www\.|t\.me\/|vk\.(com|ru)\//i,
        reason: "уберите ссылки — для контактов есть раздел «Связаться»",
    },
    {
        re: /(\+?\d[\d\s()-]{7,}\d)/,
        reason: "уберите номер телефона и личные контакты",
    },
    {
        re: /промокод|казино|ставк|займ|кредит|крипт|инвест|заработ|подпишись|подписывайтесь|рассылк|куп(и|лю)|продам|скидк|дешев/i,
        reason: "реклама, продажи или финансовые предложения",
    },
    {
        re: /(.)\1{6,}/,
        reason: "слишком много повторяющихся символов",
    },
];
function normalize(text) {
    return text
        .toLowerCase()
        .replaceAll("ё", "е")
        .replaceAll("@", "а")
        .replaceAll("0", "о")
        .replaceAll("1", "и")
        .replaceAll("3", "е")
        .replaceAll("$", "с");
}
export function moderateText(fields) {
    const text = fields.join("\n").trim();
    const normalized = normalize(text);
    const reasons = [];
    if (text.length > 3000)
        reasons.push("слишком длинный текст");
    if (PROFANITY.some((re) => re.test(normalized))) {
        reasons.push("в тексте есть нецензурная лексика");
    }
    for (const rule of SPAM) {
        if (rule.re.test(text))
            reasons.push(rule.reason);
    }
    const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
    const upper = text.replace(/[^A-ZА-ЯЁ]/g, "").length;
    if (letters.length > 30 && upper / letters.length > 0.7) {
        reasons.push("слишком много заглавных букв");
    }
    const emojis = [...text].filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).length;
    if (emojis > 12)
        reasons.push("слишком много эмодзи");
    return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}
export function moderationLine(result) {
    return result.ok
        ? "Автопроверка: ✅ чисто"
        : `Автопроверка: ⚠️ ${result.reasons.join("; ")}`;
}
