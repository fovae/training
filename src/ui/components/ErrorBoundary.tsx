import { Component, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { hideBoot } from '../../lib/boot';
import { saveCopy } from '../../features/backup';

/**
 * Запасной экран при сбое отрисовки (0.1.0): вместо пустого экрана — объяснение и два действия:
 * «Перезапустить» и «Сохранить копию» (данные в IndexedDB не затронуты сбоем интерфейса).
 * Две границы: вокруг экрана (вкладки и меню остаются, переход на другую вкладку — новый экран)
 * и вокруг всего приложения (main.tsx). Строки — через t(); если сломан и словарь — по-английски.
 */
const FALLBACK: Record<string, string> = {
  'crash.title': 'Something went wrong',
  'crash.body': 'Your data is safe on this device. Restart the app; if it happens again, save a copy.',
  'crash.reload': 'Restart',
  'crash.save': 'Save a copy',
  'crash.saved': 'Copy saved',
  'crash.saveFailed': 'Could not save the copy',
};
function say(key: string): string {
  try {
    const s = t(key);
    return s && s !== key ? s : FALLBACK[key]!;
  } catch {
    return FALLBACK[key]!;
  }
}

function CrashScreen({ full }: { full?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'failed'>('idle');
  const onSave = async () => {
    setState('busy');
    try {
      const r = await saveCopy();
      setState(r === 'cancelled' ? 'idle' : 'saved');
    } catch (e) {
      console.error(e);
      setState('failed');
    }
  };
  return (
    <section class={'crash' + (full ? ' crash-full' : '')} role="alert" aria-labelledby="crash-h">
      <div class="card crash-card">
        <h1 id="crash-h">{say('crash.title')}</h1>
        <p class="muted">{say('crash.body')}</p>
        <button type="button" class="btn primary" onClick={() => location.reload()}>
          {say('crash.reload')}
        </button>
        <button type="button" class="btn" disabled={state === 'busy'} onClick={() => void onSave()}>
          {say('crash.save')}
        </button>
        {(state === 'saved' || state === 'failed') && (
          <p class="small muted" role="status">
            {say(state === 'saved' ? 'crash.saved' : 'crash.saveFailed')}
          </p>
        )}
      </div>
    </section>
  );
}

export class ErrorBoundary extends Component<
  { children: ComponentChildren; full?: boolean },
  { error: unknown }
> {
  override state = { error: null as unknown };
  static override getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override componentDidCatch(error: unknown): void {
    console.error('[ui]', error);
    // сбой до конца загрузки: заставка не должна закрывать запасной экран
    hideBoot();
  }
  override render() {
    return this.state.error ? <CrashScreen full={this.props.full} /> : this.props.children;
  }
}
