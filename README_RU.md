# Сервер данных mu_test_one — TypeScript MVP

Только серверная часть. Существующие C++-файлы из HTTP-комплекта менять не нужно:
пять прежних маршрутов и форматы JSON сохранены. Статы персонажа теперь берутся
из класса через info.classId; окончательные значения по уровню считает Unreal.

## Запуск

Node.js 24+, локальная MongoDB или приложенный Docker Compose.
Распакуй этот комплект в новую папку server вместо прежнего JavaScript-сервера.
Не копируй старые src/*.js в новый src. Свой .env можно перенести.

В PowerShell из папки сервера:

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm run seed:check
```

Если MongoDB уже работает, Docker не нужен. Иначе при установленном Docker Desktop:

```powershell
docker compose up -d mongo
```

Далее:

```powershell
npm run seed:static
npm run seed:dev
npm start
```

Для разработки вместо npm start: npm run dev.
Сборка помещает JavaScript в dist; исходный код пишем в src/*.ts.
TypeScript 7.0.2 (зафиксирован в package-lock.json).
Конфигурация TypeScript: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes,
NodeNext/ESM. Типы Mongoose встроены, пакет @types/mongoose не нужен.

.env: HOST=127.0.0.1, PORT=3000, MONGODB_URI=mongodb://127.0.0.1:27017/mu_test_one.
Сервер по умолчанию доступен локально. Авторизация и бой в этот MVP не входят.

## Шесть файлов данных

| Файл в data/ | Коллекция | Начальные записи |
| --- | --- | --- |
| items.json | items | Меч 1, посох 2, броня 3 |
| classes.json | classes | Warrior 1, Mage 2 |
| monsters.json | monsters | Wolf 101, Shaman 102 |
| spawns.json | monsterSpawns | Локация forest, смешанный кемп |
| skills.json | skills | Slash 1, Fireball 2 |
| characters.json | characters | Admin 1, Warrior, уровень 1 |

Это обычные JSON-массивы. Редактируй их в IDE; файл с каждым видом данных отдельный.
Все baseStats/growthStats и stats предметов содержат все 70 полей. Значения — примеры
для прототипа. Приросты классов намеренно небольшие; поменяй их под баланс игры.

ID сущности — положительное число int32. В spawns.enemyId передаётся строка "101",
совместимая с FName существующего интерфейса Configure. ID независимы между коллекциями.
Администратор здесь — только название тестового персонажа Admin, без специальных прав.
Координаты кемпа условные, поправь их под свою карту; Z соответствует центру капсулы.

items: статичное определение без экземпляров и крафта. requirements.level — минимальный
уровень; requirements.classIds=[] разрешает любые классы. stats — прибавки от предмета,
которые позже можно передать в addModifier. Инвентарь и применение экипировки ещё не написаны.
skills: стоимость ресурса, тип цели, cooldown в секундах, range в сантиметрах.
Исполнение умения, эффекты, анимации и формулы урона пока остаются будущей задачей.
classes.skillIds — список предусмотренных для класса умений, а не сохранённый прогресс изучения.
monsters.skillIds — определения доступных умений; текущий C++ сам их ещё не загружает.

## Поведение seed

- seed:check — проверяет все JSON, схемы, дубли и ссылки между файлами, без MongoDB.
- seed:static — обновляет/создаёт skills, classes, items, monsters по id и спавны по locationId.
  Содержимое массивов/вложенных объектов заменяется значениями из файлов.
- seed:dev — добавляет отсутствующих персонажей через $setOnInsert. Существующие записи
  не меняет: имя, уровень, золото и остальные поля сохраняются.
- Ни одна команда не удаляет записи, отсутствующие в файлах.
- Проверка всего набора выполняется до записи данных. Неизвестные classId, skillIds,
  enemyId и дубли прекращают операцию. Для seed:dev класс также должен существовать в БД:
  сначала seed:static, потом seed:dev.
- Порядок записи зависимостей: skills → classes → items → monsters → monsterSpawns.
- Повторный запуск безопасен относительно дублей и прогресса персонажа. При обрыве связи
  возможна частичная запись нескольких коллекций: операции не объединены в транзакцию
  ради поддержки локальной standalone MongoDB. Исправь соединение и повтори команду.
- Прямые изменения статических записей через Compass будут перезаписаны seed:static
  для совпадающих ID. Источник статических определений — файлы data/.

## Если уже запускал предыдущий JavaScript seed

Он мог создать персонажа id=1 с classId=0. Новый seed:dev специально его не заменяет.
После seed:static открой characters в MongoDB Compass и установи этому персонажу
info.classId=1 (Warrior) либо 2 (Mage). Существующее имя тоже останется прежним;
переименуй в Admin вручную, если нужно.

Эквивалент для mongosh, только для прежнего classId=0:

```javascript
use mu_test_one
db.characters.updateOne({ id: 1, "info.classId": 0 }, { $set: { "info.classId": 1 } })
```

Старые baseStats/growthStats в documents characters не удаляются, но API их игнорирует.
При неизвестном классе /characters/:id/stats отвечает 409 CLASS_NOT_FOUND вместо
возврата неявных нулевых статов. Уровень персонажа остаётся в info.level.

## API

| GET | Ответ |
| --- | --- |
| /api/characters/:id/info | id + прежние поля info |
| /api/characters/:id/stats | { baseStats, growthStats } из класса персонажа |
| /api/characters/:id/action-bar | { slots: [...] } с раскладкой action bar |
| /api/monsters/:id/info | id + прежние поля info |
| /api/monsters/:id/stats | { baseStats, growthStats } монстра |
| /api/locations/:locationId/monster-spawns | { camps: [...] } |
| /api/items/:id | Определение предмета |
| /api/classes/:id | Определение класса, статы и skillIds |
| /api/skills/:id | Определение умения |
| /health | { ready: true/false } |

| PUT | Тело и ответ |
| --- | --- |
| /api/characters/:id/action-bar | `{ "slots": [{ "slotNum": 0, "id": 1, "type": "Skill" }] }` |

Action bar хранится внутри документа персонажа. Допустимы 36 позиций с номерами 0–35,
типы `Action`, `Skill`, `Item`; `None` не передаётся. PUT полностью заменяет раскладку.
Пустой массив очищает её. У старых персонажей без поля API вернёт `{ "slots": [] }`.

Примеры:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/characters/1/info
Invoke-RestMethod http://127.0.0.1:3000/api/characters/1/stats
Invoke-RestMethod http://127.0.0.1:3000/api/items/1
$body = @{ slots = @(@{ slotNum = 0; id = 1; type = 'Skill' }) } | ConvertTo-Json -Depth 3
Invoke-RestMethod -Method Put -ContentType 'application/json' -Body $body http://127.0.0.1:3000/api/characters/1/action-bar
```

Изменения классов отражаются на следующей загрузке статов персонажа. Шаблоны монстров
в существующем Unreal-клиенте кешируются до конца GameInstance: перезапусти PIE для
получения изменений. Новые endpoints предметов/умений пока не подключены к UI Unreal.

## Структура

- src/server.ts — запуск/остановка сервера.
- src/app.ts — Express-приложение и общая обработка ошибок.
- src/http/routes.ts — маршруты.
- src/http/controller.ts — HTTP-адаптеры и явные формы ответов.
- src/modules/<module>/model.ts — отдельные модели шести модулей.
- src/modules/characters/service.ts — получение статов из класса.
- src/modules/action-bar/ — схема и проверка сохраняемой раскладки.
- src/shared/contracts.ts — контракт репозитория и типы ответов.
- src/shared/database.ts — MongoDB-адаптер этого контракта.
- src/shared/schemas.ts, statFields.ts — переиспользуемые схемы и 70 статов.
- src/seed/ — чтение/проверка файлов и операции обновления базы.

Контроллеры не обращаются к Mongoose напрямую. Их зависимость — интерфейс Repository.
Специальный игровой сервис выделен там, где есть логика (статы персонажа из класса).
Простые чтения не обёрнуты дополнительными пустыми сервисами.

## Проверки

```powershell
npm run typecheck
npm run build
npm run seed:check
npm test
```

Сборка TypeScript и 9 тестов прошли в среде подготовки. Проверены старые HTTP-контракты,
новые endpoints, происхождение статов, ошибки, все данные, ссылки и повторное применение
seed-операций к тестовому хранилищу. Это не интеграционный тест реальной MongoDB:
запись в настоящую базу нужно проверить локально. C++ в этом комплекте не изменяется.

Справка: https://mongoosejs.com/docs/typescript.html
