# Деплой бота «Лапка Добра»

Бот должен работать там, где доступен `api.telegram.org`. На машине,
где этот адрес заблокирован, он не подключится — это сетевое ограничение,
а не ошибка кода.

## 0. Проверка хоста

На сервере выполни:

```bash
curl -I https://api.telegram.org
```

Нужен любой ответ (200/302/404), а не таймаут.

## 1. Подготовка

Скопируй папку `bot/` на сервер, например в `/opt/lapka-bot`.
Создай `.env` из `.env.example` и заполни:

```env
BOT_TOKEN=токен_из_BotFather
ADMIN_IDS=твой_telegram_id
CONTACT_URL=https://t.me/...
SITE_URL=https://...
DOBRO_URL=https://dobro.ru
TIMEZONE=Asia/Yekaterinburg
```

Права на файл:

```bash
chmod 600 .env
```

## Вариант A. Docker (проще)

```bash
cd /opt/lapka-bot
docker compose up -d --build
docker compose logs -f
```

Остановка / обновление:

```bash
docker compose down
git pull   # если проект в git
docker compose up -d --build
```

## Вариант B. Node + systemd

Нужен Node.js 22+.

```bash
cd /opt/lapka-bot
npm ci
npm run build

sudo useradd -r -s /usr/sbin/nologin lapka || true
sudo chown -R lapka:lapka /opt/lapka-bot

sudo cp deploy/lapka-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lapka-bot
sudo journalctl -u lapka-bot -f
```

## Данные

История заявок, идей и лапок хранится в `data/db.json`.
При Docker-запуске папка смонтирована томом — данные переживают пересоздание
контейнера. Резервная копия:

```bash
cp data/db.json data/db-$(date +%F).json
```

## Проверка после запуска

1. В логе должно быть `🐾 Бот «Лапка Добра» запущен`.
2. Открой бота в Telegram и нажми `/start`.
3. Проверь заявку: она должна прийти всем из `ADMIN_IDS` с кнопками модерации.
4. Если админам ничего не пришло — они ещё не начинали диалог с ботом.

## Обновление

```bash
cd /opt/lapka-bot
git pull
npm ci && npm run build
sudo systemctl restart lapka-bot
```

или `docker compose up -d --build`.
