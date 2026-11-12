# Архитектура Simple Training

Источник истины по продукту — [`CONCEPT.md`](CONCEPT.md). Здесь — как устроен код.

## Принципы

- **Всё на устройстве.** IndexedDB (`idb`), никаких серверов, аккаунтов и сторонних запросов.
  Тест `tests/e2e/network.spec.ts` падает при любом запросе к чужому домену и при любой ссылке,
  кроме внутренних (`#/…`) и `mailto:fovae.work@gmail.com`.
- **Ни одной строки интерфейса в коде.** Всё через словари `src/i18n/locales/<язык>/*.json`.
- **Вес в килограммах, рост в сантиметрах.** Перевод в фунты и дюймы — только при показе
  (`src/lib/format.ts`).
- **Preact + Signals.** Состояние — сигналы в `src/state/`, компоненты подписываются автоматически.

## Структура

```
docs/                     CONCEPT.md (продукт), ARCHITECTURE.md (этот файл)
src/
  types/index.ts          схема данных: Profile, Plan, Day, PlanItem, Session, Settings, Exercise
  data/
    exercises.ts          библиотека упражнений (метаданные; тексты — в словарях)
    templates.ts          шаблоны планов: Всё тело, Поддержание формы, Рост силы, Сплит 3+1
  pics/                   SVG-схемы движений: engine.ts (генератор), defs.ts (позы)
  i18n/
    index.ts              t(), tList(), Intl для чисел и дат, PluralRules, загрузка языка
    locales/en/*.json     английский — источник истины
    locales/ru/*.json     русский
  db/
    index.ts              IndexedDB: версии схемы, upgrade(), запросы
    migrations.ts         чистые функции миграции v1 → v2 (и для импорта старых файлов)
  advice/index.ts         интерфейс Advice — точка расширения для правил этапа 2
  state/
    app.ts                запуск: язык, данные, нужен ли онбординг
    settings.ts           настройки и профиль
    plan.ts               план и операции редактора
    session.ts            текущая тренировка, история, статистика
    ui.ts                 маршруты (#/…), тема, тосты, диалоги
  lib/platform.ts         платформа, браузер, версия Safari, standalone — чистые функции (юнит-тесты на UA)
  lib/focus.ts            ловушка фокуса для модальных окон (Safari по Tab пропускает кнопки)
  features/install.ts     экран установки: когда показывать, «Продолжить в браузере» (7 дней), «Я установил»
  features/               таймер (метки времени), звук, wake lock, обновления, экспорт/импорт
  ui/
    App.tsx               каркас и маршрутизация экранов
    labels.ts             общие переведённые подписи (название дня, схема подходов…)
    components/           карточка упражнения, переключатель дней, формы, лист выбора…
    components/InstallScene.tsx  SVG-сцены установки (свои рисунки, без текста внутри)
    screens/              InstallGate, Onboarding, Today, Plan, Library, History, Settings, Legal
  styles/                 tokens (цвета), base, components, screens, features (этап 1), layout
scripts/
  i18n-check.mjs          проверка словарей (npm run i18n:check)
  generate-assets.mjs     иконки и splash-экраны
tests/e2e/                Playwright: iPhone (WebKit), Pixel (Chromium), офлайн и обновление, ПК, axe,
                          миграция, сеть, экран установки, скриншоты 375/390/430, русская версия
tests/e2e/*.unit.spec.ts  юнит-тесты без браузера (проект `unit`)
```

## Данные и миграции

База `training-pwa`, текущая версия — **2**.

| Версия | Хранилища                                                              |
| ------ | ---------------------------------------------------------------------- |
| v1     | `workouts`, `kv.activeWorkout`; настройки в `localStorage['tp-settings']` |
| v2     | `sessions`, `kv.profile`, `kv.plan`, `kv.settings`, `kv.activeSession`  |

Миграция v1 → v2 выполняется в `upgrade()` (`src/db/index.ts`) за одну транзакцию:

- тренировки → `sessions` (даты в ISO, вес в `weightKg`, секунды планки из `reps` в `seconds`);
- незавершённая тренировка → `activeSession`;
- план → шаблон «Сплит 3+1» с id дней `day-1…day-4` (совпадают со старыми, история не отрывается);
- настройки из `localStorage` → `kv.settings`; единицы и язык → `kv.legacyPrefs` (подсказка онбордингу);
- хранилище `workouts` **не удаляется** — это страховочная копия.

Профиль после миграции заполняет сам пользователь в онбординге (вес и рост обязательны).
Пункт «Оставить мой текущий план» в онбординге показывается **только** если миграция нашла данные v1
(`kv.legacyPrefs`); у нового пользователя его нет.

> **Временный код.** Когда владелец перенёс свои данные (открыл новую версию в установленном приложении
> и прошёл онбординг), шаг `oldVersion < 2` в `upgrade()`, функции v1 в `migrations.ts`, `kv.legacyPrefs`,
> пункт «Оставить мой текущий план» и импорт файлов schema 1 можно удалить. Номер версии базы при этом
> не уменьшать.
Тест: `tests/e2e/migration.spec.ts` создаёт базу v1 на фикстуре и проверяет перенос.

