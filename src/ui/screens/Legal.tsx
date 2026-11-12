import { useEffect, useState } from 'preact/hooks';
import { LEGAL_META, loadLegal, type LegalDoc } from '../../content/legal';
import { loadLicenses, type LicenseEntry } from '../../content/licenses';
import { locale, t } from '../../i18n';
import { renderMarkdown } from '../../lib/markdown';
import { needsOnboarding } from '../../state/app';
import { Icon } from '../components/Icon';

export const fmtDocDate = (iso: string): string =>
  new Intl.DateTimeFormat(locale.value === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'long' }).format(
    new Date(iso + 'T12:00:00Z'),
  );

function BackBar({ title }: { title: string }) {
  const back = needsOnboarding.value ? '#/' : '#/settings';
  return (
    <header class="topbar">
      <a class="back" href={back}>
        <Icon name="back" size={20} /> {t('common.back')}
      </a>
      <h1 class="screen-title sm">{title}</h1>
    </header>
  );
}

/** Privacy Policy и Terms of Use — дословно, только на английском (русского перевода пока нет) */
export function Legal({ doc }: { doc: LegalDoc | 'licenses' }) {
  if (doc === 'licenses') return <Licenses />;
  return <LegalDocument doc={doc} />;
}

function LegalDocument({ doc }: { doc: LegalDoc }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(null);
    void loadLegal(doc).then(setSrc);
  }, [doc]);
  const meta = LEGAL_META[doc];
  const md = src ? renderMarkdown(src) : null;
  const title = md?.title ?? t(`legal.${doc}Title`);

  return (
    <div class="screen legal">
      <BackBar title={title} />
      {locale.value !== 'en' && (
        <p class="note" lang={locale.value}>
          {t('legal.englishOnly')}
        </p>
      )}
      <article class="card prose" lang="en">
        <p class="muted small doc-meta">
          {t('legal.versionLine', { version: meta.version, date: fmtDocDate(meta.updated) })}
        </p>
        {md && md.headings.length > 0 && (
          <nav class="toc" aria-label={t('legal.toc')}>
            {/* Номер уже есть в заголовке («1. …») — список без своей нумерации, номер в отдельной
                колонке, чтобы «10.»–«14.» стояли ровно под «1.»–«9.» */}
            <ul>
              {md.headings.map((h) => {
                const m = /^(\d+\.)\s+(.*)$/.exec(h.text);
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      class="toc-link"
                      onClick={() => {
                        const el = document.getElementById(h.id);
                        el?.scrollIntoView({ block: 'start' });
                        el?.focus({ preventScroll: true });
                      }}
                    >
                      {m ? (
                        <>
                          <span class="toc-n">{m[1]}</span>
                          <span>{m[2]}</span>
                        </>
                      ) : (
                        <span class="toc-t">{h.text}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        {md ? md.nodes : <p class="muted">…</p>}
      </article>
    </div>
  );
}

/** Лицензии открытого ПО и шрифтов — список собирается при сборке, работает офлайн */
function Licenses() {
  const [list, setList] = useState<LicenseEntry[] | null>(null);
  useEffect(() => void loadLicenses().then(setList), []);
  return (
    <div class="screen legal">
      <BackBar title={t('legal.licensesTitle')} />
      <p class="muted small">{t('legal.licensesLead')}</p>
      <ul class="licenses">
        {(list ?? []).map((l) => (
          <li key={l.name} class="card">
            <details>
              <summary>
                <b>{l.name}</b>
                <span class="muted small">
                  {l.version} · {l.license}
                </span>
              </summary>
              <pre>{l.text}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
