import {
  bench as benchLine,
  column as columnLine,
  front,
  side,
  type Dumbbell,
  type Pose,
  type Pt,
} from './engine';

/**
 * Генератор «скелета» по углам суставов + набор реквизита (этап 3А).
 *
 * Стиль тот же, что у исходных схем (engine.ts): холст 200×135, пол на y = 127, линии 7 px,
 * голова r = 8.5, реквизит — серый (.eq), снаряд в руках — цвет текста (.db, .bb, .kb).
 * Исходные 25 схем (defs.ts) не перерисованы: они заданы точками и рисуются тем же движком.
 *
 * Углы — в градусах, абсолютные (не относительно соседнего сегмента):
 *   0 — вниз, 90 — вправо (вперёд: фигура смотрит вправо), 180 — вверх, -90 — влево (назад).
 */

/** Длины сегментов. Подобраны под пропорции исходных схем. */
export const SEG = { torso: 40, neck: 14, upper: 22, fore: 21, thigh: 24, shin: 22, foot: 10 } as const;

const R = Math.PI / 180;
const r1 = (n: number) => Math.round(n * 10) / 10;
export const go = (p: Pt, deg: number, len: number): Pt => [
  r1(p[0] + Math.sin(deg * R) * len),
  r1(p[1] + Math.cos(deg * R) * len),
];

/** Что в руках (рисуется у кисти) */
export type Hold =
  | 'db' // гантель горизонтально (вид сбоку)
  | 'dbv' // гантель вертикально
  | 'bb' // штанга, вид с торца: блин вокруг кисти
  | 'kb' // гиря под кистью
  | 'handle'; // рукоять блока — без рисунка, только точка для троса

export interface BodySpec {
  /** Куда поставить опорную точку */
  at: Pt;
  /** Опорная точка (по умолчанию таз) */
  root?: 'hip' | 'foot' | 'hand' | 'shoulder' | 'knee' | 'head' | 'foot2' | 'hand2';
  /** Таз → плечи (180 — стоя прямо) */
  torso: number;
  /** Плечи → голова; по умолчанию как торс */
  head?: number;
  /** [плечо, предплечье] ближней руки */
  arm: [number, number];
  /** Дальняя рука (бледнее). Не задана — совпадает с ближней и не рисуется */
  arm2?: [number, number];
  /** [бедро, голень, стопа?] ближней ноги; стопа — угол носка (90 — носок вперёд) */
  leg: [number, number, number?];
  leg2?: [number, number, number?];
  hold?: Hold;
  /** Снаряд в дальней руке (для гантелей в двух руках обычно хватает одной) */
  hold2?: Hold;
  /** Дальнюю ногу рисовать даже если совпадает с ближней */
  showLeg2?: boolean;
  /**
   * Конечность тянется к точке (гриф, пол, рукоять): углы считаются сами (две кости, закон
   * косинусов). bend: 1 / -1 — в какую сторону сгибается сустав. Применяется после переноса в at.
   */
  handAt?: Pt;
  hand2At?: Pt;
  footAt?: Pt;
  foot2At?: Pt;
  armBend?: 1 | -1;
  legBend?: 1 | -1;
  /** Масштаб длин (фигура в висе на турнике не помещается в кадр в полный рост) */
  scale?: number;
}

/** Две кости от a к b: возвращает [сустав, конец]. Не дотягивается — прямая в сторону цели. */
export function ik(a: Pt, b: Pt, l1: number, l2: number, bend: 1 | -1): [Pt, Pt] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const ux = dx / d;
  const uy = dy / d;
  if (d >= l1 + l2) {
    const j: Pt = [r1(a[0] + ux * l1), r1(a[1] + uy * l1)];
    return [j, [r1(a[0] + ux * (l1 + l2)), r1(a[1] + uy * (l1 + l2))]];
  }
  const cos = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const ang = Math.acos(cos) * bend;
  const rx = ux * Math.cos(ang) - uy * Math.sin(ang);
  const ry = ux * Math.sin(ang) + uy * Math.cos(ang);
  return [
    [r1(a[0] + rx * l1), r1(a[1] + ry * l1)],
    [r1(b[0]), r1(b[1])],
  ];
}

