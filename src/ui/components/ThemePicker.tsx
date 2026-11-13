import { t } from '../../i18n';
import { THEME_OPTIONS, themeData } from '../../themes';
import type { ThemeId } from '../../types';
import { Icon } from './Icon';

/**
 * Мини-образец темы из её цветов: фон, поверхность (карточка), главная карточка с градиентом,
 * строка текста и два акцента.
 */
function Swatch({ id }: { id: Exclude<ThemeId, 'auto'> }) {
  const d = themeData(id);
  return (
    <span class="tp-sw" style={{ background: d.bg }} aria-hidden="true">
      <span class="tp-card" style={{ background: d.card }}>
        <span class="tp-head" style={{ background: `linear-gradient(135deg,${d.head[0]},${d.head[1]})` }} />
        <span class="tp-row">
          <span class="tp-line" style={{ background: d.ink }} />
          <span class="tp-dots">
            <i style={{ background: d.acc[0] }} />
            <i style={{ background: d.acc[1] }} />
          </span>
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
          data-theme-id={id}
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
          <span class="tp-check" aria-hidden="true">
            <Icon name="check" size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}
