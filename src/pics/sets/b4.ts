import { front, type PicDef, type Pose, type Pt } from '../engine';
import { band, body, env, facing, frontLegs, rope, withProps, type BodySpec } from '../kit';

/** Партия 4 (этап 3А): корпус, кардио и всё тело, растяжка и разминка */

// ---------- общие позы ----------

/** Упор на предплечьях (планка) */
const plankForearms = (): Pose =>
  body({ at: [160, 121], root: 'foot', torso: -104, head: -100, leg: [76, 76], arm: [0, -90] });

/** На четвереньках, голова слева: кисти под плечами, колени под тазом */
const allFours = (o: Partial<BodySpec> = {}, nearHandDown = true): Pose =>
  body({
    at: [122, 98],
    torso: -113,
    head: -100,
    arm: [0, 0],
    ...(nearHandDown ? { handAt: [85, 124] as Pt } : { hand2At: [85, 124] as Pt }),
    leg: [0, 90],
    ...o,
  });

/** Лёжа на спине, голова слева, колени согнуты, стопы на полу */
const supine = (torso: number, o: Partial<BodySpec> = {}): Pose =>
  body({
    at: [108, 119],
    torso,
    head: torso - 4,
    arm: [80, 90],
    leg: [0, 0],
    footAt: [142, 121],
    legBend: -1,
    ...o,
  });

/** Упор лёжа на прямых руках (верх отжимания), голова слева */
const highPlank = (o: Partial<BodySpec> = {}): Pose =>
  body({
    at: [156, 121],
    root: 'foot',
    torso: -118,
    head: -114,
    leg: [62, 62],
    arm: [0, 0],
    handAt: [80, 124],
    ...o,
  });

/** Шаг: ближняя нога вперёд или назад */
const step = (x: number, fwd: boolean, hold?: 'dbv', y = 125): Pose =>
  body({
    at: [x, y],
    root: 'foot',
    torso: 178,
    leg: fwd ? [22, 6, 90] : [-18, -26, 70],
    leg2: fwd ? [-18, -26, 70] : [22, 6, 90],
    arm: fwd ? [-20, -10] : [20, 40],
    arm2: fwd ? [20, 40] : [-20, -10],
    ...(hold
      ? { hold, hold2: hold, arm: [4, 0] as [number, number], arm2: [-4, 0] as [number, number] }
      : {}),
  });

/** Спереди: обе кисти вместе в точке (скручивания, дровосек) */
function handsTogether(P: Pose, hand: Pt): Pose {
  const sL: Pt = [84, 46];
  const sR: Pt = [116, 46];
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 8];
  P.c[3] = [sL, mid(sL, hand), hand];
  P.c[4] = [sR, mid(sR, hand), hand];
  P.w = hand;
  P.j = { w: hand };
  return P;
}

/** Корпус-дуга (кошка/корова): средняя точка спины выше или ниже прямой */
function arch(P: Pose, dy: number): Pose {
  const [s, hp] = P.c[0] as [Pt, Pt];
  P.c[0] = [s, [(s[0] + hp[0]) / 2, (s[1] + hp[1]) / 2 + dy], hp];
  return P;
}

