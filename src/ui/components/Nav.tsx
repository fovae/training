import { go, route, type Tab } from '../../state/ui';
import { installPrompt, promptInstall } from '../../features/install';
import { active } from '../../state/workout';
import { Icon } from './Icon';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'program', label: 'Программа' },
  { id: 'history', label: 'История' },
  { id: 'settings', label: 'Настройки' },
];

/** Нижняя таб-панель на телефоне, боковая навигация на широком экране */
export function Nav() {
  const cur = route.value.tab;
  return (
    <nav class="nav" aria-label="Разделы">
      <div class="nav-brand" aria-hidden="true">
        <span class="brand-mark">3+1</span>
        <span>Тренировки</span>
      </div>
      {TABS.map((t) => (
        <a
          key={t.id}
          href={'#/' + t.id}
          class={'nav-item' + (cur === t.id ? ' on' : '')}
          aria-current={cur === t.id ? 'page' : undefined}
          onClick={(e) => {
            // повторный тап по активному табу — наверх
            if (cur === t.id && !route.value.sub) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <span class="nav-ic">
            <Icon name={t.id} size={24} />
            {t.id === 'today' && active.value && <span class="nav-live" aria-label="идёт тренировка" />}
          </span>
          <span class="nav-lb">{t.label}</span>
        </a>
      ))}
      {installPrompt.value && (
        <button type="button" class="nav-install" onClick={() => void promptInstall()}>
          <Icon name="download" size={18} /> Установить
        </button>
      )}
    </nav>
  );
}

export const goTab = (t: Tab) => go(t);