interface Joints {
  h: Pt;
  s: Pt;
  hp: Pt;
  e: Pt;
  w: Pt;
  k: Pt;
  f: Pt;
  t?: Pt;
  e2?: Pt;
  w2?: Pt;
  k2?: Pt;
  f2?: Pt;
  t2?: Pt;
}

function joints(b: BodySpec): Joints {
  const k0 = b.scale ?? 1;
  const L = {
    torso: SEG.torso * k0,
    neck: SEG.neck * Math.min(1, k0 + 0.1),
    upper: SEG.upper * k0,
    fore: SEG.fore * k0,
    thigh: SEG.thigh * k0,
    shin: SEG.shin * k0,
    foot: SEG.foot * k0,
  };
  const hp: Pt = [0, 0];
  const s = go(hp, b.torso, L.torso);
  const h = go(s, b.head ?? b.torso, L.neck);
  const e = go(s, b.arm[0], L.upper);
  const w = go(e, b.arm[1], L.fore);
  const k = go(hp, b.leg[0], L.thigh);
  const f = go(k, b.leg[1], L.shin);
  const j: Joints = { h, s, hp, e, w, k, f };
  if (b.leg[2] != null) j.t = go(f, b.leg[2], L.foot);
  if (b.arm2 || b.hand2At) {
    const a2 = b.arm2 ?? b.arm;
    j.e2 = go(s, a2[0], L.upper);
    j.w2 = go(j.e2, a2[1], L.fore);
  }
  if (b.leg2 || b.foot2At) {
    const l2 = b.leg2 ?? b.leg;
    j.k2 = go(hp, l2[0], L.thigh);
    j.f2 = go(j.k2, l2[1], L.shin);
    if (l2[2] != null) j.t2 = go(j.f2, l2[2], L.foot);
  }
  // Сдвиг: опорная точка — в b.at
  const rootKey = (
    {
      hip: 'hp',
      foot: 'f',
      hand: 'w',
      shoulder: 's',
      knee: 'k',
      head: 'h',
      foot2: 'f2',
      hand2: 'w2',
    } as const
  )[b.root ?? 'hip'];
  const root = j[rootKey] ?? hp;
  const dx = b.at[0] - root[0];
  const dy = b.at[1] - root[1];
  for (const key of Object.keys(j) as (keyof Joints)[]) {
    const p = j[key];
    if (p) j[key] = [r1(p[0] + dx), r1(p[1] + dy)];
  }
  // Конечности, привязанные к точкам
  const ab = b.armBend ?? 1;
  const lb = b.legBend ?? -1;
  if (b.handAt) [j.e, j.w] = ik(j.s, b.handAt, L.upper, L.fore, ab);
  if (b.hand2At) [j.e2, j.w2] = ik(j.s, b.hand2At, L.upper, L.fore, ab);
  if (b.footAt) {
    [j.k, j.f] = ik(j.hp, b.footAt, L.thigh, L.shin, lb);
    if (b.leg[2] != null) j.t = go(j.f, b.leg[2], L.foot);
  }
  if (b.foot2At) {
    [j.k2, j.f2] = ik(j.hp, b.foot2At, L.thigh, L.shin, lb);
    if (b.leg2?.[2] != null) j.t2 = go(j.f2, b.leg2[2], L.foot);
  }
  return j;
}

// ---------- снаряд в руках ----------

/** Штанга с торца: блин вокруг кисти (рисуется под фигурой) */
export const plate = (p: Pt, r = 12): string =>
  `<g class="bb"><rect x="${r1(p[0] - r)}" y="${r1(p[1] - r)}" width="${2 * r}" height="${2 * r}" rx="${r}"/><rect class="hub" x="${r1(p[0] - 2.5)}" y="${r1(p[1] - 2.5)}" width="5" height="5" rx="2.5"/></g>`;

