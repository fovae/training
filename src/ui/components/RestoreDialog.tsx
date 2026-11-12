import { LOCALES, fmtDate, t } from '../../i18n';
import type { ReadyRestore } from '../../features/backup';
import { ask } from '../../state/ui';

/**
 * Окно «что в копии» перед восстановлением: тренировки, период, язык, версия.
 * Общее для «Настройки → Данные» и онбординга («У меня есть файл»). Всё из файла — только текстом.
 */
export function askRestore(
  ready: ReadyRestore,
  o: { title: string; body: string; confirm: string; danger?: boolean },
) {
  const sm = ready.summary;
  return ask({
    title: o.title,
    body: (
      <div class="restore-summary">
        <dl class="facts">
          <div>
            <dt>{t('backup.sumWorkouts')}</dt>
            <dd>{t('backup.workoutsCount', { count: sm.sessions })}</dd>
          </div>
          {sm.from && sm.to && (
            <div>
              <dt>{t('backup.sumPeriod')}</dt>
              <dd>
                {fmtDate(Date.parse(sm.from))} – {fmtDate(Date.parse(sm.to))}
              </dd>
            </div>
          )}
          {sm.locale && (
            <div>
              <dt>{t('backup.sumLanguage')}</dt>
              <dd>{LOCALES.find((l) => l.code === sm.locale)?.native ?? sm.locale}</dd>
            </div>
          )}
          {sm.appVersion && (
            <div>
              <dt>{t('backup.sumVersion')}</dt>
              <dd>{sm.appVersion}</dd>
            </div>
          )}
        </dl>
        <p>{o.body}</p>
      </div>
    ),
    confirm: o.confirm,
    danger: o.danger ?? true,
  });
}
