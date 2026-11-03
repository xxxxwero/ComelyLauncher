# Сервер поддержки ComelyLauncher

Cloudflare Worker с базой D1. Принимает обращения игроков, показывает их разработчику и хранит переписку.

## Вход и права

- Microsoft подтверждается сертификатом игрока Mojang: лаунчер подписывает проверочную строку его ключом, а Worker проверяет подпись Mojang и подпись игрока. Обращаться к Mojang Worker не может, все адреса Mojang отвечают серверам Cloudflare ошибкой 403, поэтому открытые ключи лежат в `src/mojang-keys.ts`. Если Mojang сменит ключи (`api.minecraftservices.com/publickeys`), их нужно обновить и развернуть сервер заново. Сертификат подтверждает только UUID, поэтому права выдаются по UUID, а ник в обращении может быть указан произвольно.
- Ely.by подтверждается через `join` / `hasJoined`. Токены входа на Worker не попадают.
- Админом считается только аккаунт Microsoft с UUID из `ADMIN_UUID` в `wrangler.toml`.
- Оффлайн-игрок получает идентификатор по случайному секрету устройства и пометку «Не подтверждён». Лимит: 3 обращения в сутки, 8 в сутки с одного адреса.
- Сессия живёт 7 дней и подписана секретом `SESSION_SECRET`.

## Развёртывание

В PowerShell вызывай `npx.cmd`: `npx` там может быть заблокирован политикой выполнения скриптов.

```bash
npx.cmd wrangler login
npx.cmd wrangler d1 create comely-support
```

Полученный `database_id` запиши в `wrangler.toml`, затем:

```bash
npx.cmd wrangler d1 execute comely-support --remote --file=schema.sql
npx.cmd wrangler secret put SESSION_SECRET
npx.cmd wrangler deploy
```

Адрес сервера запиши в `DEPLOYED_SERVER_URL` в `src/main/support/support-config.ts` и собери лаунчер через `npm run dist`.

Логи из обращений удаляются через 90 дней, это делает ежедневная задача по расписанию.