/** Гиря, подвешенная под кистью */
export const kettlebell = (p: Pt, down = true): string => {
  const cy = down ? p[1] + 9 : p[1] - 9;
  return `<g class="kb"><path d="M${r1(p[0] - 4)} ${r1(cy - 4)} Q${p[0]} ${r1(down ? p[1] - 3 : p[1] + 3)} ${r1(p[0] + 4)} ${r1(cy - 4)}"/><rect x="${r1(p[0] - 6.5)}" y="${r1(cy - 5)}" width="13" height="12" rx="6"/></g>`;
};

/** Гриф штанги спереди: перекладина через обе кисти и блины по краям */
export const barFront = (y: number, half = 46): string => {
  const a = 100 - half;
  const b = 100 + half;
  return `<g class="bbf"><line x1="${a - 10}" y1="${y}" x2="${b + 10}" y2="${y}"/><rect x="${a - 8}" y="${y - 11}" width="6" height="22" rx="2"/><rect x="${b + 2}" y="${y - 11}" width="6" height="22" rx="2"/></g>`;
};

function holdMarkup(hold: Hold | undefined, w: Pt): { db?: Dumbbell; props?: string; under?: string } {
  switch (hold) {
    case 'db':
      return { db: [w[0], w[1]] };
    case 'dbv':
      return { db: [w[0], w[1], 'v'] };
    case 'bb':
      return { under: plate(w) };
    case 'kb':
      return { props: kettlebell(w) };
    default:
      return {};
  }
}

/** Фигура сбоку по углам суставов */
export function body(b: BodySpec): Pose {
  const j = joints(b);
  const showArm2 = !!b.arm2 || !!b.hand2At;
  const showLeg2 = !!b.leg2 || !!b.foot2At || b.showLeg2;
  const P = side({
    h: j.h,
    s: j.s,
    hp: j.hp,
    e: j.e,
    w: j.w,
    k: j.k,
    f: j.f,
    ...(j.t ? { t: j.t } : {}),
    ...(showArm2 && j.e2 && j.w2 ? { e2: j.e2, w2: j.w2 } : {}),
    ...(showLeg2 && j.k2 && j.f2 ? { k2: j.k2, f2: j.f2, ...(j.t2 ? { t2: j.t2 } : {}) } : {}),
  });
  const dbs: Dumbbell[] = [];
  let props = '';
  let under = '';
  for (const [hold, w] of [
    [b.hold, j.w],
    [b.hold2, j.w2],
  ] as const) {
    if (!hold || !w) continue;
    const m = holdMarkup(hold, w);
    if (m.db) dbs.push(m.db);
    props += m.props ?? '';
    under += m.under ?? '';
  }
  P.db = dbs.length ? dbs : null;
  if (props) P.props = props;
  if (under) P.under = under;
  P.j = { ...j };
  return P;
}

/** Фигура спереди: угол руки 0 — вниз, 90 — в сторону, 180 — вверх (левая рука, правая зеркально) */
export function facing(o: {
  arm: [number, number];
  sy?: number;
  seated?: boolean;
  hold?: 'db' | 'dbv' | 'bar';
  /** Ноги шире (присед, стойка) */
  wide?: boolean;
}): Pose {
  const sy = o.sy ?? 46;
  const s: Pt = [84, sy];
  const e = go(s, -o.arm[0], SEG.upper);
  const w = go(e, -o.arm[1], SEG.fore);
  const P = front({
    sy,
    arm: [e, w],
    ...(o.seated ? { seated: 1 as const } : {}),
    ...(o.hold === 'db' || o.hold === 'dbv' ? { db: o.hold === 'db' ? ('h' as const) : ('v' as const) } : {}),
  });
  if (o.wide) {
    // Ноги шире плеч: перестраиваем обе ноги
    const hL: Pt = [92, 88];
    const legL: Pt[] = [hL, [80, 106], [74, 125]];
    P.c[5] = legL;
    P.c[6] = legL.map((q) => [200 - q[0], q[1]] as Pt);
  }
  if (o.hold === 'bar') P.props = barFront(w[1], 100 - w[0]);
  return P;
}

