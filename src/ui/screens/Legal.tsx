import { t, tList } from '../../i18n';
import { CONTACT_EMAIL } from '../../lib/meta';
import { needsOnboarding } from '../../state/app';
import { Icon } from '../components/Icon';

/** Заглушки политики и условий. Итоговые тексты — на этапе 2. */
export function Legal({ doc }: { doc: 'privacy' | 'terms' }) {
  const back = needsOnboarding.value ? '#/' : '#/settings';
  return (
    <div class="screen legal">
      <header class="topbar">
        <a class="back" href={back}>
          <Icon name="back" size={20} /> {t('common.back')}
        </a>
        <h1 class="screen-title sm">{t(`legal.${doc}.title`)}</h1>
      </header>
      <article class="card prose">
        <p class="note">{t('legal.draft')}</p>
        {tList(`legal.${doc}.body`).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p>{t('legal.disclaimer')}</p>
        <h2>{t('legal.controllerTitle')}</h2>
        <p>
          {t('legal.controller')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        <p class="muted small credits">{t('about.credits')}</p>
      </article>
    </div>
  );
}
