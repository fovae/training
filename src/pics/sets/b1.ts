import type { PicDef, Pose } from '../engine';
import { body, env, facing, lever, withProps } from '../kit';

/** Партия 1 (этап 3А): грудь и спина. Позы — по углам суставов, см. src/pics/kit.ts */

// Лёжа на плоской скамье, голова слева (жимы, пуловер, разводка)
const lying = (arm: [number, number], hold: 'bb' | 'db', arm2?: [number, number]): Pose =>
  body({
    at: [108, 90],
    torso: -90,
    head: -96,
    arm,
    ...(arm2 ? { arm2 } : {}),
    leg: [62, 0],
    hold,
  });
const flatBench = env.flat(40, 128, 98);

// Наклонная скамья (как у исходной incline_press)
const incl = (handAt: [number, number]): Pose =>
  body({ at: [122, 92], torso: -122, head: -118, arm: [0, 0], leg: [72, 2], handAt, armBend: 1, hold: 'bb' });

// Хват в наклоне (тяги): ноги чуть согнуты, корпус ~25° к горизонту
const hinge = (arm: [number, number], torso = 118): Pose =>
  body({ at: [92, 125], root: 'foot', torso, leg: [40, 0, 90], arm, hold: 'bb' });

export const PICS_B1 = {
  bench_press: {
    env: flatBench,
    poses: [lying([45, 175], 'bb'), lying([180, 180], 'bb')],
  },
  incline_bb_press: {
    env: env.incline(100, 140, 100, [74, 56]),
    poses: [incl([100, 60]), incl([82, 16])],
  },
  db_fly: {
    env: flatBench,
    poses: [lying([180, 180], 'db'), lying([62, 96], 'db')],
  },
  pec_deck: {
    env: `<line x1="70" y1="100" x2="130" y2="100" class="pad"/>`,
    noArrow: 1,
    poses: [facing({ arm: [95, 180], seated: true }), facing({ arm: [-25, 180], seated: true })],
  },
  chest_dip: {
    env: env.dip(70, 124, 70),
    mv: 's',
    poses: [
      body({ at: [100, 70], root: 'hand', torso: 160, arm: [-78, 18], leg: [16, -40], scale: 0.95 }),
      body({ at: [100, 70], root: 'hand', torso: 168, arm: [0, 0], leg: [16, -40], scale: 0.95 }),
    ],
  },
  push_up: {
    env: '',
    mv: 's',
    poses: [
      body({
        at: [154, 124],
        root: 'foot',
        torso: -98,
        head: -96,
        leg: [82, 82],
        arm: [0, 0],
        handAt: [80, 125],
        armBend: -1,
      }),
      body({
        at: [154, 124],
        root: 'foot',
        torso: -120,
        head: -116,
        leg: [60, 60],
        arm: [0, 0],
        handAt: [80, 125],
      }),
    ],
  },
  incline_push_up: {
    env: env.box(56, 40, 32),
    mv: 's',
    poses: [
      body({
        at: [160, 124],
        root: 'foot',
        torso: -110,
        head: -106,
        leg: [70, 70],
        arm: [0, 0],
        handAt: [80, 93],
        armBend: -1,
      }),
      body({
        at: [160, 124],
        root: 'foot',
        torso: -128,
        head: -124,
        leg: [52, 52],
        arm: [0, 0],
        handAt: [80, 93],
      }),
    ],
  },
  deadlift: {
    env: '',
    poses: [
      body({
        at: [96, 125],
        root: 'foot',
        torso: 128,
        head: 115,
        leg: [64, -18, 90],
        arm: [0, 0],
        hold: 'bb',
      }),
      body({ at: [96, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [0, 0], hold: 'bb' }),
    ],
  },
  rdl: {
    env: '',
    poses: [
      body({ at: [92, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [0, 0], hold: 'bb' }),
      body({ at: [92, 125], root: 'foot', torso: 124, head: 116, leg: [40, 0, 90], arm: [0, 0], hold: 'bb' }),
    ],
  },
  bb_row: {
    env: '',
    poses: [hinge([0, 0]), hinge([-58, 4])],
  },
  one_arm_row: {
    env: env.flat(44, 104, 96),
    poses: [
      body({
        at: [70, 84],
        torso: 94,
        head: 92,
        arm: [0, 0],
        hand2At: [104, 92],
        leg: [24, 2],
        foot2At: [58, 92],
        hold: 'db',
        legBend: 1,
      }),
      body({
        at: [70, 84],
        torso: 94,
        head: 92,
        arm: [-158, 4],
        hand2At: [104, 92],
        leg: [24, 2],
        foot2At: [58, 92],
        hold: 'db',
        legBend: 1,
      }),
    ],
  },
  t_bar_row: {
    env: '',
    poses: [
      withProps(hinge([0, 0]), (j) => lever([30, 124], j.w!)),
      withProps(hinge([-58, 4]), (j) => lever([30, 124], j.w!)),
    ],
  },
  pull_up: {
    env: env.bar(40, 160, 24),
    mv: 'h',
    poses: [
      body({ at: [100, 24], root: 'hand', torso: 180, arm: [180, 180], leg: [12, -60], scale: 0.85 }),
      body({ at: [100, 24], root: 'hand', torso: 178, arm: [16, 170], leg: [12, -60], scale: 0.85 }),
    ],
  },
  assisted_pull_up: {
    env:
      env.bar(130, 170, 24) +
      `<line x1="130" y1="24" x2="60" y2="24"/>` +
      env.pad(70, 106, 96, 106) +
      `<line x1="74" y1="106" x2="74" y2="127"/>`,
    mv: 'h',
    poses: [
      body({ at: [100, 24], root: 'hand', torso: 180, arm: [180, 180], leg: [0, -90], scale: 0.85 }),
      body({ at: [100, 24], root: 'hand', torso: 178, arm: [16, 170], leg: [0, -90], scale: 0.85 }),
    ],
  },
  straight_arm_pulldown: {
    env: env.column(166),
    cable: [152, 8],
    poses: [
      body({
        at: [96, 125],
        root: 'foot',
        torso: 162,
        leg: [-6, 4],
        arm: [140, 140],
        hold: 'handle',
        leg2: [8, -4],
      }),
      body({
        at: [96, 125],
        root: 'foot',
        torso: 162,
        leg: [-6, 4],
        arm: [12, 12],
        hold: 'handle',
        leg2: [8, -4],
      }),
    ],
  },
  inverted_row: {
    env: `<line x1="60" y1="64" x2="112" y2="64"/><line x1="64" y1="64" x2="64" y2="127"/>`,
    mv: 's',
    poses: [
      body({
        at: [170, 124],
        root: 'foot',
        torso: -106,
        head: -104,
        leg: [74, 74],
        arm: [0, 0],
        handAt: [88, 64],
      }),
      body({
        at: [170, 124],
        root: 'foot',
        torso: -118,
        head: -112,
        leg: [62, 62],
        arm: [0, 0],
        handAt: [88, 64],
        armBend: -1,
      }),
    ],
  },
  machine_row: {
    env: env.seat(64, 104, 100) + env.pad(126, 60, 126, 92) + `<line x1="146" y1="40" x2="146" y2="127"/>`,
    cable: [146, 60],
    poses: [
      body({ at: [86, 94], torso: 176, arm: [90, 90], leg: [88, 0], hold: 'handle' }),
      body({ at: [86, 94], torso: 182, arm: [-40, 84], leg: [88, 0], hold: 'handle' }),
    ],
  },
  db_pullover: {
    env: flatBench,
    poses: [lying([-78, -84], 'db'), lying([180, 180], 'db')],
  },
  back_extension: {
    env:
      env.pad(90, 92, 108, 74) +
      env.pad(62, 106, 70, 114) +
      `<line x1="74" y1="112" x2="102" y2="84"/><line x1="90" y1="96" x2="90" y2="127"/>`,
    mv: 'h',
    poses: [
      body({ at: [106, 72], torso: 18, head: 14, arm: [-162, 18], leg: [-45, -45] }),
      body({ at: [106, 72], torso: 135, head: 132, arm: [-45, 135], leg: [-45, -45] }),
    ],
  },
  dead_hang: {
    env: env.bar(40, 160, 12),
    mv: 'f',
    poses: [
      body({ at: [100, 125], root: 'foot', torso: 180, arm: [176, 178], leg: [0, 0, 90], scale: 0.85 }),
      body({ at: [100, 12], root: 'hand', torso: 180, arm: [180, 180], leg: [4, -40], scale: 0.85 }),
    ],
  },
} satisfies Record<string, PicDef>;
