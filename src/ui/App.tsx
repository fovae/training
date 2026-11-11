import { useEffect } from 'preact/hooks';
import { route, pickedDayId, programDayId, todayDayId } from '../state/ui';
import { active } from '../state/workout';
import { settings } from '../state/settings';
import { startRest, timer, togglePause } from '../features/timer';
import { offlineReady } from '../features/update';
import { toast } from '../state/ui';
import { Nav } from './components/Nav';
import { Flash, RestTimerBar } from './components/RestTimerBar';
import { DialogHost, Toasts } from './components/Overlays';
import { shiftDay } from './components/DaySwitcher';
import { Today } from './screens/Today';
import { Program } from './screens/Program';
import { ExerciseDetail, History, WorkoutDetail } from './screens/History';
import { Settings } from './screens/Settings';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]');

/** Клавиатура на ПК: ← → — смена дня, пробел — старт/пауза таймера */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.body.classList.contains('modal-open')) return;
      const tab = route.value.tab;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !route.value.sub) {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (tab === 'program') {
          programDayId.value = shiftDay(programDayId.value, dir);
          e.preventDefault();
        } else if (tab === 'today' && !active.value) {
          pickedDayId.value = shiftDay(todayDayId.value, dir);
          e.preventDefault();
        }
      }
      if (e.code === 'Space' || e.key === ' ') {
        // Пробел на сфокусированной кнопке/ссылке — её собственное действие
        if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return;
        if (timer.value) {
          togglePause();
          e.preventDefault();
        } else if (active.value) {
          startRest(settings.value.restBase);
          e.preventDefault();
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  useKeyboard();

  useEffect(() => {
    if (offlineReady.value) toast('Приложение готово к работе офлайн');
  }, [offlineReady.value]);

  const r = route.value;
  let screen;
  if (r.tab === 'program') screen = <Program />;
  else if (r.tab === 'history')
    screen =
      r.sub?.kind === 'workout' ? (
        <WorkoutDetail id={r.sub.id} />
      ) : r.sub?.kind === 'exercise' ? (
        <ExerciseDetail id={r.sub.id} />
      ) : (
        <History />
      );
  else if (r.tab === 'settings') screen = <Settings />;
  else screen = <Today />;

  return (
    <div class={'shell' + (timer.value ? ' has-timer' : '')}>
      <div class="status-shim" aria-hidden="true" />
      <a class="skip-link" href="#main">
        К содержимому
      </a>
      <Nav />
      <main id="main" tabIndex={-1}>
        {screen}
      </main>
      <RestTimerBar />
      <Toasts />
      <DialogHost />
      <Flash />
    </div>
  );
}
