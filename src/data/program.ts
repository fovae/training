import type { Day, Exercise } from './types';

/**
 * Тренировочная программа «Сплит 3 + 1».
 * Содержание перенесено из исходной одностраничной версии без изменений.
 * Как редактировать — см. README → «Как изменить программу».
 */

const TWS = 'https://trainwithsam.com/exercises/';

export const PROGRAM: Day[] = [
  {
    id: 'day-1',
    color: 'c1',
    title: 'Грудь + трицепс',
    status: 'Основная',
    intro:
      'Сначала грудь, затем трицепс: жимы уже нагружают трицепс, так что он придёт немного уставшим — это нормально.',
    groups: [
      {
        name: 'Грудь',
        exercises: [
          {
            id: 'incline-db-press',
            pic: 'incline_press',
            name: 'Жим гантелей на наклонной скамье',
            sets: 3,
            reps: [8, 12],
            focus: 'Верх груди',
            base: true,
            tech: 'Угол скамьи 20–30°. Опускай гантели подконтрольно, не стукай ими наверху.',
          },
          {
            id: 'flat-press',
            pic: 'flat_press',
            name: 'Жим в горизонтальном тренажёре или гантелей лёжа',
            sets: 3,
            reps: [8, 12],
            focus: 'Середина груди',
            base: true,
            tech: 'Лопатки сведены и стабильны, локти не разводи строго в стороны. Выбирай вариант, где лучше контролируешь амплитуду.',
          },
          {
            id: 'high-to-low-cable-fly',
            pic: 'cable_fly',
            name: 'Сведение блоков сверху вниз',
            sets: 3,
            reps: [10, 15],
            focus: 'Низ груди',
            tech: 'Слегка наклони корпус, веди рукояти вниз и навстречу друг другу. Не превращай движение в жим.',
          },
        ],
      },
      {
        name: 'Трицепс',
        exercises: [
          {
            id: 'rope-pushdown',
            pic: 'pushdown',
            name: 'Разгибание на верхнем блоке с канатом',
            sets: 3,
            reps: [10, 12],
            focus: 'Латеральная и медиальная головки',
            tech: 'Локти прижаты к корпусу, двигаются только предплечья. Внизу разведи концы каната, без раскачки.',
            link: TWS + 'triceps-pushdown.html',
          },
          {
            id: 'overhead-cable-extension',
            pic: 'overhead_ext',
            name: 'Разгибание из-за головы на блоке',
            sets: 3,
            reps: [10, 12],
            focus: 'Длинная головка',
            tech: 'Локти смотрят вперёд, поясницу не прогибай. Работай в комфортной амплитуде.',
            link: TWS + 'overhead-cable-triceps-extension.html',
          },
          {
            id: 'single-arm-pushdown',
            pic: 'pushdown',
            name: 'Одноручное разгибание на блоке',
            sets: 2,
            reps: [10, 12],
            per: 'на руку',
            focus: 'Контроль каждой руки',
            optional: true,
            tech: 'Плечо неподвижно, локоть у корпуса. Если трицепс уже «забит» после жимов — пропусти.',
          },
        ],
      },
    ],
  },
  {
    id: 'day-2',
    color: 'c2',
    title: 'Спина + бицепс + предплечья',
    status: 'Основная',
    intro: 'Тяги — первыми. Бицепс и предплечья уже помогают в тягах, поэтому их изоляция идёт в конце.',
    groups: [
      {
        name: 'Спина',
        exercises: [
          {
            id: 'lat-pulldown',
            pic: 'lat_pulldown',
            name: 'Тяга верхнего блока к груди',
            sets: 3,
            reps: [8, 12],
            focus: 'Широчайшие',
            base: true,
            tech: 'Начни с опускания лопаток, потом веди локти вниз. Не за голову и без раскачки.',
            link: TWS + 'lat-pulldown.html',
          },
          {
            id: 'seated-cable-row',
            pic: 'cable_row',
            name: 'Горизонтальная тяга нижнего блока',
            sets: 3,
            reps: [8, 12],
            focus: 'Середина спины, ромбовидные',
            base: true,
            tech: 'Спина длинная, корпус почти неподвижен. В конце сведи лопатки, плечи не тяни к ушам.',
            link: TWS + 'seated-cable-row.html',
          },
          {
            id: 'chest-supported-db-row',
            pic: 'chest_row',
            name: 'Тяга гантелей с упором грудью',
            sets: 3,
            reps: [8, 12],
            focus: 'Верх спины, задние дельты',
            base: true,
            tech: 'Ляг грудью на наклонную скамью, тяни локти назад без рывков. Нет скамьи — тяга в тренажёре с упором грудью.',
          },
        ],
      },
      {
        name: 'Бицепс',
        exercises: [
          {
            id: 'incline-db-curl',
            pic: 'incline_curl',
            name: 'Сгибания с гантелями на наклонной скамье',
            sets: 3,
            reps: [8, 12],
            focus: 'Длинная головка',
            tech: 'Плечи позади корпуса, локти не уводи вперёд. Опускай медленно.',
          },
          {
            id: 'preacher-curl',
            pic: 'preacher',
            name: 'Сгибания на скамье Скотта / в тренажёре',
            sets: 3,
            reps: [8, 12],
            focus: 'Короткая головка',
            tech: 'Не выпрямляй локоть резко до упора и не отрывай плечо от опоры.',
          },
          {
            id: 'hammer-curl',
            pic: 'hammer',
            name: 'Молотковые сгибания',
            sets: 2,
            reps: [10, 12],
            focus: 'Брахиалис, плечелучевая',
            tech: 'Ладони смотрят друг на друга. Корпус не раскачивай, плечи не поднимай.',
          },
        ],
      },
      {
        name: 'Предплечья',
        exercises: [
          {
            id: 'wrist-curl',
            pic: 'wrist_curl',
            name: 'Сгибание кистей сидя',
            sets: 2,
            reps: [12, 15],
            focus: 'Сгибатели предплечья',
            tech: 'Предплечья на бёдрах или скамье, двигаются только кисти. Вес умеренный.',
          },
          {
            id: 'reverse-wrist-curl',
            pic: 'wrist_curl',
            name: 'Разгибание кистей сидя',
            sets: 2,
            reps: [12, 15],
            focus: 'Разгибатели предплечья',
            tech: 'Медленно и без рывков. Если неприятно в кистях или локтях — снизь вес или убери упражнение.',
          },
        ],
      },
    ],
  },
  {
    id: 'day-3',
    color: 'c3',
    title: 'Плечи + трапеция',
    status: 'Основная',
    intro:
      'Передняя дельта уже работает в жимах на грудь, поэтому отдельной изоляции на неё нет — фокус на среднюю и заднюю.',
    groups: [
      {
        name: 'Дельты',
        exercises: [
          {
            id: 'seated-shoulder-press',
            pic: 'shoulder_press',
            name: 'Жим гантелей сидя или в тренажёре',
            sets: 3,
            reps: [8, 12],
            focus: 'Передняя и средняя дельты',
            base: true,
            tech: 'Поясницу не прогибай, локти не опускай ниже комфортной глубины. Не каждый подход до отказа.',
          },
          {
            id: 'lateral-raise',
            pic: 'lateral',
            name: 'Махи гантелями в стороны',
            sets: 3,
            reps: [10, 15],
            focus: 'Средняя дельта',
            tech: 'Примерно до уровня плеч, локти слегка согнуты, корпус не раскачивается.',
          },
          {
            id: 'reverse-pec-deck',
            pic: 'rear_fly',
            name: 'Обратная бабочка (Reverse Pec Deck)',
            sets: 3,
            reps: [10, 15],
            focus: 'Задняя дельта',
            tech: 'Разводи руки за счёт плеч, лопатки сильно не своди. Шея расслаблена.',
          },
        ],
      },
      {
        name: 'Трапеция',
        exercises: [
          {
            id: 'db-shrug',
            pic: 'shrug',
            name: 'Шраги с гантелями',
            sets: 3,
            reps: [10, 12],
            focus: 'Верхняя трапеция',
            tech: 'Плечи строго вверх, без вращения. Короткая пауза наверху.',
          },
          {
            id: 'incline-y-raise',
            pic: 'y_raise',
            name: 'Y-подъёмы на наклонной скамье',
            sets: 2,
            reps: [12, 15],
            focus: 'Нижняя трапеция, лопатки',
            tech: 'Очень лёгкие гантели или без веса. Руки в форме буквы Y, шею не зажимай.',
            alt: 'Можно заменить или чередовать с Face Pull — он дополнительно грузит задние дельты и верх спины.',
            link2: { href: TWS + 'face-pull.html', label: 'Face Pull — демонстрация' },
          },
        ],
      },
    ],
  },
  {
    id: 'day-4',
    color: 'c4',
    title: 'Пресс + кор + ноги',
    status: 'Дополнительная',
    intro:
      'Дополнительный день. Если на неделе получилось только три тренировки — не нужно втискивать его любой ценой.',
    groups: [
      {
        name: 'Пресс',
        exercises: [
          {
            id: 'cable-crunch',
            pic: 'cable_crunch',
            name: 'Скручивания на верхнем блоке',
            sets: 3,
            reps: [12, 15],
            focus: 'Прямая мышца живота',
            tech: 'Скручивай грудную клетку к тазу, а не тяни канат руками. Таз почти неподвижен.',
            link: TWS + 'kneeling-cable-crunch.html',
          },
          {
            id: 'hanging-knee-raise',
            pic: 'knee_raise',
            name: 'Подъём коленей в висе или на упорах',
            sets: 3,
            reps: [10, 15],
            focus: 'Прямая мышца, низ движения',
            tech: 'Наверху подкручивай таз. Без раскачки; если тяжело — начни с упоров.',
          },
          {
            id: 'side-plank',
            pic: 'side_plank',
            name: 'Боковая планка',
            sets: 2,
            reps: [20, 40],
            unit: 'sec',
            per: 'на сторону',
            focus: 'Косые, боковая стабилизация',
            tech: 'Тело — прямая линия, таз не провисает. Боль в плече или пояснице — стоп.',
          },
        ],
      },
      {
        name: 'Кор',
        exercises: [
          {
            id: 'pallof-press',
            pic: 'pallof',
            name: 'Pallof Press',
            sets: 2,
            reps: [10, 12],
            per: 'на сторону',
            focus: 'Сопротивление вращению',
            tech: 'Встань боком к блоку, выжми рукоять перед собой и не давай корпусу развернуться.',
            link: TWS + 'pallof-press.html',
          },
          {
            id: 'dead-bug',
            pic: 'dead_bug',
            name: 'Dead Bug',
            sets: 2,
            reps: [8, 12],
            per: 'на сторону',
            focus: 'Глубокие стабилизаторы',
            tech: 'Поясница прижата к полу, медленно опускай противоположные руку и ногу. Отрывается поясница — уменьши амплитуду.',
          },
        ],
      },
      {
        name: 'Ноги',
        optional: true,
        label: 'по желанию · поддержка',
        exercises: [
          {
            id: 'leg-press',
            pic: 'leg_press',
            name: 'Жим ногами',
            sets: 2,
            reps: [10, 12],
            focus: 'Квадрицепсы, ягодичные',
            base: true,
            tech: 'Не опускай платформу так глубоко, чтобы таз подкручивался и поясница отрывалась.',
          },
          {
            id: 'leg-curl',
            pic: 'leg_curl',
            name: 'Сгибание ног в тренажёре',
            sets: 2,
            reps: [10, 15],
            focus: 'Задняя поверхность бедра',
            tech: 'Плавно, без рывков. Максимальный вес не нужен.',
          },
          {
            id: 'calf-raise',
            pic: 'calf',
            name: 'Подъёмы на носки',
            sets: 2,
            reps: [12, 15],
            focus: 'Икроножные',
            tech: 'Полная комфортная амплитуда, пауза вверху, медленно вниз.',
          },
        ],
      },
    ],
  },
];

