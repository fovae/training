import type { PicDef, Pose } from '../engine';
import { band, body, env, facing, frontLegs, plate, shiftFront, withProps } from '../kit';

/** Партия 2 (этап 3А): ноги. Позы — по углам суставов, см. src/pics/kit.ts */

type Hold = 'bb' | 'db' | 'dbv' | 'kb';

/** Валик тренажёра у голеностопа */
const roller = (p: [number, number]) =>
  `<g class="kb"><rect x="${p[0] - 5}" y="${p[1] - 2}" width="10" height="10" rx="5"/></g>`;

const stand = (arm: [number, number], hold?: Hold, x = 100, torso = 180): Pose =>
  body({ at: [x, 125], root: 'foot', torso, leg: [0, 0, 90], arm, ...(hold ? { hold } : {}) });
/** Присед: глубина задаётся углом бедра (≈80 — параллель) */
const squat = (arm: [number, number], hold?: Hold, torso = 150, thigh = 80, x = 104): Pose =>
  body({
    at: [x, 125],
    root: 'foot',
    torso,
    head: torso + 12,
    leg: [thigh, -28, 90],
    arm,
    ...(hold ? { hold } : {}),
  });

// Штанга на спине (руки держат гриф у плеч), штанга спереди (на плечах, локти вперёд), гиря у груди
const BACK: [number, number] = [-28, 166];
const FRONT: [number, number] = [96, -118];
const GOBLET: [number, number] = [20, 164];

// Лунка: передняя нога согнута, задняя опущена коленом к полу
const lunge = (x: number): Pose =>
  body({
    at: [x, 125],
    root: 'foot',
    torso: 178,
    leg: [84, 0, 90],
    leg2: [-12, -84, 180],
    arm: [0, 0],
    hold: 'dbv',
  });

