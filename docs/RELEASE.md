# Релиз, домен и хостинг

## Версии

С публичного релиза 0.1.0: каждая правка — следующая заплатка (0.1.1, 0.1.2…), пять заплаток —
следующая малая версия (0.2.0), пять малых — следующая большая. Версия — в `package.json`
(`npm version X.Y.Z --no-git-tag-version`), запись — в `CHANGELOG.md`, заголовок коммита —
«App VerX.Y.Z (Два слова)».

## Сайт: https://simpletraining.app/ (Cloudflare Pages)

Как устроено — `docs/ARCHITECTURE.md`, раздел «Хостинг и защита». Первый запуск (один раз):

1. **Cloudflare → API токен.** My Profile → API Tokens → Create Token → Custom token: права
   «Account · Cloudflare Pages · Edit», аккаунт — свой. Скопировать токен.
2. **Account ID.** Cloudflare → Workers & Pages → справа «Account ID» — скопировать.
3. **GitHub → секреты.** Репозиторий → Settings → Secrets and variables → Actions → New repository
   secret: `CLOUDFLARE_API_TOKEN` и `CLOUDFLARE_ACCOUNT_ID`.
4. **Пуш в `main`** → GitHub Actions: проверки и тесты → выкладка. Проект `simple-training` создаётся
   сам при первой выкладке; сайт появится на `simple-training.pages.dev`.
5. **Домен.** Cloudflare → Workers & Pages → simple-training → Custom domains → Set up a custom
   domain → `simpletraining.app` (домен уже в Cloudflare — DNS-запись добавится сама). Так же
   `www.simpletraining.app`, затем правило перенаправления www → без www (Rules → Redirect Rules →
   шаблон «Redirect from WWW to root»).
6. **HTTPS.** SSL/TLS → Edge Certificates: «Always Use HTTPS» — включить, HSTS — включить
   (max-age 12 месяцев, include subdomains). Домены `.app` и так работают только по HTTPS.
7. **Не включать** в Cloudflare для этого сайта Web Analytics, Bot Fight Mode и прочее, что ставит
   cookie или собирает статистику посетителей: Privacy Policy обещает, что аналитики нет. Захочется
   включить — сначала обновить Privacy Policy.
8. **2FA** на аккаунте Cloudflare (My Profile → Authentication) и на GitHub.

После того как сайт на новом домене проверен (`docs/CHECKLIST.md`, «Новый домен»):

9. GitHub → Settings → Pages → отключить GitHub Pages (Source: None).
10. GitHub → Settings → General → Danger Zone → Change visibility → Private. Выкладка продолжит
    работать: GitHub Actions доступен приватным репозиториям (бесплатно — 2000 минут в месяц;
    один прогон ~15–20 минут).

Старый адрес `fovae.github.io/training` после шага 9 перестанет открываться. Перенаправление на новый
домен — отдельная задача (GitHub Pages сам на чужой домен не перенаправляет).
