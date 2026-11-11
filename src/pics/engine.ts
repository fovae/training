/**
 * Генератор SVG-схем движений. Порт функций side/front/picSvg из исходной одностраничной версии
 * без изменения геометрии — только типы.
 */

export type Pt = [number, number];
/** Гантель: [x, y] — горизонтальная, [x, y, 'v'] — вертикальная, [x, y, 'h'] — горизонтальная */
export type Dumbbell = [number, number] | [number, number, 'v' | 'h'];

export interface SideJoints {
  h: Pt; // голова
  s: Pt; // плечо
  hp: Pt; // таз
  e: Pt; // локоть
  w: Pt; // кисть
  k: Pt; // колено
  f: Pt; // стопа
  t?: Pt; // носок
  hd?: Pt; // рукоять/кисть дальше запястья
  k2?: Pt;
  f2?: Pt;
  t2?: Pt;
  e2?: Pt;
  w2?: Pt;
  db?: Dumbbell[];
}

export interface Pose {
  h: Pt;
  c: Pt[][];
  far: Pt[][];
  w: Pt;
  db: Dumbbell[] | null | undefined;
  j: Partial<Record<string, Pt>>;
}

export interface PicDef {
  env?: string;
  cable?: Pt;
  cableTo?: string;
  mv?: string;
  noArrow?: 0 | 1;
  poses: [Pose] | [Pose, Pose];
}

export function side(p: SideJoints): Pose {
  const c: Pt[][] = [[p.s, p.hp]];
  const leg: Pt[] = [p.hp, p.k, p.f];
  if (p.t) leg.push(p.t);
  c.push(leg);
  const arm: Pt[] = [p.s, p.e, p.w];
  if (p.hd) arm.push(p.hd);
  c.push(arm);
  const far: Pt[][] = [];
  if (p.k2 && p.f2) far.push([p.hp, p.k2, p.f2, ...(p.t2 ? [p.t2] : [])]);
  if (p.e2 && p.w2) far.push([p.s, p.e2, p.w2]);
  return { h: p.h, c, far, w: p.hd ?? p.w, db: p.db, j: p as unknown as Record<string, Pt> };
}

interface FrontOpts {
  sy?: number;
  arm: Pt[];
  seated?: 1;
  db?: 'h' | 'v';
}

export function front(o: FrontOpts): Pose {
  const sy = o.sy ?? 46;
  const m = (q: Pt): Pt => [200 - q[0], q[1]];
  const sL: Pt = [84, sy];
  const sR: Pt = [116, sy];
  const hL: Pt = [92, 88];
  const hR: Pt = [108, 88];
  const legL: Pt[] = o.seated ? [hL, [84, 102], [84, 124]] : [hL, [90, 107], [89, 125]];
  const c: Pt[][] = [
    [
      [100, 40],
      [100, 88],
    ],
    [sL, sR],
    [hL, hR],
    [sL, ...o.arm],
    [sR, ...o.arm.map(m)],
    legL,
    legL.map(m),
  ];
  const w = o.arm[o.arm.length - 1]!;
  return {
    h: [100, 27],
    c,
    far: [],
    w,
    db: o.db
      ? [
          [w[0], w[1], o.db],
          [m(w)[0], m(w)[1], o.db],
        ]
      : null,
    j: { w, w2: m(w) },
  };
}

const line = (pts: Pt[]): string => `<polyline points="${pts.map((q) => q.join(',')).join(' ')}"/>`;

function dbSvg(x: number, y: number, o?: 'v' | 'h'): string {
  return o === 'v'
    ? `<g class="db"><line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}"/><rect x="${x - 5}" y="${y - 11}" width="10" height="5" rx="1.5"/><rect x="${x - 5}" y="${y + 6}" width="10" height="5" rx="1.5"/></g>`
    : `<g class="db"><line x1="${x - 8}" y1="${y}" x2="${x + 8}" y2="${y}"/><rect x="${x - 11}" y="${y - 5}" width="5" height="10" rx="1.5"/><rect x="${x + 6}" y="${y - 5}" width="5" height="10" rx="1.5"/></g>`;
}

function poseSvg(P: Pose, ghost: boolean): string {
  let s = `<g class="${ghost ? 'ghost' : 'solid'}">`;
  P.far.forEach((ch) => (s += `<g class="far">${line(ch)}</g>`));
  P.c.forEach((ch) => (s += line(ch)));
  s += `<circle cx="${P.h[0]}" cy="${P.h[1]}" r="8.5"/>`;
  (P.db ?? []).forEach((d) => (s += dbSvg(d[0], d[1], d[2])));
  return s + '</g>';
}

export function picSvg(def: PicDef): string {
  const [A, B] = def.poses;
  let cab = '';
  if (def.cable) {
    const cable = def.cable;
    [A, B].forEach((P, i) => {
      if (!P) return;
      const w = (def.cableTo ? P.j[def.cableTo] : undefined) ?? P.w;
      cab += `<line class="cable ${i ? '' : 'g'}" x1="${cable[0]}" y1="${cable[1]}" x2="${w[0]}" y2="${w[1]}"/>`;
    });
  }
  let mv = '';
  if (B && !def.noArrow) {
    const a = (def.mv ? A.j[def.mv] : undefined) ?? A.w;
    const b = (def.mv ? B.j[def.mv] : undefined) ?? B.w;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    if (L > 10) {
      const ux = dx / L;
      const uy = dy / L;
      const sx = a[0] + ux * 8;
      const sy = a[1] + uy * 8;
      const ex = b[0] - ux * 10;
      const ey = b[1] - uy * 10;
      mv = `<line class="mv" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" marker-end="url(#ah)"/>`;
    }
  }
  return `<svg viewBox="0 0 200 135" role="img" aria-hidden="true" focusable="false"><defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="ahp"/></marker></defs>
  <line class="floor" x1="8" y1="127" x2="192" y2="127"/>
  <g class="eq">${def.env ?? ''}</g>${cab}${B ? poseSvg(A, true) : ''}${mv}${poseSvg(B ?? A, false)}</svg>`;
}

export const bench = (x1: number, y1: number, x2: number, y2: number, legs = true): string =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="pad"/>` +
  (legs ? `<line x1="${(x1 + x2) / 2}" y1="${Math.max(y1, y2)}" x2="${(x1 + x2) / 2}" y2="127"/>` : '');

export const column = (x: number): string =>
  `<line x1="${x}" y1="6" x2="${x}" y2="127"/><line x1="${x}" y1="8" x2="${x - 14}" y2="8"/>`;
