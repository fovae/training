# Что ждёт юриста

Тексты Privacy Policy v1.2 и Terms of Use v1.0 — финальные от юриста, перенесены дословно
(`src/content/legal/en/*.md`). Ниже — то, что ещё нужно проверить.

## Микротексты интерфейса (черновики)

Ключи `legal.*` в `src/i18n/locales/{en,ru}/ui.json`. Составлены по Terms: раздел 4 (риск, врач,
предупреждение о весе не значит безопасность) и раздел 7 (копия не шифруется, место хранения выбирает
пользователь).

| Ключ | Где | Текст (en) |
|---|---|---|
| `legal.adultLabel` | Онбординг, шаг 2 — галочка | I am at least 16 years old and I accept the Terms of Use and the Privacy Policy |
| `legal.adultRequired` | Онбординг — без галочки | To continue, confirm that you are at least 16 and accept the Terms of Use and the Privacy Policy. |
| `legal.disclaimer` | Онбординг, шаг 2 | Strength training has risks. You choose your exercises and weights and train at your own risk… |
| `legal.weightWarnTitle`, `legal.weightWarnBody` | Предупреждение о весе | This is a very heavy weight. The app does not recommend it; you do it at your own risk. A warning, or no warning, does not mean a weight is safe for you. |
| `legal.backupReminder`, `legal.backupReminderNote` | Напоминание о копии | Save a copy so you don't lose your progress. The file is not encrypted. You choose where to keep it. |
| `legal.backupNote` | Настройки → Data | A copy is a readable JSON file: it is not encrypted and is not sent to us… |
| `legal.deleteTitle`, `legal.deleteBody`, `legal.deleteConfirm` | Settings → Delete all data | …It cannot be undone, and we cannot recover it. Save a copy first if you need your data. |
| `legal.restoreTitle`, `legal.restoreBody` | Восстановление из копии | Replace current data? … Restore checks the file, but you are responsible for choosing it. |
| `legal.updatedTitle`, `legal.updatedBody`, `legal.accept` | Новая версия документов | We updated our documents… Accept |
| `legal.englishOnly` | Документ в неанглийском интерфейсе | (ru) Юридические документы пока доступны только на английском. При расхождениях главной считается английская версия. |
| `legal.responsible` | Settings → About | Fovae, a project of Vladyslav N. |

Русские переводы микротекстов — в `ru/ui.json`, их тоже стоит показать юристу.

## Переводов документов пока нет

- Русская версия Privacy Policy и Terms of Use — **нет**. Не переводим сами; в русском интерфейсе
  документ открывается на английском с пометкой `legal.englishOnly`.
- Когда перевод будет: `src/content/legal/ru/{privacy,terms}.md` с тем же frontmatter
  (`version`, `updated`) и загрузка по языку в `src/content/legal/index.ts`.

## Проверки в CI

- `npm run legal:check` — в `src/content/legal/**` нет строк `[OWNER` и `[PLACEHOLDER`.
- Версии документов берутся из frontmatter (`virtual:legal-meta`), не хардкодятся. Если версия
  выросла, при запуске приложение показывает «We updated our documents» и просит принять заново.
- Подписи, на которые ссылаются документы, совпадают буквально: **Settings → About**,
  **Settings → Delete all data** (проверяется в `tests/e2e/app.spec.ts`).
