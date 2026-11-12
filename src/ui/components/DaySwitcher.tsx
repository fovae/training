import { t, weekdayShort } from '../../i18n';
import { dayColor, planDays, shownWeekday } from '../../state/plan';

interface Props {
  value: string | null;
  onChange: (id: string) => void;
  /** Отметка «предложено на сегодня» */
  suggested?: string | null | undefined;
  disabled?: boolean;
  label?: string;
}

/** Сегментированный контрол «День 1…N» (до 7 дней) */
export function DaySwitcher({ value, onChange, suggested, disabled, label }: Props) {
  const days = planDays.value;
  return (
    <div
      class={'seg' + (days.length > 4 ? ' many' : '')}
      role="tablist"
      aria-label={label ?? t('today.pickDay')}
    >
      {days.map((d, i) => {
        const on = d.id === value;
        const c = dayColor(d.id);
        const w = shownWeekday(d);
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={t('day.n', { n: i + 1 }) + (w != null ? `, ${weekdayShort(w)}` : '')}
            disabled={disabled && !on}
            class={'seg-btn' + (on ? ' on' : '')}
            style={{ '--dc': `var(--${c})`, '--dcf': `var(--${c}-fill)` }}
            onClick={() => onChange(d.id)}
          >
            <span class="seg-num" aria-hidden="true">
              {w != null ? weekdayShort(w) : days.length > 4 ? i + 1 : t('day.n', { n: i + 1 })}
            </span>
            {suggested === d.id && <span class="seg-dot" aria-label={t('today.suggestedMark')} />}
          </button>
        );
      })}
    </div>
  );
}

export const shiftDay = (id: string | null, dir: 1 | -1): string | null => {
  const days = planDays.value;
  if (!days.length) return null;
  const i = Math.max(
    0,
    days.findIndex((d) => d.id === id),
  );
  return days[(i + dir + days.length) % days.length]!.id;
};