// ---------- реквизит окружения (серый) ----------

export const env = {
  /** Скамья: площадка от (x1,y1) до (x2,y2) + стойка (как в исходных схемах) */
  bench: benchLine,
  /** Плоская скамья на высоте y */
  flat: (x1: number, x2: number, y = 100): string => benchLine(x1, y, x2, y),
  /** Наклонная скамья: сиденье + спинка */
  incline: (seatX1: number, seatX2: number, seatY: number, backTop: Pt): string =>
    `<line x1="${seatX1}" y1="${seatY}" x2="${seatX2}" y2="${seatY}" class="pad"/><line x1="${seatX1}" y1="${seatY}" x2="${backTop[0]}" y2="${backTop[1]}" class="pad"/><line x1="${(seatX1 + seatX2) / 2}" y1="${seatY}" x2="${(seatX1 + seatX2) / 2}" y2="127"/>`,
  /** Мягкий валик / спинка тренажёра без ножек */
  pad: (x1: number, y1: number, x2: number, y2: number): string =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="pad"/>`,
  /** Сиденье тренажёра */
  seat: (x1: number, x2: number, y: number, post = true): string =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="pad"/>` +
    (post ? `<line x1="${(x1 + x2) / 2}" y1="${y}" x2="${(x1 + x2) / 2}" y2="127"/>` : ''),
  /** Силовая стойка: вертикаль + крюк на высоте hookY */
  rack: (x: number, hookY: number): string =>
    `<line x1="${x}" y1="10" x2="${x}" y2="127"/><line x1="${x}" y1="${hookY}" x2="${x + 8}" y2="${hookY}"/><line x1="${x}" y1="${hookY + 20}" x2="${x + 14}" y2="${hookY + 20}" class="bg"/>`,
  /** Турник: перекладина на y от x1 до x2, стойка у x1 */
  bar: (x1: number, x2: number, y = 8): string =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y}" x2="${x1}" y2="127"/>`,
  /** Брусья: рукоять на высоте y + стойка */
  dip: (x1: number, x2: number, y: number): string =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="pad"/><line x1="${x2 - 4}" y1="${y}" x2="${x2 - 4}" y2="127"/>`,
  /** Блок (как в исходных схемах) */
  column: columnLine,
  /** Нижний блок: стойка с роликом у пола */
  lowColumn: (x: number): string =>
    `<line x1="${x}" y1="20" x2="${x}" y2="127"/><line x1="${x}" y1="118" x2="${x + (x > 100 ? -10 : 10)}" y2="118"/>`,
  /** Коврик */
  mat: (x1: number, x2: number): string =>
    `<rect x="${x1}" y="122" width="${x2 - x1}" height="5" rx="2" class="padfill"/>`,
  /** Ящик / ступень */
  box: (x: number, w: number, h: number): string =>
    `<rect x="${x}" y="${127 - h}" width="${w}" height="${h}" rx="3"/>`,
  /** Стена */
  wall: (x: number): string => `<line x1="${x}" y1="6" x2="${x}" y2="127"/>`,
  /** Точка крепления резинки / блока на высоте y */
  anchor: (x: number, y: number): string =>
    `<line x1="${x}" y1="10" x2="${x}" y2="127" class="bg"/><rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="3" class="padfill"/>`,
  /** Гребной тренажёр: рельс + маховик спереди */
  rower: (x1: number, x2: number): string =>
    `<line x1="${x1}" y1="114" x2="${x2}" y2="114"/><line x1="${x1}" y1="114" x2="${x1}" y2="127"/><line x1="${x2 - 14}" y1="114" x2="${x2 - 14}" y2="127"/><rect x="${x2 - 8}" y="90" width="22" height="22" rx="11"/><line x1="${x2 - 22}" y1="98" x2="${x2 - 22}" y2="112" class="pad"/>`,
  /** Беговая дорожка: лента + стойка с поручнем */
  treadmill: (x1: number, x2: number): string =>
    `<rect x="${x1}" y="118" width="${x2 - x1}" height="7" rx="3"/><line x1="${x2 - 4}" y1="118" x2="${x2 + 8}" y2="56"/><line x1="${x2 + 8}" y1="56" x2="${x2 - 12}" y2="56" class="pad"/>`,
  /** Велотренажёр: рама, седло, руль */
  bike: (seat: Pt, bar: Pt, crank: Pt): string =>
    `<line x1="${seat[0]}" y1="${seat[1]}" x2="${crank[0]}" y2="${crank[1]}"/><line x1="${crank[0]}" y1="${crank[1]}" x2="${bar[0]}" y2="${bar[1]}"/><line x1="${seat[0] - 8}" y1="${seat[1]}" x2="${seat[0] + 8}" y2="${seat[1]}" class="pad"/><line x1="${crank[0] - 26}" y1="125" x2="${crank[0] + 34}" y2="125"/><line x1="${crank[0]}" y1="${crank[1]}" x2="${crank[0] - 18}" y2="125"/><line x1="${crank[0]}" y1="${crank[1]}" x2="${crank[0] + 24}" y2="125"/><rect x="${crank[0] - 7}" y="${crank[1] - 7}" width="14" height="14" rx="7"/>`,
};

/** Резинка от точки крепления до кисти (пунктир), для сцены */
export const band = (from: Pt, to: Pt): string =>
  `<line class="band" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/>`;

/** Скакалка: дуга от кисти через точку via (над головой или под стопами) к второй точке */
export const rope = (w: Pt, via: Pt, w2: Pt): string =>
  `<path class="rope" d="M${w[0]} ${w[1]} Q${w[0]} ${via[1]} ${via[0]} ${via[1]} Q${w2[0]} ${via[1]} ${w2[0]} ${w2[1]}"/>`;

/** Добавить к позе разметку, зависящую от суставов (рычаг Т-грифа, резинка, скакалка) */
export function withProps(P: Pose, fn: (j: Record<string, Pt>) => string, under = false): Pose {
  const m = fn(P.j as Record<string, Pt>);
  if (under) P.under = (P.under ?? '') + m;
  else P.props = (P.props ?? '') + m;
  return P;
}

/** Рычаг (Т-гриф, мина): от точки опоры к кисти */
export const lever = (from: Pt, to: Pt): string =>
  `<g class="bbf"><line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/></g>`;

/** Фигура спереди с произвольными ногами: колено и стопа левой ноги (правая — зеркально) */
export function frontLegs(P: Pose, knee: Pt, foot: Pt, hip: Pt = [92, 88]): Pose {
  const m = (q: Pt): Pt => [200 - q[0], q[1]];
  const legL: Pt[] = [hip, knee, foot];
  P.c[5] = legL;
  P.c[6] = legL.map(m);
  return P;
}

/** Опустить всю фигуру спереди на dy (полуприсед) — кроме ног, их задают отдельно */
export function shiftFront(P: Pose, dy: number): Pose {
  const sh = (q: Pt): Pt => [q[0], r1(q[1] + dy)];
  P.h = sh(P.h);
  P.c = P.c.map((ch, i) => (i >= 5 ? ch : ch.map(sh)));
  P.w = sh(P.w);
  if (P.db) P.db = P.db.map((d) => [d[0], r1(d[1] + dy), ...(d.length > 2 ? [d[2]] : [])] as Dumbbell);
  P.j = Object.fromEntries(Object.entries(P.j).map(([k, v]) => [k, v ? sh(v) : v]));
  return P;
}
