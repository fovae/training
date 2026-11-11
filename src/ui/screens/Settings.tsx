import { useEffect, useRef } from 'preact/hooks';
import changelog from '../../../CHANGELOG.md?raw';
import { settings, updateSettings, type Settings as S } from '../../state/settings';
import { ask, toast } from '../../state/ui';
import { history } from '../../state/workout';
import {
  applyBackup,
  checkPersist,
  exportData,
  parseBackup,
  persistStatus,
  requestPersist,
  resetAll,
} from '../../features/backup';
import { wakeStatus, wakeSupported } from '../../features/wakelock';
import { audioAvailable, beep } from '../../features/audio';
import { installPrompt, installed, isIOS, isStandalone, promptInstall } from '../../features/install';
import { fmtClock, fmtDate, plural } from '../../lib/format';
import { Icon } from '../components/Icon';
import { IosInstallSteps } from '../components/InstallHint';

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="seg mini" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          class={'seg-btn' + (value === o.v ? ' on' : '')}
          onClick={() => onChange(o.v)}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      class={'switch' + (on ? ' on' : '')}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

function Stepper({
  value,
  onChange,
  label,
  min = 15,
  max = 600,
  step = 15,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label}: меньше`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite">{fmtClock(value)}</output>
      <button
        type="button"
        aria-label={`${label}: больше`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

const PERSIST_TEXT = {
  persisted: 'Включено — iOS/браузер не удалит данные при нехватке места.',
  'not-persisted': 'Не включено — браузер может очистить данные. Регулярно делай экспорт.',
  unsupported: 'Браузер не поддерживает. Регулярно делай экспорт.',
  unknown: 'Проверяем…',
} as const;

const WAKE_TEXT = {
  unsupported:
    'Не поддерживается этим браузером (на iPhone нужна iOS 16.4+, в установленном приложении — 18.4+).',
  off: 'Включится во время тренировки.',
  on: 'Активно: экран не погаснет.',
  error: 'Система отклонила запрос — экран может гаснуть. Обнови iOS или держи приложение открытым.',
} as const;

export function Settings() {
  const s = settings.value;
  const set = <K extends keyof S>(k: K, v: S[K]) => updateSettings({ [k]: v } as Partial<S>);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkPersist();
  }, []);

  const onExport = async () => {
    try {
      const r = await exportData();
      if (r === 'downloaded') toast('Файл сохранён в «Загрузки»');
      if (r === 'shared') toast('Резервная копия готова');
    } catch (e) {
      console.error(e);
      toast('Не удалось сделать экспорт');
    }
  };

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      const n = parsed.workouts.length;
      const ok = await ask({
        title: 'Восстановить из копии?',
        body: (
          <>
            В файле {n} {plural(n, 'тренировка', 'тренировки', 'тренировок')}
            {parsed.exportedAt ? ` (копия от ${fmtDate(Date.parse(parsed.exportedAt))})` : ''}.
            <br />
            Текущие данные ({history.value.length}) будут заменены.
          </>
        ),
        confirm: 'Заменить',
        danger: true,
      });
      if (ok !== 'confirm') return;
      await applyBackup(parsed);
      toast('Данные восстановлены');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Не удалось прочитать файл');
    }
  };

  const onReset = async () => {
    const r = await ask({
      title: 'Удалить все данные?',
      body: 'История тренировок и текущая тренировка будут удалены без возможности восстановления. Сначала сделай экспорт, если данные нужны.',
      confirm: 'Удалить всё',
      danger: true,
      extra: { label: 'Сначала экспорт' },
    });
    if (r === 'extra') {
      await onExport();
      return;
    }
    if (r !== 'confirm') return;
    await resetAll();
    toast('Данные удалены');
  };

  const showIosInstall = isIOS && !isStandalone();

  return (
    <div class="screen settings">
      <header class="topbar">
        <div class="eyebrow">Приложение</div>
        <h1 class="screen-title">Настройки</h1>
      </header>

      <section class="card group-card">
        <h2 class="card-t">Внешний вид и единицы</h2>
        <div class="srow">
          <span>Тема</span>
          <Seg
            label="Тема"
            value={s.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { v: 'system', t: 'Авто' },
              { v: 'light', t: 'Светлая' },
              { v: 'dark', t: 'Тёмная' },
            ]}
          />
        </div>
        <div class="srow">
          <span>Единицы веса</span>
          <Seg
            label="Единицы веса"
            value={s.units}
            onChange={(v) => set('units', v)}
            options={[
              { v: 'kg', t: 'кг' },
              { v: 'lb', t: 'фунты' },
            ]}
          />
        </div>
      </section>

      <section class="card group-card">
        <h2 class="card-t">Таймер отдыха</h2>
        <div class="srow">
          <span>
            Базовые упражнения
            <small>программа: 2–3 мин</small>
          </span>
          <Stepper label="Отдых в базовых" value={s.restBase} onChange={(v) => set('restBase', v)} />
        </div>
        <div class="srow">
          <span>
            Изоляция
            <small>программа: 60–120 с</small>
          </span>
          <Stepper label="Отдых в изоляции" value={s.restIso} onChange={(v) => set('restIso', v)} />
        </div>
        <div class="srow">
          <span>
            Звук по окончании
            <small>
              {audioAvailable()
                ? 'На iPhone звук не слышен в беззвучном режиме — останется вспышка.'
                : 'Звук недоступен — будет только вспышка.'}
            </small>
          </span>
          <span class="srow-act">
            {s.sound && audioAvailable() && (
              <button type="button" class="btn-ghost sm" onClick={beep}>
                Проверить
              </button>
            )}
            <Toggle label="Звук" on={s.sound} onChange={(v) => set('sound', v)} />
          </span>
        </div>
        <div class="srow">
          <span>
            Не гасить экран
            <small>{WAKE_TEXT[wakeStatus.value]}</small>
          </span>
          <Toggle
            label="Не гасить экран во время тренировки"
            on={s.wakeLock && wakeSupported}
            disabled={!wakeSupported}
            onChange={(v) => set('wakeLock', v)}
          />
        </div>
      </section>

      <section class="card group-card">
        <h2 class="card-t">Данные</h2>
        <p class="muted small">
          iOS может очистить хранилище приложения, если им долго не пользоваться. Делай экспорт раз в
          несколько недель — файл можно сохранить в «Файлы» или iCloud.
        </p>
        <div class="srow">
          <span>
            Постоянное хранилище
            <small>{PERSIST_TEXT[persistStatus.value]}</small>
          </span>
          {persistStatus.value === 'not-persisted' && (
            <button type="button" class="btn-ghost sm" onClick={() => void requestPersist()}>
              Запросить
            </button>
          )}
        </div>
        <div class="btn-row">
          <button type="button" class="btn secondary" onClick={() => void onExport()}>
            <Icon name="share" size={18} /> Экспорт JSON
          </button>
          <button type="button" class="btn secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> Импорт
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImportFile(e)}
            data-testid="import-input"
          />
        </div>
        <button type="button" class="btn danger-ghost block" onClick={() => void onReset()}>
          <Icon name="trash" size={18} /> Сбросить все данные
        </button>
      </section>

      {(showIosInstall || installPrompt.value || installed.value) && (
        <section class="card group-card">
          <h2 class="card-t">Установка</h2>
          {installed.value || isStandalone() ? (
            <p class="muted small">Приложение установлено ✓</p>
          ) : installPrompt.value ? (
            <button type="button" class="btn primary" onClick={() => void promptInstall()}>
              <Icon name="download" size={18} /> Установить приложение
            </button>
          ) : (
            <IosInstallSteps />
          )}
        </section>
      )}

      <section class="card group-card">
        <h2 class="card-t">О приложении</h2>
        <p class="muted small">
          Версия {__APP_VERSION__} · работает офлайн · данные хранятся только на этом устройстве
        </p>
        <details class="changelog">
          <summary>Что нового</summary>
          <pre>{changelog.replace(/^# .*\n+/, '')}</pre>
        </details>
      </section>
    </div>
  );
}
