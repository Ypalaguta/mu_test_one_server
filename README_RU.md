# API версии 3

Полная инструкция — README_RU.md в корне общего архива (на уровень выше server).

После удаления старых characters/skills по согласованному плану:

```sh
npm ci
npm run seed:check
npm run seed:static
npm run seed:dev
npm run build
npm run dev
```

В .env требуются MONGODB_URI и GAME_SERVER_TOKEN; прочие настройки см. .env.example.
Каталоги: GET /api/skills, GET /api/items. Серверный снимок: GET/PUT /api/characters/:id/state с X-Game-Server-Token.
Новые ранги/условия/стоимость описаны в src/modules/skills/model.ts; данные — data/skills.json.
Проверки: npm test. Tests используют тестовый репозиторий, без MongoDB.
