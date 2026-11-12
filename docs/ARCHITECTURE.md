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
    exercises.ts          доступ к базе: loadCatalog(), findExercise(), фильтр и поиск (основной чанк)
    catalog/              САМА база (~120 упражнений) — отдельный ленивый чанк:
      make.ts             запись упражнения make({…})
      base.ts             27 упражнений этапов 1–2
      b1-…b4-*.ts         этап 3А: грудь и спина, ноги, плечи и руки, корпус/кардио/растяжка
      index.ts            EXERCISES, PICS, picMarkup()
    templates.ts          шаблоны: Всё тело 3 дня, Верх и низ 4, Тянуть-толкать-ноги 3, Лёгкий 2, Сплит 3+1
  pics/
    engine.ts             движок SVG (холст 200×135, пол y = 127), общий для всех схем
    defs.ts               25 исходных схем по точкам — не менять (тест сверяет SVG с fixtures/pics-stage2.json)
    kit.ts                генератор «скелета» по углам суставов + реквизит (штанга, гиря, скамьи, стойка…)
    sets/b1…b4.ts         схемы этапа 3А
  i18n/
    index.ts              t(), tList(), Intl для чисел и дат, PluralRules, загрузка языка
    locales/en/*.json     английский — источник истины
    locales/ru/*.json     русский
  db/
    index.ts              IndexedDB: версии схемы, upgrade(), запросы
    migrations.ts         чистые функции миграции v1 → v2 (и для импорта старых файлов)
  advice/
    rules.ts              советы по правилам — чистые функции (прогрессия, снижение нагрузки,
                          восстановление, «начни с лёгкого веса»), лимит 2 на тренировку, отсрочка 14 дней
    levels.ts             что меняет уровень; множители порога веса
    weight.ts             проверка веса: нереальный (по таблице) и опечатка ×8
    index.ts              связка с состоянием и выключателем «Показывать советы»
  backup/                 формат копии, каноническая строка, SHA-256, схема valibot; напоминание
  content/legal/          Privacy и Terms (en, дословно, frontmatter с версиями); принятие версий
  content/licenses.ts     лицензии (собираются при сборке scripts/licenses.mjs → content/generated/)
  data/weightLimits.ts    таблица порогов веса (docs/WEIGHT_LIMITS.md)
  themes/themes.json      10 тем: из него собирается CSS (virtual:themes.css) и проверяется контраст
  lib/markdown.tsx        безопасный рендер Markdown юридических текстов (узлы Preact, без innerHTML)
  lib/stats.ts            статистика по неделям и рекорды — чистые функции
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
  pics-sheet.mjs          контактный лист всех схем → docs/review/pictograms.html (npm run pics:sheet)
  generate-assets.mjs     иконки и splash-экраны
tests/e2e/                Playwright: iPhone (WebKit), Pixel (Chromium), офлайн и обновление, ПК, axe,
                          миграция, сеть, экран установки, скриншоты 375/390/430, русская версия
tests/e2e/*.unit.spec.ts  юнит-тесты без браузера (проект `unit`)
```

## Данные и миграции

База `training-pwa`, текущая версия — **3**.

| Версия | Хранилища и поля |
| ------ | ---------------- |
| v2 | `sessions`, `kv.profile`, `kv.plan`, `kv.settings`, `kv.activeSession` (этап 1) |
| v3 | то же + `Settings`: 10 тем и `auto`, `tipState`, `weightWarningIgnored`, `backupReminderDismissedAt`; `Profile.legalAccepted`; `kv.restoreSnapshot` (откат восстановления) |

Шаг v2 → v3 (`upgrade()` в `src/db/index.ts`, чистые функции в `src/db/migrations.ts`):

- тема: `light` → `classic-orange`, `dark` → `classic-dark`, `system` → `auto`;
- в настройки добавляются новые поля со значениями по умолчанию;
- у профиля `legalAccepted: null`, поэтому при запуске появляется «We updated our documents»;
- остатки v1 (хранилище `workouts`, `kv.legacyPrefs`, `kv.activeWorkout`) удаляются.

Тест: `tests/e2e/migration.spec.ts` (фикстура v2) и юнит-тесты в `logic.unit.spec.ts`.

Миграция с v1 удалена на этапе 2: владелец переносит старые тренировки вручную.

**Новая версия схемы.**

1. Увеличь `DB_VERSION`.
2. Добавь блок `if (oldVersion < N)` в `upgrade()`.
3. Добавь чистую функцию в `migrations.ts`.
4. Добавь тест с фикстурой предыдущей версии.

Старые шаги не удаляй.

## Как добавить упражнение

База живёт в ленивом чанке `src/data/catalog/` и грузится при запуске вместе со словарём
(`loadCatalog()` в `state/app.ts`). Основной чанк от размера базы не растёт.

1. **Схема.** Добавь позы в подходящий файл `src/pics/sets/*.ts` (или новый файл + строка в
   `catalog/index.ts`). Позы задаются углами суставов через `body()` из `src/pics/kit.ts`:

   ```ts
   goblet_squat: {
     env: '',                       // реквизит окружения: env.flat(), env.rack(), env.bar(), env.column()…
     mv: 'hp',                      // стрелка движения от сустава начальной позы к конечной
     poses: [                       // ВСЕГДА две позы: начало (бледная) и конец (яркая)
       body({ at: [100, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [20, 164], hold: 'kb' }),
       body({ at: [104, 125], root: 'foot', torso: 160, leg: [86, -28, 90], arm: [20, 164], hold: 'kb' }),
     ],
   },
   ```

   Углы абсолютные: 0 — вниз, 90 — вперёд (вправо), 180 — вверх, −90 — назад. `handAt` / `footAt`
   привязывают кисть или стопу к точке (гриф, пол, рукоять). В руках: `db`, `dbv`, `bb` (штанга с
   торца), `kb`, `handle` (для троса блока). Вид спереди — `facing()`, ноги — `frontLegs()`.
2. **Запись** `make({…})` в `src/data/catalog/*.ts`:

   ```ts
   make({
     id: 'goblet-squat',            // стабильный id: никогда не меняй и не переиспользуй
     pic: 'goblet_squat',
     category: 'legs',              // chest back shoulders arms core legs cardio mobility
     primary: ['quads', 'glutes'],
     secondary: ['deep-core'],
     equipment: ['kettlebell', 'dumbbell'],
     type: 'compound',              // compound → «базовый» отдых, isolation → «изоляция»
     metric: 'weight_reps',         // или 'reps', 'time' (до 600 с на подход)
     per: 'side',                   // необязательно: «на руку» / «на сторону»
     cues: 3, mistakes: 2,          // сколько строк техники и ошибок в словаре (новые: 3–4 и 2–3)
     defaults: d(3, 8, 12),         // подходы и повторы при добавлении в план
   }),
   ```

   Новая мышца — в `Muscle` (`types`), `MUSCLES` (`data/exercises.ts`), `RECOVERY_GROUP`
   (`advice/rules.ts`, TypeScript не даст забыть) и `muscle.*` в словарях.
3. **Тексты** во **все** языки, `locales/<язык>/exercises.json` → `ex.<id>`: `name`, `desc`, `cues[]`,
   `mistakes[]`, `safety`. Своими словами; ни слова о весе тела, питании, калориях, внешнем виде
   (`tests/e2e/catalog.unit.spec.ts` проверяет). Для штанги в `safety` — упоры/страховка, замки, «не
   делай, если не контролируешь движение», без цифр веса.
4. Проверка: `npm run i18n:check`, `npm run pics:sheet` (посмотреть схему глазами),
   `npx playwright test --project=unit` (две позы, схема в рамке, исходные схемы не изменились).

Ярлыков «дом» и «зал» нет — нужное оборудование видно в карточке и в фильтре.

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

## Темы и цвета дней

Все цвета задаются в `src/themes/themes.json`. Это 10 тем: `classic-orange` (по умолчанию),
`classic-light`, `classic-dark`, `monochrome`, `blue`, `violet`, `green`, `rose`, `gradient-1`,
`gradient-2`. Режим `auto` берёт `classic-light` или `classic-dark` по системной теме.

**Сборка CSS.** Плагин `themesCss` в `vite.config.ts` превращает JSON в CSS-переменные
`:root[data-theme="…"]`:
- `--bg`, `--card`, `--soft`, `--line`, `--ink`, `--muted`;
- `--danger`, `--danger-fill`;
- `--chart-1`, `--chart-2`;
- для каждого из 7 дней: `--cN` (декор), `--cN-fill` (фон под белым текстом), `--cN-ink` (цветной
  текст), `--cN-bg` (шапка дня: в градиентных темах градиент из `fill` и `fill2`).

**Где градиент.** Только на шапке дня и превью тем, под обычным текстом градиента нет.

**Монохром.** Дни различаются яркостью заливки и подписью «День N».

**Без мигания при запуске.** Тема зеркалится в `localStorage['tp-boot']`, и загрузочный скрипт
`index.html` ставит `data-theme` до отрисовки. Приложение меняет тему только после чтения настроек из
базы.

**Контраст.** `npm run theme:check` (в CI) проверяет WCAG AA:
- текст 4.5:1: основной и второстепенный на `bg`, `card` и `soft`; цветной текст дней на
  поверхностях и на подкраске цветом дня (14% поверх карточки); белый на заливках и на обоих цветах
  градиента; `danger`;
- 3:1: декор дня и цвета графиков.

**Новая тема.**
1. Добавь объект в `themes.json`.
2. Добавь id в `THEMES` (`src/types/index.ts`).
3. Добавь название `theme.<id>` в словари.
4. Запусти `npm run theme:check`.

## CI

`.github/workflows/deploy.yml`: lint → i18n:check → theme:check → legal:check → сборка (там же лицензии)
→ Playwright → сборка для Pages → деплой.
Деплой только после зелёных тестов. На CI по умолчанию сокращённая матрица (iPhone 11, iPhone 17 Pro Max,
Pixel 7, офлайн, ПК, юнит-тесты); полная — локально или Actions → Run workflow → «full». Таймаут теста на CI
90 с, один повтор.

## Юридические документы

- **Тексты.** `src/content/legal/en/privacy.md` и `terms.md`, дословно от юриста. Во frontmatter
  указаны `version` и `updated`.
- **Версии.** Плагин `legalMeta` (`virtual:legal-meta`) читает их при сборке, в коде версии не
  хардкодятся.
- **Принятие.** Онбординг записывает в `Profile.legalAccepted` версии обоих документов и время.
  Если версия любого документа выросла, `LegalUpdate` показывает «We updated our documents».
  Прочитать документы можно без принятия, продолжить без «Accept» нельзя.
- **Экран документа.** Оглавление по `##`. Внешние `https:`-ссылки открываются в новой вкладке с
  `rel="noopener noreferrer"`: это единственные внешние ссылки в приложении, запросов к чужим доменам
  нет.
- **Лицензии.** `#/legal/licenses` собирается при сборке из зависимостей (`scripts/licenses.mjs`).
- **Русский интерфейс.** Документы показываются на английском с пометкой: перевода пока нет
  (`docs/LEGAL_PLACEHOLDERS.md`).

## Советы, уровни, вес, копия, статистика

- Советы: `src/advice/rules.ts`. Не больше двух советов на тренировку. Закрытый совет не повторяется
  14 дней (`tipState`). Выключатель — `settings.tipsEnabled`.
- Порог веса: `docs/WEIGHT_LIMITS.md`. Две модели: `standards-elite` (отношение × вес тела) и
  `class-record` (рекорд категории IPF; присед, жим лёжа, становая). Штанга — строки с `pending: true`, в боевой сборке
  выключены до `BARBELL_LIMITS_APPROVED = true` (`src/data/weightLimits.ts`); в тестах — флаг
  `localStorage['tp-test-flags'] = 'barbell-limits'`.
- Восстановление (48 ч): сравниваются группы из `RECOVERY_GROUP`; растяжка и упражнения на время не
  считаются нагрузкой (`countsForRecovery`).
- Шаблоны подстраиваются под уровень (`byLevel`): «первый раз» — на подход меньше (не меньше 2),
  «несколько раз» — до 3 подходов; для обоих тяжёлые упражнения со штангой заменяются простыми
  (`EASIER` в `data/templates.ts`). «Сплит 3+1» не меняется. Вес не подставляется никогда.
- Формат копии и восстановление: `docs/BACKUP.md`.
- Статистика: тренировок в неделю и объём за 10 недель (`BarChart` с таблицей-альтернативой); по
  упражнению — график и рекорды (максимальный вес, максимум повторов, лучший подход).

## Точки расширения (этапы 3–4)

- База 300+ (этап 4): новые файлы `catalog/b5-…ts` + `pics/sets/b5.ts`, контактный лист для проверки.
- Русские переводы документов: `src/content/legal/ru/`.
- Шифрование копии паролем — позже (не сейчас).
