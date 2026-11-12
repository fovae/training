import { fmtNum, t } from '../../i18n';

interface Props {
  /** Подписи столбцов (даты недель) */
  labels: string[];
  values: number[];
  /** Подпись графика для экранного диктора и таблицы */
  label: string;
  unit?: string;
}

/**
 * Лёгкий столбчатый SVG-график без библиотек. Цвета — из темы (--chart-1).
 * Доступная альтернатива: подпись с ключевыми значениями и таблица под спойлером.
 */
export function BarChart({ labels, values, label, unit = '' }: Props) {
  const W = 340;
  const H = 150;
  const P = { l: 8, r: 8, t: 14, b: 22 };
  const max = Math.max(1, ...values);
  const n = values.length;
  const bw = (W - P.l - P.r) / n;
  const total = values.reduce((a, b) => a + b, 0);
  const avg = n ? total / n : 0;
  const last = values[n - 1] ?? 0;
  const show = (i: number) => n <= 6 || i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2);

  return (
    <figure class="chart bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <line class="ax" x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} />
        {values.map((v, i) => {
          const h = (v / max) * (H - P.t - P.b);
          const x = P.l + i * bw + bw * 0.18;
          return (
            <g key={i}>
              <rect
                class="bar"
                x={x}
                y={H - P.b - h}
                width={bw * 0.64}
                height={Math.max(h, v > 0 ? 2 : 0)}
                rx="3"
              />
              {v > 0 && (
                <text class="bar-v" x={x + bw * 0.32} y={H - P.b - h - 3} text-anchor="middle">
                  {fmtNum(v)}
                </text>
              )}
              {show(i) && (
                <text class="ax-l" x={x + bw * 0.32} y={H - 6} text-anchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption class="muted small">
        {t('stats.caption', {
          last: `${fmtNum(last)}${unit}`,
          avg: `${fmtNum(Math.round(avg * 10) / 10)}${unit}`,
        })}
      </figcaption>
      <details class="chart-table">
        <summary>{t('stats.asTable')}</summary>
        <table>
          <caption class="sr-only">{label}</caption>
          <tbody>
            {values.map((v, i) => (
              <tr key={i}>
                <th scope="row">{labels[i]}</th>
                <td>
                  {fmtNum(v)}
                  {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
