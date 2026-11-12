import { useLayoutEffect, useRef } from 'preact/hooks';
import { LEGAL_META, currentAcceptance } from '../../content/legal';
import { t } from '../../i18n';
import { updateProfile } from '../../state/settings';
import { fmtDocDate } from './Legal';

/**
 * «We updated our documents»: версия Privacy или Terms выросла (или документы ещё не приняты).
 * Читать документы можно без принятия, продолжить пользоваться приложением — нет.
 */
export function LegalUpdate() {
  const head = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => head.current?.focus(), []);
  return (
    <div class="screen legal-update">
      <header class="topbar">
        <div class="eyebrow">{t('app.name')}</div>
        <h1 class="screen-title" tabIndex={-1} ref={head}>
          {t('legal.updatedTitle')}
        </h1>
      </header>
      <section class="card prose">
        <p>{t('legal.updatedBody')}</p>
        <ul class="list">
          {(['terms', 'privacy'] as const).map((d) => (
            <li key={d}>
              <a class="row" href={`#/legal/${d}`}>
                <span class="row-main">
                  <b>{t(`legal.${d}Title`)}</b>
                  <span class="muted">
                    {t('legal.versionLine', {
                      version: LEGAL_META[d].version,
                      date: fmtDocDate(LEGAL_META[d].updated),
                    })}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <button
        type="button"
        class="btn primary block"
        onClick={() => updateProfile({ legalAccepted: currentAcceptance() })}
      >
        {t('legal.accept')}
      </button>
    </div>
  );
}