// ---------- производные помощники ----------

/** «3 × 8–12», «2 × 20–40 с» — как в исходной программе */
export const schemeText = (e: Exercise): string =>
  `${e.sets} × ${e.reps[0]}–${e.reps[1]}${e.unit === 'sec' ? ' с' : ''}`;

export const restLabel = (e: Exercise): string => (e.base ? '2–3 мин' : '60–120 с');

export const dayExercises = (d: Day): Exercise[] => d.groups.flatMap((g) => g.exercises);

export const dayExerciseCount = (d: Day): number => dayExercises(d).length;

export const daySetCount = (d: Day): number => dayExercises(d).reduce((a, e) => a + e.sets, 0);

/** Упражнение необязательное само по себе или в группе «по желанию» */
export const isOptional = (d: Day, exId: string): boolean =>
  d.groups.some((g) => g.exercises.some((e) => e.id === exId && (e.optional || g.optional)));

const EX_INDEX = new Map<string, { ex: Exercise; day: Day }>();
for (const day of PROGRAM) for (const ex of dayExercises(day)) EX_INDEX.set(ex.id, { ex, day });

export const findExercise = (id: string) => EX_INDEX.get(id);

export const findDay = (id: string): Day | undefined => PROGRAM.find((d) => d.id === id);

export const dayIndex = (id: string): number => PROGRAM.findIndex((d) => d.id === id);

/** Цикл 1 → 2 → 3 → 4 → 1 */
export const nextDayId = (lastDayId: string | null | undefined): Day['id'] => {
  const i = lastDayId ? dayIndex(lastDayId) : -1;
  return PROGRAM[(i + 1) % PROGRAM.length]!.id;
};
