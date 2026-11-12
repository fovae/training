import { t } from '../../i18n';
import { THEME_OPTIONS, themeData } from '../../themes';
import type { ThemeId } from '../../types';

/** Превью: фон, карточка, полоска текста и 7 цветов дней темы */
function Swatch({ id }: { id: Exclude<ThemeId, 'auto'> }) {
  const d = themeData(id);
  return (
    <span class="tp-sw" style={{ background: d.bg }} aria-hidden="true">
      <span class="tp-card" style={{ background: d.card }}>
        <span
          class="tp-head"
          style={{
            background: d.days[0]!.fill2
              ? `linear-gradient(135deg,${d.days[0]!.fill},${d.days[0]!.fill2})`
              : d.days[0]!.fill,
          }}
        />
        <span class="tp-line" style={{ background: d.ink }} />
        <span class="tp-dots">
          {d.days.map((x, i) => (
            <i key={i} style={{ background: x.fill }} />
          ))}
        </span>
      </span>
    </span>
  );
}

export function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (v: ThemeId) => void }) {
  return (
    <div class="theme-grid" role="radiogroup" aria-label={t('settings.theme')}>
      {THEME_OPTIONS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          class={'tp' + (value === id ? ' on' : '')}
          onClick={() => onChange(id)}
        >
          {id === 'auto' ? (
            <span class="tp-auto">
              <Swatch id="classic-light" />
              <Swatch id="classic-dark" />
            </span>
          ) : (
            <Swatch id={id} />
          )}
          <span class="tp-name">{t(`theme.${id}`)}</span>
        </button>
      ))}
    </div>
  );
}