export const PICS_B4 = {
  // ---------- корпус ----------
  plank: {
    env: env.mat(40, 176),
    noArrow: 1,
    poses: [
      body({ at: [124, 121], root: 'knee', torso: -101, head: -98, leg: [60, 95], arm: [0, -90] }),
      plankForearms(),
    ],
  },
  hanging_leg_raise: {
    env: env.bar(40, 160, 24),
    mv: 'f',
    poses: [
      body({ at: [100, 24], root: 'hand', torso: 180, arm: [180, 180], leg: [6, -10, 90], scale: 0.8 }),
      body({ at: [100, 24], root: 'hand', torso: 182, arm: [180, 180], leg: [92, 92, 170], scale: 0.8 }),
    ],
  },
  crunch: {
    env: env.mat(30, 170),
    mv: 'h',
    poses: [supine(-90, { arm: [-150, 60] }), supine(-122, { arm: [-170, 40] })],
  },
  reverse_crunch: {
    env: env.mat(30, 170),
    mv: 'k',
    poses: [
      body({ at: [62, 119], root: 'shoulder', torso: -90, head: -92, arm: [90, 90], leg: [160, 92] }),
      body({ at: [62, 119], root: 'shoulder', torso: -68, head: -88, arm: [90, 90], leg: [-150, 120] }),
    ],
  },
  russian_twist: {
    env: '',
    noArrow: 0,
    poses: [
      handsTogether(frontLegs(facing({ arm: [0, 0], seated: true }), [80, 96], [86, 112]), [64, 82]),
      handsTogether(frontLegs(facing({ arm: [0, 0], seated: true }), [80, 96], [86, 112]), [136, 82]),
    ],
  },
  bird_dog: {
    env: env.mat(40, 170),
    poses: [allFours(), allFours({ arm: [-96, -96], leg: [92, 92], leg2: [0, 90] }, false)],
  },
  bicycle_crunch: {
    env: env.mat(30, 170),
    noArrow: 1,
    poses: [
      body({ at: [104, 116], torso: -116, head: -126, arm: [-160, 30], leg: [-150, 100], leg2: [76, 86] }),
      body({ at: [104, 116], torso: -116, head: -126, arm: [-160, 30], leg: [76, 86], leg2: [-150, 100] }),
    ],
  },
  hollow_hold: {
    env: env.mat(30, 176),
    noArrow: 1,
    poses: [
      body({ at: [104, 118], torso: -90, head: -90, arm: [-90, -90], leg: [90, 90] }),
      body({ at: [104, 118], torso: -106, head: -104, arm: [-110, -110], leg: [104, 104] }),
    ],
  },
  woodchop: {
    env: env.column(176),
    cable: [168, 8],
    poses: [
      handsTogether(frontLegs(facing({ arm: [0, 0] }), [84, 106], [76, 125]), [138, 22]),
      handsTogether(frontLegs(facing({ arm: [0, 0] }), [84, 106], [76, 125]), [66, 92]),
    ],
  },
  // ---------- кардио и всё тело ----------
  kb_swing: {
    env: '',
    poses: [
      body({
        at: [96, 125],
        root: 'foot',
        torso: 124,
        head: 118,
        leg: [40, 0, 90],
        arm: [-12, -12],
        hold: 'kb',
      }),
      body({ at: [96, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [96, 96], hold: 'kb' }),
    ],
  },
  kb_push_press: {
    env: '',
    poses: [
      body({
        at: [100, 125],
        root: 'foot',
        torso: 180,
        leg: [18, -18, 90],
        arm: [14, 166],
        hold: 'kb',
        scale: 0.9,
      }),
      body({
        at: [100, 125],
        root: 'foot',
        torso: 180,
        leg: [0, 0, 90],
        arm: [178, 180],
        hold: 'kb',
        scale: 0.9,
      }),
    ],
  },
  burpee: {
    env: '',
    mv: 'h',
    poses: [
      highPlank(),
      body({ at: [100, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [170, 176], scale: 0.9 }),
    ],
  },
  jump_rope: {
    env: '',
    noArrow: 1,
    poses: [
      withProps(
        body({ at: [100, 119], root: 'foot', torso: 180, leg: [4, -6, 120], arm: [24, 70], scale: 0.9 }),
        (j) => rope(j.w!, [96, 4], [j.w![0] - 26, j.w![1]]),
      ),
      withProps(
        body({ at: [100, 122], root: 'foot', torso: 180, leg: [6, -10, 120], arm: [24, 70], scale: 0.9 }),
        (j) => rope(j.w!, [96, 128], [j.w![0] - 26, j.w![1]]),
      ),
    ],
  },
  rowing: {
    env: env.rower(24, 150),
    cable: [148, 100],
    poses: [
      body({
        at: [76, 106],
        torso: 160,
        head: 160,
        leg: [0, 0],
        footAt: [132, 106],
        legBend: -1,
        arm: [100, 96],
        hold: 'handle',
      }),
      body({
        at: [52, 106],
        torso: 198,
        head: 192,
        leg: [92, 90],
        footAt: [132, 106],
        arm: [-28, 82],
        hold: 'handle',
      }),
    ],
  },
  treadmill: {
    env: env.treadmill(30, 150),
    noArrow: 1,
    poses: [step(92, true, undefined, 117), step(92, false, undefined, 117)],
  },
  bike: {
    env: env.bike([72, 76], [132, 58], [110, 104]),
    mv: 'f',
    poses: [
      body({
        at: [72, 70],
        torso: 150,
        head: 140,
        arm: [0, 0],
        handAt: [130, 58],
        leg: [0, 0],
        footAt: [110, 90],
        legBend: -1,
      }),
      body({
        at: [72, 70],
        torso: 150,
        head: 140,
        arm: [0, 0],
        handAt: [130, 58],
        leg: [0, 0],
        footAt: [110, 118],
        legBend: -1,
      }),
    ],
  },
  farmer_carry: {
    env: '',
    mv: 'hp',
    poses: [step(70, true, 'dbv'), step(130, false, 'dbv')],
  },
  mountain_climber: {
    env: '',
    noArrow: 1,
    poses: [
      highPlank({ leg: [-80, -40], leg2: [62, 62], root: 'foot2' }),
      highPlank({ leg: [62, 62], leg2: [-80, -40], root: 'foot' }),
    ],
  },
  jumping_jack: {
    env: '',
    noArrow: 1,
    poses: [
      frontLegs(facing({ arm: [6, 4] }), [90, 107], [89, 125]),
      frontLegs(facing({ arm: [150, 160] }), [80, 106], [68, 124]),
    ],
  },
  // ---------- растяжка и разминка ----------
  cat_cow: {
    env: env.mat(40, 170),
    noArrow: 1,
    poses: [arch(allFours({ head: -84 }), 8), arch(allFours({ head: -140 }), -10)],
  },
  hip_flexor_stretch: {
    env: env.mat(40, 176),
    mv: 'hp',
    poses: [
      body({ at: [128, 125], root: 'foot', torso: 180, leg: [86, -2, 90], leg2: [-6, -92], arm: [10, 10] }),
      body({ at: [128, 125], root: 'foot', torso: 176, leg: [70, -14, 90], leg2: [-32, -96], arm: [10, 10] }),
    ],
  },
  hamstring_stretch: {
    env: env.mat(30, 176),
    poses: [
      body({ at: [66, 118], torso: 180, arm: [40, 70], leg: [90, 90, 180] }),
      body({ at: [66, 118], torso: 118, head: 112, arm: [100, 96], leg: [90, 90, 180] }),
    ],
  },
  thoracic_rotation: {
    env: env.mat(40, 170),
    mv: 'e',
    poses: [allFours({ arm: [24, -150] }, false), allFours({ arm: [170, -40] }, false)],
  },
  band_pull_apart: {
    env: '',
    poses: [
      withProps(
        front({
          arm: [
            [92, 50],
            [97, 48],
          ],
        }),
        () => band([97, 48], [103, 48]),
      ),
      withProps(
        front({
          arm: [
            [62, 47],
            [40, 48],
          ],
        }),
        () => band([40, 48], [160, 48]),
      ),
    ],
  },
  childs_pose: {
    env: env.mat(30, 176),
    mv: 'h',
    poses: [
      body({ at: [112, 121], root: 'knee', torso: 180, leg: [0, 90], arm: [4, 4] }),
      body({ at: [112, 121], root: 'knee', torso: -100, head: -96, leg: [-60, 90], arm: [-92, -90] }),
    ],
  },
  doorway_stretch: {
    env: env.wall(66),
    poses: [
      body({ at: [100, 125], root: 'foot', torso: 180, leg: [0, 0, 90], arm: [-90, 180], handAt: [68, 30] }),
      body({
        at: [112, 125],
        root: 'foot',
        torso: 170,
        leg: [16, -8, 90],
        leg2: [-14, -6, 90],
        arm: [-90, 180],
        handAt: [68, 30],
      }),
    ],
  },
  calf_stretch: {
    env: env.wall(164),
    poses: [
      body({
        at: [100, 125],
        root: 'foot',
        torso: 168,
        leg: [-14, -14, 90],
        foot2At: [126, 125],
        leg2: [0, 0, 90],
        arm: [90, 90],
        handAt: [162, 54],
      }),
      body({
        at: [84, 125],
        root: 'foot',
        torso: 140,
        head: 132,
        leg: [-36, -36, 90],
        foot2At: [128, 125],
        leg2: [0, 0, 90],
        arm: [90, 90],
        handAt: [162, 64],
      }),
    ],
  },
  arm_circles: {
    env: '',
    poses: [facing({ arm: [120, 120] }), facing({ arm: [70, 70] })],
  },
  figure_four: {
    env: env.flat(50, 106, 100),
    poses: [
      body({ at: [80, 94], torso: 180, arm: [30, 60], leg: [88, 0, 90], leg2: [70, 120] }),
      body({ at: [80, 94], torso: 140, head: 128, arm: [60, 60], leg: [88, 0, 90], leg2: [70, 120] }),
    ],
  },
  quad_stretch: {
    env: env.wall(150),
    poses: [
      body({
        at: [100, 125],
        root: 'foot2',
        torso: 180,
        leg: [0, 0, 90],
        leg2: [0, 0, 90],
        arm: [0, 0],
        arm2: [80, 90],
      }),
      body({
        at: [100, 125],
        root: 'foot2',
        torso: 180,
        leg: [-6, -172],
        leg2: [0, 0, 90],
        arm: [0, 0],
        arm2: [80, 90],
      }),
    ].map((P) => {
      // Ближняя рука держит стопу согнутой ноги
      const f = P.j.f!;
      const s = P.j.s!;
      if (f[1] < 110) P.c[2] = [s, [s[0] - 10, (s[1] + f[1]) / 2], f];
      return P;
    }) as [Pose, Pose],
  },
  leg_swing: {
    env: env.wall(54),
    mv: 'f',
    poses: [
      body({
        at: [96, 125],
        root: 'foot2',
        torso: 180,
        leg: [-34, -34, 70],
        leg2: [0, 0, 90],
        arm: [-60, -90],
        handAt: [56, 70],
      }),
      body({
        at: [96, 125],
        root: 'foot2',
        torso: 180,
        leg: [54, 54, 140],
        leg2: [0, 0, 90],
        arm: [-60, -90],
        handAt: [56, 70],
      }),
    ],
  },
} satisfies Record<string, PicDef>;
