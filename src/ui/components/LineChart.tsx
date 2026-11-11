import { fmtNum, fmtShortDate } from '../../lib/format';

export interface Series {
  name: string;
  cls: string;
  values: number[];
}

interface Props {
  dates: number[];
  series: Series[];
  unit: string;
  label: string;
}

/** Лёгкий SVG-график без библиотек */
export function LineChart({ dates, series, unit, label }: Props) {
  const W = 340;
  const H = 180;
  const P = { l: 36, r: 12, t: 12, b: 26 };
  const all = series.flatMap((s) => s.values);
  if (!dates.length || !all.length) return null;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 1) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  min = Math.max(0, min - pad);
  max += pad;
  const x = (i: number) =>
    dates.length === 1 ? (P.l + W - P.r) / 2 : P.l + (i / (dates.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const ticks = [min, (min + max) / 2, max];
  const labelIdx =
    dates.length <= 4 ? dates.map((_, i) => i) : [0, Math.floor((dates.length - 1) / 2), dates.length - 1];

  return (
    <figure class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line class="grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} />
            <text class="ax" x={P.l - 6} y={y(t) + 4} text-anchor="end">
              {fmtNum(Math.round(t))}
            </text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} class="ax" x={x(i)} y={H - 6} text-anchor="middle">
            {fmtShortDate(dates[i]!)}
          </text>
        ))}
        {series.map((s) => (
          <g key={s.name} class={s.cls}>
            {s.values.length > 1 && <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />}
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3.5}>
                <title>
                  {fmtShortDate(dates[i]!)}: {fmtNum(v)} {unit}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <figcaption class="legend">
        {series.map((s) => (
          <span key={s.name} class={'lg ' + s.cls}>
            <i />
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