export const PICS_B2 = {
  back_squat: {
    env: env.rack(40, 40),
    mv: 'hp',
    poses: [stand(BACK, 'bb'), squat(BACK, 'bb', 146)],
  },
  front_squat: {
    env: env.rack(40, 40),
    mv: 'hp',
    poses: [stand(FRONT, 'bb'), squat(FRONT, 'bb', 164, 82)],
  },
  goblet_squat: {
    env: '',
    mv: 'hp',
    poses: [stand(GOBLET, 'kb'), squat(GOBLET, 'kb', 160, 86)],
  },
  sumo_squat: {
    env: '',
    mv: 'hp',
    poses: [stand([0, 0], 'dbv'), squat([0, 0], 'dbv', 166, 80, 106)],
  },
  bulgarian_split_squat: {
    env: env.flat(26, 66, 96),
    mv: 'hp',
    poses: [
      body({
        at: [120, 125],
        root: 'foot',
        torso: 176,
        leg: [16, -6, 90],
        foot2At: [52, 90],
        leg2: [0, 0, -100],
        arm: [0, 0],
        hold: 'dbv',
      }),
      body({
        at: [120, 125],
        root: 'foot',
        torso: 172,
        leg: [82, -10, 90],
        foot2At: [52, 90],
        leg2: [0, 0, -100],
        arm: [0, 0],
        hold: 'dbv',
        legBend: -1,
      }),
    ],
  },
  lunge: {
    env: '',
    mv: 'hp',
    poses: [stand([0, 0], 'dbv', 112), lunge(124)],
  },
  walking_lunge: {
    env: '',
    mv: 'hp',
    poses: [lunge(76), lunge(150)],
  },
  leg_extension: {
    env: env.seat(70, 112, 98) + env.pad(70, 56, 70, 96),
    mv: 'f',
    poses: [
      body({ at: [84, 92], torso: 186, arm: [10, 60], leg: [90, 2] }),
      body({ at: [84, 92], torso: 186, arm: [10, 60], leg: [90, 84] }),
    ].map((P) => withProps(P, (j) => roller(j.f!))) as [Pose, Pose],
  },
  seated_leg_curl: {
    env: env.seat(70, 112, 98) + env.pad(70, 56, 70, 96) + env.pad(100, 84, 116, 84),
    mv: 'f',
    poses: [
      body({ at: [84, 92], torso: 186, arm: [10, 60], leg: [90, 88] }),
      body({ at: [84, 92], torso: 186, arm: [10, 60], leg: [90, -8] }),
    ],
  },
  glute_bridge: {
    env: env.mat(30, 170),
    mv: 'hp',
    poses: [
      body({
        at: [62, 118],
        root: 'shoulder',
        torso: -90,
        head: -92,
        arm: [86, 90],
        leg: [0, 0],
        footAt: [130, 120],
        legBend: -1,
      }),
      body({
        at: [62, 118],
        root: 'shoulder',
        torso: -62,
        head: -78,
        arm: [86, 90],
        leg: [0, 0],
        footAt: [130, 120],
        legBend: -1,
      }),
    ],
  },
  hip_thrust: {
    env: env.flat(30, 70, 98),
    mv: 'hp',
    poses: [
      withProps(
        body({
          at: [66, 90],
          root: 'shoulder',
          torso: -132,
          head: -116,
          arm: [0, 0],
          leg: [0, 0],
          footAt: [140, 124],
          legBend: -1,
        }),
        (j) => plate([j.hp![0], j.hp![1] - 10]),
        true,
      ),
      withProps(
        body({
          at: [66, 90],
          root: 'shoulder',
          torso: -90,
          head: -100,
          arm: [0, 0],
          leg: [0, 0],
          footAt: [140, 124],
          legBend: -1,
        }),
        (j) => plate([j.hp![0], j.hp![1] - 10]),
        true,
      ),
    ].map((P) => {
      // Руки держат гриф на тазу
      const hp = P.j.hp!;
      const s = P.j.s!;
      P.c[2] = [s, [(s[0] + hp[0]) / 2, hp[1] - 4], [hp[0], hp[1] - 10]];
      return P;
    }) as [Pose, Pose],
  },
  seated_calf_raise: {
    env:
      env.seat(60, 100, 98) +
      env.pad(100, 84, 124, 84) +
      `<rect x="114" y="120" width="26" height="7" rx="2" class="padfill"/>`,
    mv: 'k',
    noArrow: 1,
    poses: [
      body({ at: [80, 92], torso: 180, arm: [40, 120], leg: [88, 0, 90], footAt: [124, 118], legBend: -1 }),
      body({ at: [80, 92], torso: 180, arm: [40, 120], leg: [82, 0, 130], footAt: [124, 112], legBend: -1 }),
    ],
  },
  step_up: {
    env: env.box(108, 52, 24),
    mv: 'hp',
    poses: [
      body({
        at: [92, 125],
        root: 'foot',
        torso: 172,
        leg: [8, -4, 90],
        foot2At: [122, 102],
        leg2: [0, 0, 90],
        arm: [0, 0],
        hold: 'dbv',
        legBend: -1,
        scale: 0.9,
      }),
      body({
        at: [124, 102],
        root: 'foot',
        torso: 180,
        leg: [0, 0, 90],
        leg2: [-8, 20, 90],
        arm: [0, 0],
        hold: 'dbv',
        scale: 0.9,
      }),
    ],
  },
  hip_adduction: {
    env: `<line x1="66" y1="100" x2="134" y2="100" class="pad"/>`,
    noArrow: 1,
    poses: [
      frontLegs(facing({ arm: [24, 10], seated: true }), [66, 98], [62, 122]),
      frontLegs(facing({ arm: [24, 10], seated: true }), [94, 102], [92, 124]),
    ],
  },
  hip_abduction: {
    env: `<line x1="66" y1="100" x2="134" y2="100" class="pad"/>`,
    noArrow: 1,
    poses: [
      frontLegs(facing({ arm: [24, 10], seated: true }), [94, 102], [92, 124]),
      frontLegs(facing({ arm: [24, 10], seated: true }), [66, 98], [62, 122]),
    ],
  },
  hack_squat: {
    env: `<line x1="76" y1="30" x2="102" y2="118" class="pad"/><line x1="108" y1="126" x2="146" y2="116" class="pad"/>`,
    mv: 'hp',
    poses: [
      body({
        at: [106, 78],
        torso: 196,
        head: 196,
        arm: [-30, 160],
        leg: [0, 0],
        footAt: [124, 120],
        legBend: -1,
      }),
      body({
        at: [113, 100],
        torso: 196,
        head: 196,
        arm: [-30, 160],
        leg: [0, 0],
        footAt: [124, 120],
        legBend: -1,
      }),
    ],
  },
  db_rdl: {
    env: '',
    poses: [
      body({ at: [92, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [0, 0], hold: 'dbv' }),
      body({
        at: [92, 125],
        root: 'foot',
        torso: 124,
        head: 116,
        leg: [40, 0, 90],
        arm: [0, 0],
        hold: 'dbv',
      }),
    ],
  },
  single_leg_rdl: {
    env: '',
    poses: [
      body({
        at: [104, 125],
        root: 'foot',
        torso: 180,
        leg: [0, 0, 90],
        leg2: [-10, -14],
        arm: [0, 0],
        hold: 'dbv',
      }),
      body({
        at: [104, 125],
        root: 'foot',
        torso: 100,
        head: 96,
        leg: [16, 0, 90],
        leg2: [-80, -82],
        arm: [0, 0],
        hold: 'dbv',
      }),
    ],
  },
  wall_sit: {
    env: env.wall(54),
    mv: 'hp',
    poses: [
      body({ at: [62, 79], torso: 180, arm: [0, 0], leg: [0, 0], footAt: [80, 125], legBend: -1 }),
      body({ at: [62, 103], torso: 180, arm: [8, 40], leg: [90, 0, 90] }),
    ],
  },
  lateral_band_walk: {
    env: '',
    noArrow: 1,
    poses: [
      withProps(frontLegs(shiftFront(facing({ arm: [8, 20] }), 8), [88, 110], [90, 125], [92, 96]), () =>
        band([88, 110], [112, 110]),
      ),
      withProps(frontLegs(shiftFront(facing({ arm: [8, 20] }), 8), [78, 110], [70, 125], [92, 96]), () =>
        band([78, 110], [122, 110]),
      ),
    ],
  },
  cable_kickback: {
    env: env.lowColumn(176),
    cable: [166, 118],
    cableTo: 'f',
    mv: 'f',
    poses: [
      body({
        at: [106, 125],
        root: 'foot2',
        torso: 168,
        leg: [6, 0],
        leg2: [0, 0, 90],
        handAt: [150, 70],
        arm: [90, 90],
      }),
      body({
        at: [106, 125],
        root: 'foot2',
        torso: 160,
        leg: [-38, -28],
        leg2: [0, 0, 90],
        handAt: [150, 70],
        arm: [90, 90],
      }),
    ],
  },
} satisfies Record<string, PicDef>;
