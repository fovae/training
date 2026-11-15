import { useState } from 'preact/hooks';
import { picMarkup } from '../../data/exercises';
import { t } from '../../i18n';

/**
 * Схема движения. Разметка статична и генерируется из src/pics — безопасна для innerHTML.
 * В статике: начальная поза бледная, конечная — яркая (как всегда).
 * live — по нажатию позы плавно меняются местами (перекрёстное затухание);
 * auto — ещё и сами медленно перетекают туда-обратно (только на открытой карточке упражнения).
 */
export function Pic({ pic, live, auto }: { pic?: string | undefined; live?: boolean; auto?: boolean }) {
  const [swap, setSwap] = useState(false);
  const html = pic ? picMarkup(pic) : null;
  if (!html) return null;
  if (!live) return <div class="pic" dangerouslySetInnerHTML={{ __html: html }} />;
  // Значок касания в углу: схема живая — по нажатию позы меняются местами. Сама схема — в обёртке
  // display: contents (раскладка .pic та же), значок — иконка маской в цвете акцента темы.
  return (
    <button
      type="button"
      class={'pic pic-live' + (swap ? ' swap' : '') + (auto && !swap ? ' auto' : '')}
      aria-label={t('pic.swap')}
      aria-pressed={swap}
      onClick={() => setSwap(!swap)}
    >
      <span class="pic-art" dangerouslySetInnerHTML={{ __html: html }} />
      <span class="pic-tap" aria-hidden="true" />
    </button>
  );
}
