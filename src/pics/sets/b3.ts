import type { PicDef, Pose } from '../engine';
import { band, body, env, facing, shiftFront, withProps } from '../kit';

/** Партия 3 (этап 3А): плечи и руки. Позы — по углам суставов, см. src/pics/kit.ts */

type Hold = 'bb' | 'db' | 'dbv';

const stand = (arm: [number, number], hold?: Hold, torso = 180, x = 100, scale = 1): Pose =>
  body({ at: [x, 125], root: 'foot', torso, leg: [0, 0, 90], arm, scale, ...(hold ? { hold } : {}) });
/** Руки над головой: фигура чуть меньше, чтобы снаряд помещался в кадр */
const tall = (arm: [number, number], hold: Hold): Pose => stand(arm, hold, 180, 100, 0.86);

// Лёжа на скамье головой влево (как в партии 1)
const lying = (arm: [number, number]): Pose =>
  body({ at: [108, 90], torso: -90, head: -96, arm, leg: [62, 0], hold: 'bb' });

// Лёжа грудью на наклонной скамье головой вправо, ноги упираются в пол
const spider = (arm: [number, number]): Pose =>
  body({ at: [60, 96], torso: 122, head: 118, arm, leg: [-60, -30], footAt: [30, 125], legBend: 1, hold: 'bb' });

// Упор одной рукой и коленом в скамью (как тяга гантели одной рукой)
const braced = (arm: [number, number]): Pose =>
  body({
    at: [70, 84],
    torso: 94,
    head: 92,
    arm,
    hand2At: [104, 92],
    leg: [24, 2],
    foot2At: [58, 92],
    hold: 'dbv',
    legBend: 1,
  });

export const PICS_B3 = {
  ohp: {
    env: '',
    poses: [tall([96, -118], 'bb'), tall([178, 180], 'bb')],
  },
  bent_over_lateral: {
    env: '',
    poses: [
      shiftFront(facing({ arm: [6, 6], hold: 'dbv' }), 22),
      shiftFront(facing({ arm: [84, 92], hold: 'dbv' }), 22),
    ],
  },
  front_raise: {
    env: '',
    poses: [stand([4, 4], 'db'), stand([92, 92], 'db')],
  },
  upright_row: {
    env: '',
    poses: [facing({ arm: [8, 4], hold: 'bar' }), facing({ arm: [104, -58], hold: 'bar' })],
  },
  face_pull: {
    env: env.column(176),
    cable: [168, 44],
    poses: [
      body({
        at: [96, 125],
        root: 'foot',
        torso: 176,
        leg: [6, -4],
        leg2: [-8, 4],
        arm: [104, 100],
        hold: 'handle',
      }),
      body({
        at: [96, 125],
        root: 'foot',
        torso: 182,
        leg: [6, -4],
        leg2: [-8, 4],
        arm: [-100, 150],
        hold: 'handle',
      }),
    ],
  },
  arnold_press: {
    env: `<line x1="70" y1="100" x2="130" y2="100" class="pad"/>`,
    poses: [
      facing({ arm: [12, 170], seated: true, hold: 'db' }),
      facing({ arm: [150, 168], seated: true, hold: 'db' }),
    ],
  },
  cable_lateral: {
    env: env.lowColumn(186),
    cable: [176, 118],
    poses: [facing({ arm: [-14, -10] }), facing({ arm: [86, 90] })],
  },
  band_ext_rot: {
    env: env.anchor(160, 72),
    poses: [
      withProps(facing({ arm: [4, -86] }), (j) => band([160, 72], j.w!)),
      withProps(facing({ arm: [4, 84] }), (j) => band([160, 72], j.w!)),
    ],
  },
  barbell_curl: {
    env: '',
    poses: [stand([10, 6], 'bb'), stand([8, 158], 'bb')],
  },
  // «Паук» со штангой: грудью на наклонной скамье (~32°), плечи за краем спинки, руки висят
  // вертикально; локти на месте, гриф поднимается к плечам
  bb_spider_curl: {
    env: env.pad(46, 112, 88, 86) + `<line x1="67" y1="99" x2="67" y2="127"/>`,
    poses: [spider([0, 0]), spider([4, 160])],
  },
  db_curl: {
    env: '',
    poses: [stand([10, 6], 'db'), stand([8, 156], 'db')],
  },
  cable_curl: {
    env: env.lowColumn(176),
    cable: [166, 118],
    poses: [stand([10, 12]), stand([8, 156])],
  },
  concentration_curl: {
    env: env.flat(54, 110, 100),
    poses: [
      body({ at: [80, 94], torso: 142, head: 130, arm: [14, 4], leg: [88, 0], hold: 'db' }),
      body({ at: [80, 94], torso: 142, head: 130, arm: [14, 166], leg: [88, 0], hold: 'db' }),
    ],
  },
  skull_crusher: {
    env: env.flat(40, 128, 98),
    poses: [lying([-172, -70]), lying([-172, -172])],
  },
  bench_dip: {
    env: env.flat(36, 74, 98),
    mv: 'hp',
    poses: [
      body({
        at: [82, 112],
        torso: 180,
        arm: [0, 0],
        handAt: [64, 96],
        armBend: 1,
        leg: [0, 0],
        footAt: [150, 124],
        legBend: 1,
      }),
      body({
        at: [80, 92],
        torso: 180,
        arm: [0, 0],
        handAt: [64, 96],
        leg: [0, 0],
        footAt: [150, 124],
        legBend: 1,
      }),
    ],
  },
  overhead_db_ext: {
    env: '',
    poses: [tall([174, -24], 'db'), tall([176, 178], 'db')],
  },
  kickback: {
    env: env.flat(44, 104, 96),
    poses: [braced([-96, 0]), braced([-96, -96])],
  },
} satisfies Record<string, PicDef>;