**Новая версия схемы:** увеличь `DB_VERSION`, добавь блок `if (oldVersion < N)` в `upgrade()` и
чистую функцию в `migrations.ts`, добавь тест с фикстурой предыдущей версии. Старые шаги не удаляй.

## Как добавить упражнение

1. Если нужна новая схема — добавь позы в `src/pics/defs.ts` (координаты суставов, см. `engine.ts`).
2. Добавь запись в `EXERCISES` (`src/data/exercises.ts`):

   ```ts
   make({
     id: 'goblet-squat',            // стабильный id: никогда не меняй и не переиспользуй
     pic: 'goblet_squat',
     category: 'legs',
     primary: ['quads', 'glutes'],
     secondary: ['deep-core'],
     equipment: ['kettlebell', 'dumbbell'],
     type: 'compound',              // compound → «базовый» отдых, isolation → «изоляция»
     metric: 'weight_reps',         // или 'reps', 'time'
     per: 'side',                   // необязательно: «на руку» / «на сторону»
     cues: 3, mistakes: 2,          // сколько строк техники и ошибок в словаре
     defaults: d(3, 8, 12),         // подходы и повторы при добавлении в план
   }),
   ```

3. Добавь тексты во **все** языки, в `locales/<язык>/exercises.json`:

   ```json
   "goblet-squat": {
     "name": "…", "desc": "…",
     "cues": ["…", "…", "…"],
     "mistakes": ["…", "…"],
     "safety": "…"
   }
   ```

4. `npm run i18n:check` — проверит, что у упражнения есть все тексты во всех языках.

Тексты пишем сами, своими словами; ярлыков «дом» и «зал» нет — нужное оборудование видно в карточке.

## Как добавить язык

1. Скопируй `src/i18n/locales/en/` в `src/i18n/locales/<код>/` и переведи значения (ключи не трогай).
   Множественное число — объектом форм `{ "one": …, "few": …, "many": …, "other": … }`:
   нужные формы для языка подскажет `npm run i18n:check` (берёт их из `Intl.PluralRules`).
2. Добавь строку в `LOCALES` (`src/i18n/index.ts`): `{ code, native, intl }`.
   Для `i18n:check` добавь Intl-локаль в `intlOf` (`scripts/i18n-check.mjs`), если код не совпадает.
3. Шрифт: латиница и кириллица — Manrope (в сборке есть latin-ext и кириллица, включая украинские
   буквы). Китайский, японский, корейский — системные шрифты из `--font` в `styles/tokens.css`.
4. `npm run i18n:check && npm run test:e2e`.

Каждый язык — отдельный чанк сборки, грузится только выбранный. Сейчас все чанки ещё и
прекэшируются service worker'ом (их два, это ~15 КБ gzip), чтобы смена языка работала офлайн.
При 11 языках стоит перевести словари на runtime-кэш — см. `workbox` в `vite.config.ts`.

## Экран установки

Правила — `docs/CONCEPT.md` → «Экран установки». Код: `features/install.ts` (состояние `gate`:
`gate | done | off`), `screens/InstallGate.tsx`, `components/InstallScene.tsx`, `lib/platform.ts`.

- Ключи `localStorage`: `tp-install-skip` — дата «Продолжить в браузере» (действует 7 дней; его же ставят
  тесты через `fresh()` в `tests/e2e/helpers.ts`), `tp-install-claimed` — нажали «Я установил».
- Кнопки внизу появляются, когда невидимый якорь `.ig-end` попадает в экран (IntersectionObserver).
- Новый шаг или сцена: текст — `install.*` в словарях, сцена — новый `case` в `InstallScene.tsx` на общих
  формах (`Phone`, `Ring`, `Row`…), без `<text>` внутри SVG.

## Цвета дней

7 дней — 7 цветов: `--c1…--c7` (декор), `--cN-fill` (фон под белым текстом), `--cN-ink` (цветной текст)
в `styles/tokens.css`, отдельно для светлой и тёмной темы. Контраст ≥ 4.5:1 проверен для белого на fill и
для ink на фонах `--bg`, `--card`, `--soft`.

## CI

`.github/workflows/deploy.yml`: lint → i18n:check → сборка → Playwright → сборка для Pages → деплой.
Деплой только после зелёных тестов. На CI по умолчанию сокращённая матрица (iPhone 11, iPhone 17 Pro Max,
Pixel 7, офлайн, ПК, юнит-тесты); полная — локально или Actions → Run workflow → «full». Таймаут теста на CI
90 с, один повтор.

## Точки расширения (этапы 2–4, логики пока нет)

- `src/advice/index.ts` — интерфейс `Advice` и список правил `RULES`. Сейчас одно правило из первой
  версии (подсказка прогрессии); снижение нагрузки, предупреждения о весе, восстановление — сюда же.
- `Settings.theme` — строка; сейчас `system | light | dark`, темы этапа 2 добавляются токенами в CSS.
- `Settings.tipsEnabled`, `Settings.lastBackupAt` — поля уже в схеме, интерфейса пока нет.
- Экспорт и импорт JSON из первой версии сохранены на новой схеме (`features/backup.ts`);
  полноценный бэкап с напоминанием и SHA-256 — этап 2.
- Юридические тексты — заглушки в словарях (`legal.*`), итоговые — этап 2.
