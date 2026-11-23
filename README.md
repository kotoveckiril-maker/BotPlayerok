# 🤖 BotPlayerok v2

Полноценная панель автоматизации продаж на **[Playerok](https://playerok.com)**: авто-выдача товара, авто-подтверждение сделок, авто-поднятие и восстановление лотов, ИИ-автоответчик, Telegram-уведомления и **живая статистика продаж**.

Проект самостоятельный: работает на вашем компьютере, VPS или в Docker. **Никакой зависимости от Arena AI или иных облачных платформ нет** — все данные, токены и база остаются у вас.

---

## ✨ Возможности

### 🚀 Автоматизация
- **Авто-выдача** — после оплаты отправляет покупателю ключ/аккаунт со склада или готовое сообщение.
- **Поштучный склад** — каждая единица товара выдаётся ровно один раз, атомарный захват с защитой от двойной продажи.
- **Авто-подтверждение** — помечает сделку выполненной после выдачи.
- **Авто-поднятие** — поднимает активные лоты по расписанию, с лимитом стоимости.
- **Авто-восстановление** — повторно выставляет проданные/истёкшие лоты, если есть остаток.
- **ИИ-автоответчик** — отвечает покупателям в чатах через любой OpenAI-совместимый API, с каталогом товаров и передачей диалога продавцу.

### 📈 Статистика и контроль
- Выручка, продажи, средний чек за 7 / 30 / 90 дней с сравнением периодов.
- Графики выручки и продаж по дням, топ товаров и покупателей.
- Воронка выдач, успешность, среднее время выдачи, ошибки и предупреждения.
- Использование ИИ: ответы, передачи продавцу, токены.
- **Живые метрики движка**: аптайм, длительность циклов, память, баланс и непрочитанные чаты.
- Экспорт статистики в CSV.

### 🔒 Безопасность и эксплуатация
- Вход в панель по паролю (scrypt), сессии на HMAC-подписи.
- Секреты (токен Playerok, ключи ИИ, токен Telegram) **шифруются AES-256-GCM** и не попадают в бэкап.
- CSRF-проверка Origin для изменяющих запросов, rate-limit входа, security-заголовки.
- Автоматические миграции базы при старте.
- Docker, docker-compose, health-check, Caddyfile для HTTPS.
- JSON-бэкап/восстановление товаров и склада прямо из интерфейса.
- Telegram-уведомления: продажи, ошибки, пустой склад.

---

## 🧱 Стек

| Слой | Технологии |
|---|---|
| UI | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Сервер | Node.js 22, Route Handlers |
| БД | PostgreSQL 14+ (Drizzle ORM) |
| Внешние API | Playerok GraphQL, OpenAI-совместимый API, Telegram Bot API |
| Деплой | Docker / docker-compose / VPS / обычный Node.js |

---

## 🚀 Быстрый старт (Docker, 5 минут)

> Нужны установленные `git` и Docker (Docker Desktop на Windows/macOS).

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/kotoveckiril-maker/BotPlayerok.git
cd BotPlayerok

# 2. Конфигурация
cp .env.example .env
nano .env        # или notepad .env — задайте ADMIN_PASSWORD

# 3. Запуск
docker compose up -d --build

# 4. Откройте панель
# http://localhost:3000
```

Пароль админки:
- если вы задали `ADMIN_PASSWORD` в `.env` — используйте его;
- если нет — сгенерированный пароль появится в логах:

```bash
docker compose logs app | grep -A4 "Пароль админки"
```

Дальше: **Настройки → Аккаунт Playerok** → вставьте токен → «Сохранить» → **Обзор → ▶ Запустить**.

### Обновление

```bash
git pull
docker compose up -d --build
```

Миграции применятся автоматически при старте.

> Образ собирается в режиме standalone (`STANDALONE=1` задан в Dockerfile), поэтому
> внутри контейнера запускается `node server.js`. Для запуска без Docker используйте
> `npm start` — он работает с обычной сборкой.

---

## 💻 Запуск без Docker (Windows / Linux / macOS)

Требуется **Node.js 22+** и **PostgreSQL 14+**.

### 1. Установите зависимости

```bash
npm install
cp .env.example .env
```

### 2. Создайте базу

```sql
CREATE DATABASE botplayerok;
CREATE USER botplayerok WITH PASSWORD 'сильный_пароль';
GRANT ALL PRIVILEGES ON DATABASE botplayerok TO botplayerok;
```

В `.env`:

```env
DATABASE_URL=postgresql://botplayerok:сильный_пароль@127.0.0.1:5432/botplayerok
ADMIN_PASSWORD=ваш_пароль_админки
```

### 3. Миграции и запуск

```bash
npm run db:migrate     # применить схему (также делается автоматически при старте)
npm run build
npm start
```

Для разработки:

```bash
npm run dev            # http://localhost:3000
```

### systemd (VPS, без Docker)

Создайте `/etc/systemd/system/botplayerok.service`:

```ini
[Unit]
Description=BotPlayerok
After=network.target postgresql.service

[Service]
Type=simple
User=botplayerok
WorkingDirectory=/opt/BotPlayerok
EnvironmentFile=/opt/BotPlayerok/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now botplayerok
```

### HTTPS с Caddy

```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile      # укажите свой домен
sudo systemctl reload caddy
```

Caddy автоматически выпустит сертификат Let's Encrypt.

---

## 🔑 Как получить токен Playerok

1. Откройте **https://playerok.com** и войдите в аккаунт.
2. Нажмите **F12** → вкладка **Application** (Хранилище) → **Cookies** → `https://playerok.com`.
3. Найдите cookie **`token`**, скопируйте её значение.
4. Вставьте в **Настройки → Аккаунт Playerok → Токен**.

### Если Playerok отвечает антибот-защитой

Playerok использует DDoS-Guard (`__ddg5_` cookie). Она привязана к **IP и User-Agent** браузера. Поэтому:

1. Откройте **F12 → Network**, обновите страницу.
2. Кликните любой запрос к `https://playerok.com/graphql`.
3. Во вкладке **Headers** скопируйте весь заголовок **`Cookie`** (включая `token=...; __ddg5_=...`).
4. Вставьте его в поле **«Полная строка Cookie»**.
5. Скопируйте заголовок **`User-Agent`** в соответствующее поле.
6. Запускайте бота **с того же IP**, с которого брали cookie (или используйте тот же прокси, что и браузер).

> Cookie со временем протухают. Если появилась ошибка `botcheck` — просто повторите шаги и обновите cookie в настройках.

---

## 🧠 Настройка ИИ-автоответчика

Работает с любым **OpenAI-совместимым** API. Примеры:

| Провайдер | Base URL | Модель |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` |
| Ollama (локально) | `http://127.0.0.1:11434/v1` | `qwen2.5:7b` |

В **Настройки → ИИ-автоответчик** укажите Base URL, модель и ключ, затем нажмите **«Проверить ИИ»**.

Каталог товаров (название + описание) автоматически добавляется в системный промпт. Если ИИ не уверен — он отвечает `[HANDOFF]`, и бот не отправляет сообщение покупателю (событие попадает в логи).

---

## 💬 Telegram-уведомления

1. Создайте бота у **@BotFather**: `/newbot` → получите токен вида `123456:ABC-DEF...`.
2. Узнайте свой `chat_id`:
   - напишите боту **@userinfobot** — он пришлёт numeric ID;
   - или для канала/группы добавьте бота администратором и используйте ID вида `-100...`.
3. В **Настройки → Telegram** вставьте токен и chat_id → **«Отправить тестовое сообщение»**.

Уведомления: продажа, пустой склад, ошибка выдачи, остановка бота из-за авторизации.

---

## ⚙️ Переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `DATABASE_URL` | ✅ | Строка подключения PostgreSQL |
| `ADMIN_PASSWORD` | recommended | Пароль админки. Если нет — генерируется при первом запуске |
| `SETTINGS_SECRET` | recommended | Ключ шифрования секретов и подписи сессий. Если нет — создаётся `.data/secret.key` |
| `OPENAI_API_KEY` | — | Ключ ИИ (можно задать в админке) |
| `TZ` | — | Часовой пояс, по умолчанию `Europe/Moscow` |
| `COOKIE_SECURE` | — | `1` — добавлять `Secure` в cookie (только для HTTPS) |
| `DATA_DIR` | — | Папка для `secret.key`, по умолчанию `.data` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | Для docker-compose |
| `APP_PORT` | — | Порт хоста в docker-compose, по умолчанию `3000` |

> ⚠️ **Сохраните `SETTINGS_SECRET` или файл `.data/secret.key`.** Без него зашифрованные токены невозможно восстановить — придётся ввести их заново.

---

## 🗄 Резервные копии

### Через интерфейс
**Настройки → Данные** → **«Скачать бэкап JSON»**. Файл содержит товары, склад, выдачи и сделки, но **без секретов**.

Восстановление товаров и склада: **«Восстановить товары и склад»** → выберите файл.

### Полный бэкап PostgreSQL (Docker)

```bash
docker compose exec db pg_dump -U botplayerok botplayerok > backup.sql
```

Восстановление:

```bash
cat backup.sql | docker compose exec -T db psql -U botplayerok botplayerok
```

### Файл ключа шифрования

Скопируйте `secret.key` из volume `appdata` или задайте `SETTINGS_SECRET` в `.env` и храните его в менеджере паролей.

---

## 🧪 Разработка и тесты

```bash
npm run dev          # режим разработки
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run test:smoke   # smoke-тест логики выдачи и криптографии
```

Smoke-тесту нужна PostgreSQL-совместимая БД. Проще всего запустить встроенную PGlite:

```bash
node scripts/dev-db.mjs          # поднимет PostgreSQL на 127.0.0.1:5432
npm run test:smoke               # в другом терминале
```

Тест проверяет: выдачу со склада, защиту от повторной выдачи, авто-подтверждение,
сценарий «нет на складе», сопоставление по ключевому слову, шифрование секретов,
хэширование пароля, миграцию секретов старого формата и агрегаты статистики.

### Демо-данные

Хотите посмотреть, как выглядит панель с продажами? Скрипт **удаляет** текущие
товары, склад, сделки и выдачи и заполняет базу демо-данными:

```bash
CONFIRM_DEMO=1 npm run seed:demo
```

---

## 🩺 Диагностика

| Симптом | Решение |
|---|---|
| `DATABASE_URL is required` | Задайте `DATABASE_URL` в `.env` или используйте docker-compose |
| Панель не открывается | `docker compose logs app`; проверьте порт `APP_PORT` |
| `Не удалось расшифровать секреты` | Верните тот же `SETTINGS_SECRET` / `.data/secret.key` |
| `botcheck` / антибот | Обновите Cookie и User-Agent, запускайте с того же IP |
| `UNAUTHENTICATED` / токен недействителен | Токен протух — получите новый cookie `token` |
| Пустая статистика | Включите «Синхронизировать сделки», нажмите «Выполнить цикл» |
| ИИ не отвечает | Проверьте ключ, Base URL и модель; нажмите «Проверить ИИ» |
| Telegram не приходит | Проверьте токен/chat_id, нажмите «Отправить тестовое сообщение» |
| Много `429` | Увеличьте интервал опроса в настройках |

Health-check: `GET /api/health` → `{"ok":true,"db":"ok"}`.

---

## 📁 Структура проекта

```
src/
├─ app/
│  ├─ (protected)/          # панель (требует входа)
│  │  ├─ page.tsx
│  │  └─ layout.tsx         # проверка сессии
│  ├─ login/                # страница входа
│  └─ api/
│     ├─ auth/              # login / logout / password
│     ├─ bot/               # статус, запуск, цикл, тесты
│     ├─ stats/             # агрегированная статистика
│     ├─ deals/             # сделки Playerok
│     ├─ products/          # товары и склад
│     ├─ deliveries/        # история выдач
│     ├─ logs/              # журнал
│     ├─ settings/          # настройки
│     ├─ backup/            # экспорт/восстановление
│     └─ health/            # health-check
├─ components/              # UI (Dashboard, Overview, Stats, Deals, charts…)
├─ db/
│  ├─ schema.ts             # схема Drizzle
│  ├─ index.ts              # подключение PostgreSQL
│  └─ migrate.ts            # авто-миграции
├─ lib/
│  ├─ auth.ts               # сессии, пароли, защита API
│  ├─ crypto.ts             # AES-256-GCM, scrypt, HMAC
│  ├─ bot/
│  │  ├─ engine.ts          # цикл, метрики, backoff
│  │  ├─ delivery.ts        # авто-выдача и подтверждение
│  │  ├─ items.ts           # поднятие/восстановление лотов
│  │  ├─ ai.ts              # ИИ-автоответчик
│  │  ├─ deals.ts           # синхронизация сделок
│  │  ├─ stats.ts           # агрегаты статистики
│  │  ├─ notify.ts          # Telegram
│  │  ├─ log.ts             # журнал
│  │  └─ settings.ts        # настройки + шифрование секретов
│  └─ playerok/client.ts    # GraphQL-клиент Playerok
├─ drizzle/                 # SQL-миграции
├─ scripts/
│  ├─ dev-db.mjs            # локальная PGlite для разработки/тестов
│  └─ smoke-test.ts         # smoke-тест логики
├─ Dockerfile
├─ docker-compose.yml
└─ .env.example
```

---

## 🔌 API-эндпоинты

Все запросы (кроме `/api/health` и `/api/auth/login`) требуют сессию.

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/health` | Статус БД и приложения |
| `POST` | `/api/auth/login` | Вход: `{ "password": "..." }` |
| `POST` | `/api/auth/logout` | Выход |
| `POST` | `/api/auth/password` | Смена пароля: `{ "current": "...", "next": "..." }` |
| `GET` | `/api/bot` | Состояние движка, модулей, системы |
| `POST` | `/api/bot` | `start` / `stop` / `tick` / `test` / `test-ai` / `test-telegram` |
| `GET` | `/api/stats?range=7` | Статистика за 7/30/90 дней |
| `GET/DELETE` | `/api/deals?limit=&status=&q=` | Сделки (зеркало Playerok) |
| `GET/PUT` | `/api/settings` | Настройки (секреты маскируются) |
| `GET/POST` | `/api/products` | Товары |
| `GET/POST/DELETE` | `/api/products/:id/stock` | Склад |
| `GET` | `/api/deliveries` | История выдач |
| `GET` | `/api/logs?level=&module=` | Журнал |
| `GET/POST` | `/api/backup` | Бэкап / восстановление |

---

## ❓ FAQ

**Нужен ли сервер?**
Нет. Можно запускать на домашнем ПК, пока он включён. Для 24/7 лучше VPS от 1–2 GB RAM или Docker на всегда включённой машине.

**Можно ли использовать бесплатный PostgreSQL?**
Да: Neon, Supabase, Aiven и т.п. дают внешний `DATABASE_URL`. Укажите его в `.env`.

**Бот сам оплачивает поднятие?**
Только если вы включили «Авто-поднятие» и задали `Макс. цена поднятия` больше 0. При 0 используются только бесплатные статусы.

**Можно ли подключить несколько аккаунтов Playerok?**
В текущей версии — один аккаунт на инстанс. Запустите отдельный контейнер с другой БД для второго аккаунта.

**Насколько это безопасно для аккаунта?**
Автоматизация нарушает правила большинства маркетплейсов и может привести к блокировке. Используйте разумные интервалы, не спамьте и не нарушайте правила Playerok. Проект предоставляется «как есть».

**Почему статистика пустая?**
Включите синхронизацию сделок и выполните цикл. Если продажи старше 90 дней — они всё равно попадут в totals, но не в график периода.

---

## 🙏 Источники и благодарности

- GraphQL-операции и persisted-query хэши Playerok изучены по открытому проекту [alleexxeeyy/playerok-universal](https://github.com/alleexxeeyy/playerok-universal) (MIT).
- [Next.js](https://nextjs.org), [Drizzle ORM](https://orm.drizzle.team), [Tailwind CSS](https://tailwindcss.com).

---

## ⚠️ Дисклеймер

Проект не связан с Playerok. Использование автоматизации — на ваш страх и риск. Токен аккаунта даёт полный доступ к профилю: не передавайте его третьим лицам и храните в зашифрованном виде. Авторы не несут ответственности за блокировку аккаунта, потерю средств или данные.

---

**Сделано для продавцов Playerok. Удачных продаж! 🚀**
