import { t } from '../../i18n';
import { goTab, pendingTab, route, type Tab } from '../../state/ui';
import { installPrompt, promptInstall } from '../../features/install';
import { active } from '../../state/session';
import { Icon } from './Icon';
import { scrollBehavior } from '../../lib/motion';

const TABS: Exclude<Tab, 'legal'>[] = ['today', 'plan', 'library', 'history', 'settings'];

/** Нижняя таб-панель на телефоне, боковая навигация на широком экране */
export function Nav() {
  // Нажатая вкладка подсвечивается сразу, ещё до отрисовки её экрана (goTab)
  const cur = pendingTab.value ?? route.value.tab;
  const idx = TABS.indexOf(cur as (typeof TABS)[number]);
  return (
    <nav class="nav" aria-label={t('nav.label')}>
      {/* Индикатор активной вкладки плавно перетекает между вкладками (только transform) */}
      {idx >= 0 && <span class="nav-ind" aria-hidden="true" style={{ '--i': idx }} />}
      <div class="nav-brand" aria-hidden="true">
        <span class="brand-mark">ST</span>
        <span>{t('app.name')}</span>
      </div>
      {TABS.map((id) => (
        <a
          key={id}
          href={'#/' + id}
          class={'nav-item' + (cur === id ? ' on' : '')}
          aria-current={cur === id ? 'page' : undefined}
          onClick={(e) => {
            // Cmd/Ctrl-клик и средняя кнопка — как у обычной ссылки
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            // повторный тап по активному табу — наверх
            if (cur === id && route.value.tab === id && !route.value.sub)
              window.scrollTo({ top: 0, behavior: scrollBehavior() });
            else goTab(id);
          }}
        >
          <span class="nav-ic">
            <Icon name={id} size={24} />
            {id === 'today' && active.value && <span class="nav-live" aria-label={t('nav.live')} />}
          </span>
          <span class="nav-lb">{t(`nav.${id}`)}</span>
        </a>
      ))}
      {installPrompt.value && (
        <button type="button" class="nav-install" onClick={() => void promptInstall()}>
          <Icon name="download" size={18} /> {t('install.button')}
        </button>
      )}
    </nav>
  );
}
