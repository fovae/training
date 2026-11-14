import { computed, signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { navDir, route, tabSide, pickedDayId, planDayId, todayDayId, toast } from '../state/ui';
import { booted, needsOnboarding } from '../state/app';
import { active } from '../state/session';
import { settings } from '../state/settings';
import { startRest, timer, togglePause } from '../features/timer';
import { offlineReady } from '../features/update';
import { Nav } from './components/Nav';
import { Flash, RestTimerBar } from './components/RestTimerBar';
import { DialogHost, MenuHost, Toasts } from './components/Overlays';
import { SelectHost } from './components/Select';
import { shiftDay } from './components/DaySwitcher';
import { Today } from './screens/Today';
import { Plan } from './screens/Plan';
import { Library, LibraryDetail } from './screens/Library';
import { ExerciseDetail, History, WorkoutDetail } from './screens/History';
import { Settings } from './screens/Settings';
import { Legal } from './screens/Legal';
import { Onboarding } from './screens/Onboarding';
import { LegalUpdate } from './screens/LegalUpdate';
import { needsAcceptance } from '../content/legal';
import { profile } from '../state/settings';
import { gateVisible } from '../features/install';

/** Профиль есть, но текущие версии документов не приняты */
const legalPending = computed(() => !!profile.value && needsAcceptance(profile.value.legalAccepted));

/**
 * Экран установки грузится отдельным чанком: в установленном приложении он не нужен никогда.
 * Чанк всё равно прекэшируется service worker'ом — офлайн работает.
 */
const GateScreen = signal<ComponentType | null>(null);
function InstallGateLazy() {
  if (!GateScreen.value) void import('./screens/InstallGate').then((m) => (GateScreen.value = m.InstallGate));
  const C = GateScreen.value;
  return C ? <C /> : <div class="screen" aria-busy="true" />;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable="true"]');

/** Клавиатура на ПК: ← → — смена дня, пробел — старт/пауза таймера */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.body.classList.contains('modal-open') || needsOnboarding.value || gateVisible.value)
        return;
      const tab = route.value.tab;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !route.value.sub) {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (tab === 'plan') {
          planDayId.value = shiftDay(planDayId.value, dir);
          e.preventDefault();
        } else if (tab === 'today' && !active.value) {
          pickedDayId.value = shiftDay(todayDayId.value, dir);
          e.preventDefault();
        }
      }
      if (e.code === 'Space' || e.key === ' ') {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
        if (timer.value) {
          togglePause();
          e.preventDefault();
        } else if (active.value) {
          startRest(settings.value.restBaseSec);
          e.preventDefault();
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}

function Screen() {
  const r = route.value;
  if (r.tab === 'legal') return <Legal doc={(r.sub?.id ?? 'privacy') as 'privacy' | 'terms' | 'licenses'} />;
  // Экран установки — до онбординга и всего остального (кроме юридических страниц)
  if (gateVisible.value) return <InstallGateLazy />;
  if (needsOnboarding.value) return <Onboarding />;
  if (legalPending.value) return <LegalUpdate />;
  switch (r.tab) {
    case 'plan':
      return <Plan />;
    case 'library':
      return r.sub ? <LibraryDetail id={r.sub.id} /> : <Library />;
    case 'history':
      if (r.sub?.kind === 'workout') return <WorkoutDetail id={r.sub.id} />;
      if (r.sub?.kind === 'exercise') return <ExerciseDetail id={r.sub.id} />;
      return <History />;
    case 'settings':
      return <Settings />;
    default:
      return <Today />;
  }
}

export function App() {
  useKeyboard();

  // Новый экран: каскад появления разрешён, пока экран входит (motion.css, main[data-enter]).
  // Обновления внутри экрана (смена дня, фильтры) проявляются сразу, без каскада и задержек.
  const screenKey = route.value.tab + '/' + (route.value.sub?.kind ?? '') + '/' + (route.value.sub?.id ?? '');
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const m = mainRef.current;
    if (!m) return;
    m.dataset.enter = '';
    const id = window.setTimeout(() => delete m.dataset.enter, 1000);
    return () => window.clearTimeout(id);
  }, [screenKey, booted.value]);

  useEffect(() => {
    if (offlineReady.value) toast(t('app.offlineReady'));
  }, [offlineReady.value]);

  if (!booted.value) return <div id="boot" aria-hidden="true" />;
  const onboarding =
    needsOnboarding.value || ((gateVisible.value || legalPending.value) && route.value.tab !== 'legal');

  return (
    <div class={'shell' + (timer.value ? ' has-timer' : '') + (onboarding ? ' no-nav' : '')}>
      <div class="status-shim" aria-hidden="true" />
      <a class="skip-link" href="#main">
        {t('app.skipToContent')}
      </a>
      {!onboarding && <Nav />}
      {/* key — новый экран монтируется заново и плавно появляется; data-nav — направление */}
      <main ref={mainRef} id="main" tabIndex={-1} data-nav={navDir.value} data-side={tabSide.value || undefined}>
        <Screen key={screenKey} />
      </main>
      <RestTimerBar />
      <Toasts />
      <MenuHost />
      <SelectHost />
      <DialogHost />
      <Flash />
    </div>
  );
}
