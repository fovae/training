import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import { fmtClock } from '../../lib/format';
import { Icon } from './Icon';

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
  mini = true,
}: {
  value: T | null;
  options: { v: T; t: string }[];
  onChange: (v: T) => void;
  label: string;
  mini?: boolean;
}) {
  return (
    <div class={'seg' + (mini ? ' mini' : '')} role="radiogroup" aria-label={label}>
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

export function Toggle({
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

/** Степпер: по умолчанию время (15 с шаг), с format — любое число */
export function Stepper({
  value,
  onChange,
  label,
  min = 15,
  max = 600,
  step = 15,
  format = fmtClock,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={t('common.decrease', { what: label })}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite">{format(value)}</output>
      <button
        type="button"
        aria-label={t('common.increase', { what: label })}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

/** Поле формы с подписью, подсказкой и ошибкой */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  children: ComponentChildren;
}) {
  return (
    <div class={'field' + (error ? ' invalid' : '')}>
      <label for={id}>{label}</label>
      {children}
      {error ? (
        <small class="field-err" id={id + '-err'} role="alert">
          {error}
        </small>
      ) : hint ? (
        <small id={id + '-hint'}>{hint}</small>
      ) : null}
    </div>
  );
}

/** Выбор одного варианта крупными карточками (онбординг, шаблоны) */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { v: T; t: string; d?: string | undefined }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="choices" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          class={'choice' + (value === o.v ? ' on' : '')}
          onClick={() => onChange(o.v)}
        >
          <span class="choice-dot" aria-hidden="true" />
          <span class="choice-txt">
            <b>{o.t}</b>
            {o.d && <span>{o.d}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
