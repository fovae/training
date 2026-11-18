/*! Simple Training — exercise database: names, descriptions, technique and safety texts. © 2026 Fovae & Claude. All rights reserved. Not licensed for reuse (see LICENSE, Terms of Use §6). */
import type { Equipment, Muscle } from '../../types';

/**
 * Синонимы для поиска: как упражнение называют в зале, в видео, в приложениях, разговорно и со
 * сленгом. Пара строк на упражнение — [русский, английский], фразы через запятую. Опечатки и
 * словоформы сюда писать не нужно — их ловит сам поиск (src/data/search.ts).
 * Английские синонимы участвуют в поиске на всех языках (часто ищут «hammer curl», «pec deck»).
 */
export const ALIASES: Record<string, [ru: string, en: string]> = {
  // ---------- грудь ----------
  'incline-db-press': [
    'жим гантелей под углом, наклонный жим гантелей, жим на верх груди, жим гантелей на наклонке',
    'incline db press, incline dumbbell bench press, upper chest press',
  ],
  'flat-press': [
    'жим от груди, жим гантелей лежа, жим лежа в тренажере, горизонтальный жим',
    'flat dumbbell press, db bench press, chest press',
  ],
  'high-to-low-cable-fly': [
    'кроссовер, сведение в кроссовере, сведение рук в кроссовере сверху, кроссовер на низ груди',
    'cable crossover, crossover, cable fly, high cable fly, lower chest fly',
  ],
  'barbell-bench-press': [
    'жим лежа, жим от груди, жим штанги от груди, бенч, жим на горизонтальной скамье, жим лежа классический',
    'bench press, bench, flat bench, bb bench press',
  ],
  'incline-barbell-press': [
    'наклонный жим, жим под углом, жим штанги под углом, жим на верх груди, жим на наклонке',
    'incline bench press, incline bench, incline bb press',
  ],
  'db-fly': [
    'разводка, разводы, разводка лежа, разводка гантелей на горизонтальной скамье, бабочка с гантелями',
    'flyes, flys, dumbbell flyes, chest fly, flat fly',
  ],
  'pec-deck': [
    'бабочка, батерфляй, баттерфляй, пек дек, сведение рук в бабочке, сведения в тренажере',
    'butterfly, machine fly, chest fly machine, pec fly',
  ],
  'chest-dip': [
    'брусья, отжимания на брусьях на грудь, брусья на грудь, дипсы',
    'dips, parallel bar dips, chest dips',
  ],
  'push-up': [
    'отжимания, отжимания классические, отжимания упор лежа, отжимашки',
    'pushup, pushups, press up, press-ups',
  ],
  'incline-push-up': [
    'отжимания с упором на скамью, отжимания от лавки, отжимания с возвышения руками, легкие отжимания',
    'incline pushup, bench push-up, elevated push-up',
  ],
  'close-grip-push-up': [
    'узкие отжимания, отжимания на трицепс, отжимания узким хватом',
    'narrow push-up, triceps push-up, tricep pushups',
  ],
  'wide-push-up': ['широкие отжимания, отжимания широкой постановкой рук', 'wide grip push-up, wide pushups'],
  'knee-push-up': [
    'отжимания на коленях, женские отжимания, облегченные отжимания',
    'kneeling push-up, modified push-up, girl push-up',
  ],
  'decline-push-up': [
    'отжимания ноги на скамье, отжимания с ногами на скамье, отжимания с наклоном вниз',
    'decline pushup, feet elevated pushups',
  ],
  'diamond-push-up': [
    'отжимания алмаз, ромбовидные отжимания, отжимания треугольником, отжимания на трицепс',
    'diamond pushups, triangle push-up',
  ],
  'pause-push-up': ['отжимания с задержкой, медленные отжимания', 'paused push-up, pause pushups'],
  'archer-push-up': ['лучник, отжимания лучником', 'archer pushups'],
  'clap-push-up': [
    'отжимания с хлопком, хлопковые отжимания, плиометрические отжимания',
    'clap push-up, plyo push-up, plyometric pushups',
  ],
  'incline-db-fly': [
    'разводка под углом, наклонная разводка, разводка на верх груди',
    'incline fly, incline flyes',
  ],
  'decline-bench-press': [
    'жим вниз головой, жим под отрицательным углом, жим на низ груди',
    'decline press, decline bench',
  ],
  'db-floor-press': ['жим лежа на полу, жим с пола, флор пресс', 'floor press, dumbbell floor bench'],
  'low-to-high-cable-fly': [
    'кроссовер снизу, сведение в кроссовере снизу вверх, кроссовер на верх груди',
    'low cable fly, upward cable fly, crossover',
  ],
  'machine-chest-press': [
    'жим от груди, жим в тренажере сидя, жим от груди сидя, хаммер жим',
    'chest press machine, seated chest press, hammer strength press',
  ],
  'incline-machine-press': [
    'наклонный жим в тренажере, жим на верх груди в тренажере, хаммер наклонный',
    'incline chest press machine, incline hammer press',
  ],
  'db-squeeze-press': [
    'жим со сведением гантелей, жим гантелей вместе, сжимающий жим',
    'squeeze press, crush press, hex press',
  ],

  // ---------- спина ----------
  'lat-pulldown': [
    'тяга верхнего блока, верхняя тяга, вертикальная тяга, тяга сверху, тяга к груди, тяга блока на спину, верхний блок',
    'pulldown, lat pull down, cable pulldown, wide pulldown',
  ],
  'seated-cable-row': [
    'горизонтальная тяга, тяга нижнего блока, тяга сидя, гребная тяга, тяга к поясу на блоке, нижний блок',
    'cable row, seated row, low row',
  ],
  'chest-supported-db-row': [
    'тяга лежа на скамье, тяга гантелей лежа на наклонной, тяга с упором на скамью',
    'incline db row, chest supported row, seal row',
  ],
  deadlift: [
    'становая, становуха, станова, становая классика, классическая тяга',
    'dl, conventional deadlift, barbell deadlift',
  ],
  'romanian-deadlift': [
    'румынка, румынская становая, тяга на прямых ногах, мертвая тяга, рдл',
    'rdl, stiff leg deadlift, sldl',
  ],
  'barbell-row': [
    'тяга штанги к поясу, тяга в наклоне, тяга штанги к животу, наклонная тяга',
    'bent over row, bb row, bent-over barbell row',
  ],
  'one-arm-db-row': [
    'тяга гантели в наклоне, тяга гантели к поясу, тяга одной рукой с упором в скамью',
    'single arm dumbbell row, one arm row, db row, kroc row',
  ],
  't-bar-row': ['тяга т-штанги, тяга т грифа, т-тяга, тяга ти бар', 'tbar row, t bar, landmine row'],
  'pull-up': [
    'подтягивания, подтягивания на турнике, подтяги, подтягивания широким хватом',
    'pullups, pull ups, overhand pull-up',
  ],
  'chin-up': [
    'подтягивания на бицепс, обратные подтягивания, подтягивания обратным хватом',
    'chinups, chin ups, underhand pull-up',
  ],
  'assisted-pull-up': [
    'гравитрон, подтягивания с поддержкой, подтягивания в тренажере, подтягивания с резинкой',
    'gravitron, assisted chin-up, machine assisted pull-up, band assisted pull-up',
  ],
  'close-grip-pulldown': [
    'узкая тяга верхнего блока, тяга к груди узким хватом, тяга v рукояти',
    'close grip lat pulldown, v bar pulldown, narrow pulldown',
  ],
  'straight-arm-pulldown': [
    'пуловер на блоке, тяга прямыми руками, прямые руки на блоке',
    'straight arm pushdown, cable pullover, lat prayer',
  ],
  'inverted-row': [
    'австралийские подтягивания, австралийка, подтягивания лежа, низкие подтягивания',
    'australian pull-up, body row, bodyweight row',
  ],
  'machine-row': [
    'тяга в тренажере, тяга сидя в тренажере, хаммер тяга, рычажная тяга',
    'seated machine row, hammer row, chest supported machine row',
  ],
  'db-pullover': ['пуловер, пулловер, пуловер лежа', 'pullover, dumbbell pull over'],
  'back-extension': [
    'гиперэкстензия, гипер, гиперка, разгибания спины, экстензия',
    'hyperextension, hyper, roman chair, back raise',
  ],
  'dead-hang': [
    'вис, висеть на турнике, вис на турнике, растяжка спины на турнике',
    'hang, bar hang, passive hang',
  ],
  'neutral-grip-pull-up': [
    'подтягивания параллельным хватом, подтягивания на параллельных ручках',
    'neutral pull-up, parallel grip pull-up, hammer grip pull-up',
  ],
  'wide-grip-pull-up': [
    'широкие подтягивания, подтягивания широким хватом за голову',
    'wide pull-up, wide grip pullups',
  ],
  'negative-pull-up': [
    'негативы, негативные повторения, медленное опускание на турнике',
    'negatives, eccentric pull-up',
  ],
  'scapular-pull-up': [
    'лопаточные подтягивания, сведение лопаток в висе, шраги в висе',
    'scap pull-up, scapula pull up',
  ],
  'feet-elevated-inverted-row': [
    'австралийские подтягивания ноги на опоре, сложные австралийские подтягивания',
    'elevated inverted row, feet up body row',
  ],
  'wide-grip-pulldown': [
    'широкая тяга верхнего блока, тяга к груди широким хватом',
    'wide pulldown, wide lat pull down',
  ],
  'reverse-grip-pulldown': [
    'тяга верхнего блока обратным хватом, тяга к груди обратным хватом',
    'reverse grip lat pulldown, supinated pulldown, chin-up pulldown',
  ],
  'single-arm-pulldown': [
    'тяга верхнего блока одной рукой, одноручная тяга сверху',
    'one arm pulldown, single arm lat pulldown',
  ],
  'pendlay-row': ['тяга пендли, тяга от пола в наклоне, взрывная тяга штанги', 'pendlay, dead stop row'],
  'db-bent-over-row': [
    'тяга двух гантелей в наклоне, тяга гантелей к поясу',
    'dumbbell row, bent over db row, two arm dumbbell row',
  ],
  'kettlebell-row': ['тяга гири в наклоне, тяга гири к поясу', 'kb row, one arm kettlebell row'],
  'single-arm-cable-row': [
    'тяга нижнего блока одной рукой, одноручная горизонтальная тяга',
    'one arm cable row, single arm seated row',
  ],
  'band-row': [
    'тяга резинки к поясу, тяга эспандера сидя, гребля с резинкой',
    'resistance band row, band seated row',
  ],
  'rack-pull': [
    'частичная становая, тяга с упоров, тяга с блоков, становая с плинтов',
    'block pull, partial deadlift, rack deadlift',
  ],
  'good-morning': [
    'гудморнинг, гуд монинг, наклоны со штангой, наклоны со штангой на плечах',
    'goodmorning, good mornings, barbell good morning',
  ],
  'sumo-deadlift': ['сумо, становая сумо, тяга сумо, сумо тяга', 'sumo dl, sumo pull'],
  superman: [
    'супермен лежа, лодочка на животе, разгибание спины на полу',
    'superman hold, prone back extension',
  ],

  // ---------- руки ----------
  'rope-pushdown': [
    'разгибания с канатом, канат на трицепс, разгибание рук на блоке, трицепс на блоке, жим вниз на блоке',
    'triceps pushdown, tricep rope pushdown, cable pushdown, rope extension',
  ],
  'overhead-cable-extension': [
    'французский жим на блоке, разгибания из-за головы с канатом, трицепс из-за головы на блоке',
    'overhead triceps extension, cable french press, overhead rope extension',
  ],
  'single-arm-pushdown': [
    'разгибание одной рукой на блоке, трицепс одной рукой',
    'one arm pushdown, single arm tricep pushdown',
  ],
  'incline-db-curl': [
    'сгибания лежа на наклонной, бицепс на наклонной скамье, подъем гантелей на бицепс сидя под углом',
    'incline curl, incline bicep curl',
  ],
  'preacher-curl': [
    'скотт, скамья скотта, парта, бицепс на парте, сгибания на парте, сгибания в тренажере на бицепс',
    'scott curl, preacher, machine bicep curl',
  ],
  'hammer-curl': [
    'молотки, молот, молоток, хаммер, молотковый подъем, сгибания нейтральным хватом, бицепс молотком',
    'hammers, neutral grip curl, hammer curls',
  ],
  'wrist-curl': [
    'сгибание запястий, кисти, предплечья, сгибания кистей со штангой, запястья',
    'forearm curl, wrist curls',
  ],
  'reverse-wrist-curl': [
    'разгибание запястий, обратные сгибания кистей, разгибатели предплечья',
    'reverse forearm curl, wrist extension',
  ],
  'barbell-curl': [
    'бицепс со штангой, подъем штанги на бицепс стоя, сгибания со штангой, штанга на бицепс',
    'bicep curl, bb curl, standing barbell curl',
  ],
  'db-curl': [
    'бицепс с гантелями, подъем гантелей стоя, сгибания с гантелями, гантели на бицепс',
    'bicep curl, dumbbell bicep curl, db curl, alternating curl',
  ],
  'cable-curl': [
    'бицепс на блоке, сгибания на нижнем блоке, подъем на бицепс на блоке',
    'cable bicep curl, low cable curl',
  ],
  'concentration-curl': [
    'концентрированные сгибания, бицепс с упором в бедро, подъем гантели сидя на бицепс',
    'concentration bicep curl, seated concentration curl',
  ],
  'reverse-curl': [
    'обратный хват на бицепс, сгибания обратным хватом, обратные сгибания',
    'reverse grip curl, overhand curl',
  ],
  'skull-crusher': [
    'французский жим, французский жим со штангой, французский жим лежа, черепок, трицепс лежа',
    'skullcrusher, skull crushers, lying triceps extension, french press',
  ],
  'close-grip-bench-press': [
    'узкий жим, жим узким хватом, жим лежа на трицепс',
    'close grip bench, cgbp, narrow bench press',
  ],
  'bench-dip': [
    'обратные отжимания, отжимания от скамьи сзади, отжимания на трицепс от лавки',
    'reverse dips, chair dips, bench dips',
  ],
  'overhead-db-extension': [
    'французский жим стоя, французский жим сидя, французский жим с гантелью, разгибание гантели над головой',
    'overhead tricep extension, dumbbell french press, seated overhead extension',
  ],
  'triceps-kickback': [
    'кикбэк, кик бэк, разгибание руки с гантелью в наклоне, отведение руки назад',
    'kickback, dumbbell kickback, tricep kickbacks',
  ],
  'ez-bar-curl': [
    'изогнутый гриф на бицепс, бицепс с изогнутым грифом, подъем ez штанги',
    'ez curl, curl bar curl, ez bar bicep curl',
  ],
  'spider-curl': ['паук, паучьи сгибания, сгибания лежа на животе', 'spider curls, prone incline curl'],
  'barbell-spider-curl': [
    'паук со штангой, сгибания паук со штангой',
    'barbell spider curls, prone barbell curl',
  ],
  'cross-body-hammer-curl': [
    'молотки к груди, молотки поперек, молоток к противоположному плечу, перекрестные молотки',
    'cross body curl, cross hammer curl, pinwheel curl',
  ],
  'zottman-curl': ['зоттман, сгибания зотмана', 'zottman curls'],
  'band-curl': [
    'бицепс с резинкой, сгибания с эспандером, бицепс с эспандером',
    'resistance band curl, band bicep curl',
  ],
  'rope-hammer-curl': [
    'молотки на блоке, канат на бицепс, молотковые сгибания с канатом',
    'rope curl, cable hammer curl, rope hammer',
  ],
  'bayesian-cable-curl': [
    'байесовские сгибания, бицепс на блоке из-за спины, байесиан',
    'bayesian curl, behind the back cable curl',
  ],
  'straight-bar-pushdown': [
    'разгибания с прямой рукоятью, жим вниз с прямым грифом, трицепс на блоке с прямой ручкой',
    'bar pushdown, straight bar tricep pushdown',
  ],
  'reverse-grip-pushdown': [
    'разгибания обратным хватом, трицепс обратным хватом на блоке',
    'reverse pushdown, underhand pushdown',
  ],
  'db-skull-crusher': [
    'французский жим гантелями лежа, французский жим с гантелями лежа, черепок с гантелями',
    'dumbbell skullcrusher, db skull crusher, dumbbell french press lying',
  ],
  'triceps-dip': [
    'брусья на трицепс, отжимания на брусьях прямо, дипсы на трицепс',
    'dips, tricep dips, parallel bar dip',
  ],
  'band-pushdown': [
    'разгибания с резинкой, трицепс с эспандером, трицепс с резинкой',
    'resistance band pushdown, band tricep extension',
  ],
  'cable-triceps-kickback': [
    'кикбэк на блоке, отведение руки назад на блоке',
    'cable kickback, cable tricep kickback',
  ],
  'behind-back-wrist-curl': [
    'сгибание кистей за спиной, запястья за спиной, предплечья со штангой за спиной',
    'behind the back wrist curl, standing wrist curl',
  ],

  // ---------- плечи ----------
  'seated-shoulder-press': [
    'жим сидя, жим на плечи, армейский жим сидя, жим гантелей над головой сидя, жим вверх сидя',
    'shoulder press, seated db press, dumbbell shoulder press, ohp seated',
  ],
  'lateral-raise': [
    'махи в стороны, махи гантелями, разведения в стороны, боковые подъемы, махи на средние дельты, махи на плечи',
    'side raise, lateral raises, side lateral, lat raise',
  ],
  'reverse-pec-deck': [
    'обратные разведения в тренажере, обратная бабочка, разведения на задние дельты в тренажере',
    'rear delt fly machine, reverse fly, rear delt machine',
  ],
  'db-shrug': ['шраги, шрагги, пожимания плечами, трапеция с гантелями', 'shrugs, dumbbell shrugs, db shrug'],
  'incline-y-raise': ['y подъемы, подъемы y лежа, разведения буквой y', 'y raise, prone y raise, incline y'],
  'overhead-press': [
    'армейский жим, жим стоя, жим штанги над головой, жим над головой, военный жим, жим на плечи стоя',
    'ohp, military press, standing press, barbell shoulder press, press',
  ],
  'bent-over-lateral-raise': [
    'махи в наклоне, разведения в наклоне, задняя дельта с гантелями, обратные разведения',
    'rear delt raise, bent over fly, reverse fly',
  ],
  'front-raise': [
    'подъемы перед собой, махи вперед, передние махи, подъем гантелей вперед',
    'front raises, front delt raise, dumbbell front raise',
  ],
  'upright-row': ['протяжка, тяга к подбородку, протяжка штанги', 'upright rows, barbell upright row'],
  'face-pull': [
    'фейспул, фейс пул, тяга к лицу, тяга каната к лицу на блоке',
    'facepull, face pulls, rope face pull',
  ],
  'arnold-press': ['арнольд, жим арнольда сидя', 'arnold dumbbell press'],
  'cable-lateral-raise': [
    'махи на блоке, махи в сторону в кроссовере, отведения на блоке',
    'cable side raise, single arm cable lateral',
  ],
  'band-external-rotation': [
    'ротация плеча, вращения плеча наружу, ротаторная манжета, разминка плеч с резинкой',
    'external rotation, rotator cuff, band shoulder rotation',
  ],
  'pike-push-up': [
    'отжимания уголком, отжимания на плечи, отжимания домиком, щучка',
    'pike pushup, pike press',
  ],
  'standing-db-press': [
    'жим гантелей над головой стоя, армейский жим гантелей стоя',
    'standing dumbbell shoulder press, standing db ohp',
  ],
  'machine-shoulder-press': [
    'жим на плечи в тренажере, жим над головой в тренажере, жим сидя в тренажере',
    'shoulder press machine, seated machine press',
  ],
  'landmine-press': [
    'жим мины, лэндмайн, жим штанги из угла, жим т грифа одной рукой',
    'landmine, single arm landmine press',
  ],
  'push-press': ['жимовой швунг, швунг, толчковый жим, жим с подседом', 'push presses, barbell push press'],
  'cable-rear-delt-fly': [
    'разведения на задние дельты на блоке, задняя дельта в кроссовере, обратный кроссовер',
    'reverse cable fly, rear delt cable fly, reverse crossover',
  ],
  'kettlebell-press': [
    'жим гири, жим гири над головой, жим гири стоя',
    'kb press, kettlebell shoulder press',
  ],
  'barbell-shrug': [
    'шраги, шраги со штангой, пожимания плечами со штангой',
    'shrugs, bb shrug, barbell shrugs',
  ],
  'cable-y-raise': ['y подъем на блоке, разведения буквой y на блоке', 'cable y, y raise cable'],
  'incline-t-raise': ['т подъемы, подъемы буквой t, разведения лежа на животе', 't raise, prone t raise'],

  // ---------- пресс и кор ----------
  'cable-crunch': [
    'скручивания на блоке, молитва, скручивания стоя на коленях, пресс на блоке',
    'rope crunch, kneeling crunch, cable abs',
  ],
  'hanging-knee-raise': [
    'подъем коленей, колени к груди в висе, пресс на турнике, подъемы коленей на брусьях, капитанский стул',
    'knee raise, captains chair, hanging knee tuck',
  ],
  'side-plank': ['боковая планка на локте, планка на боку', 'side bridge, lateral plank'],
  'pallof-press': [
    'паллоф, жим паллофа, антиротация, жим от груди на блоке стоя боком',
    'pallof, anti rotation press',
  ],
  'dead-bug': ['мертвый жук, жук, жучок, дэд баг', 'deadbug, dead bugs'],
  plank: ['планка на локтях, стойка в планке, упор на локтях', 'forearm plank, elbow plank, front plank'],
  'hanging-leg-raise': [
    'подъем ног на турнике, ноги на турнике, пресс в висе, подъемы прямых ног в висе',
    'leg raise, hanging leg raises, hlr',
  ],
  crunch: ['пресс, скручивания на пресс, качать пресс, кранчи', 'crunches, ab crunch, abs'],
  'reverse-crunch': ['обратный пресс, подъем таза лежа, нижний пресс', 'reverse crunches, lower ab crunch'],
  'russian-twist': [
    'повороты корпуса сидя, русский твист, твист, скручивания с поворотом сидя',
    'twists, russian twists, seated twist',
  ],
  'bird-dog': [
    'птица собака, супермен на четвереньках, вытяжение руки и ноги на четвереньках',
    'birddog, quadruped arm leg raise',
  ],
  'bicycle-crunch': [
    'велосипед на пресс, скручивания велосипед, локоть к колену',
    'bicycle, bicycle crunches, bicycles',
  ],
  'hollow-hold': [
    'лодочка, удержание лодочки, банан, лодочка лежа на спине',
    'hollow body hold, hollow body, dish hold',
  ],
  'cable-woodchop': [
    'дровосек, рубка дров, косые скручивания на блоке, вудчоп',
    'woodchop, wood chopper, cable chop',
  ],
  'high-plank': ['планка на руках, упор лежа, планка на прямых', 'straight arm plank, push-up plank'],
  'plank-shoulder-tap': ['касания плеч, планка с касанием плеча', 'shoulder taps, plank taps'],
  'plank-up-down': [
    'планка вверх вниз, планка с локтей на руки, ступеньки в планке',
    'up down plank, walking plank',
  ],
  'flutter-kicks': ['ножницы, ножницы лежа, ножницы на пресс', 'scissor kicks, flutters'],
  'lying-leg-raise': [
    'подъем ног лежа на полу, ноги вверх лежа, нижний пресс лежа',
    'leg raises, lying leg raises',
  ],
  'v-up': ['складка, складной нож, книжка, складки на пресс', 'v ups, jackknife, jack knife'],
  'sit-up': [
    'подъем туловища, подъемы корпуса, пресс классика, садиться из положения лежа',
    'situp, sit ups',
  ],
  'heel-touch': [
    'касания пяток лежа, косые касания пяток, дотягивания до пяток',
    'heel touches, alternating heel touch',
  ],
  'hollow-rock': ['лодочка качания, раскачивания в лодочке, качалка', 'hollow rocks, hollow body rock'],
  'bear-plank': ['медведь, удержание на четвереньках, планка на носках и руках', 'bear hold, hover plank'],
  'toes-to-bar': ['носки к перекладине, ноги к турнику, носки к турнику', 't2b, ttb, toes 2 bar'],
  'hanging-oblique-knee-raise': [
    'косые подъемы коленей, колени в сторону в висе, подъем коленей на косые',
    'oblique knee raise, hanging oblique raise',
  ],
  'decline-sit-up': [
    'пресс на скамье, скручивания на наклонной скамье, пресс на римском стуле, пресс вниз головой',
    'decline crunch, decline situp',
  ],
  'suitcase-carry': [
    'прогулка с чемоданом, чемодан, ходьба с гантелью в одной руке',
    'suitcase walk, single arm farmer carry',
  ],
  'copenhagen-plank': [
    'копенгаген, планка на приводящие, копенгагенская боковая планка',
    'copenhagen, copenhagen adductor plank',
  ],
  'reverse-plank': ['планка спиной вниз, планка лицом вверх', 'back plank, supine plank'],
  'l-sit': ['уголок на брусьях, уголок в упоре, удержание уголка', 'lsit, l sit hold'],
  'machine-crunch': ['пресс в тренажере, скручивания сидя в тренажере', 'ab machine, ab crunch machine'],

  // ---------- ноги ----------
  'leg-press': [
    'жим ногами, жим ногами в тренажере, платформа, жим платформы ногами, жим ногами лежа',
    'leg press machine, sled press',
  ],
  'leg-curl': [
    'сгибание ног, бицепс бедра, сгибания ног лежа, задняя поверхность бедра в тренажере',
    'hamstring curl, lying leg curl, leg curls',
  ],
  'calf-raise': [
    'икры, подъем на носки стоя, носки, подъемы на икры',
    'calf raises, standing calf raise, calves',
  ],
  'back-squat': [
    'присед, приседания, присед со штангой, приседания со штангой, классический присед, присяд',
    'squat, squats, barbell squat, back squats',
  ],
  'front-squat': [
    'фронтальный присед, присед со штангой на груди, фронталка',
    'front squats, barbell front squat',
  ],
  'goblet-squat': [
    'гоблет, присед с гантелью, присед с гирей, присед с гантелью у груди, кубковый присед',
    'goblet, dumbbell squat, kettlebell squat',
  ],
  'db-sumo-squat': [
    'сумо присед, плие, присед плие, приседания сумо с гантелью, широкий присед',
    'sumo squat, plie squat, wide squat',
  ],
  'bulgarian-split-squat': [
    'болгарка, болгарские выпады, болгарский сплит присед, выпад нога на скамье, болгарские приседания',
    'bulgarian, bss, rear foot elevated split squat, rfess',
  ],
  'db-lunge': [
    'выпады, выпады вперед, выпады на месте с гантелями',
    'lunges, dumbbell lunges, forward lunge',
  ],
  'walking-lunge': ['выпады в движении, шагающие выпады, выпады по залу', 'walking lunges, travelling lunge'],
  'leg-extension': [
    'разгибание ног, разгибания ног сидя, квадрицепс в тренажере, разгибатель',
    'leg extensions, quad extension',
  ],
  'seated-leg-curl': ['сгибание ног сидя в тренажере, бицепс бедра сидя', 'seated hamstring curl'],
  'glute-bridge': [
    'ягодичный мост, мостик, мост на ягодицы, подъем таза лежа, ягодичный подъем',
    'bridge, hip raise, glute bridges',
  ],
  'barbell-hip-thrust': [
    'хип траст, хиптраст, ягодичный мост со штангой, подъем таза со штангой, мост со штангой',
    'hip thrust, hip thrusts, glute thrust',
  ],
  'seated-calf-raise': [
    'икры сидя, подъемы на носки сидя в тренажере, камбаловидная',
    'seated calves, soleus raise',
  ],
  'step-up': ['зашагивания, степ ап, шаги на скамью, зашагивания на скамью', 'step ups, box step-up'],
  'hip-adduction': [
    'сведение ног, приводящие, внутренняя поверхность бедра, сведения ног сидя',
    'adduction machine, inner thigh machine, adductor machine',
  ],
  'hip-abduction': [
    'разведение ног, отводящие, разведения ног сидя, внешняя поверхность бедра',
    'abduction machine, outer thigh machine, abductor machine',
  ],
  'hack-squat': [
    'гакк, гак присед, хакк присед, гакк машина, гак-приседания',
    'hack, hack squats, hack machine',
  ],
  'db-romanian-deadlift': [
    'румынка с гантелями, румынская тяга гантелями, мертвая тяга с гантелями',
    'db rdl, dumbbell rdl',
  ],
  'single-leg-rdl': [
    'румынка на одной ноге, становая на одной ноге, ласточка с гантелью, тяга на одной ноге',
    'single leg deadlift, sl rdl, one leg rdl',
  ],
  'wall-sit': ['стульчик, стул у стены, статический присед у стены, стенка', 'wall squat, wall chair'],
  'lateral-band-walk': [
    'ходьба с резинкой в сторону, боковая ходьба с резинкой, приставные шаги с резинкой, крабик',
    'monster walk, band walk, side band walk',
  ],
  'cable-kickback': [
    'отведение ноги на блоке, мах ногой назад на блоке, ягодицы на блоке, кикбэк ногой',
    'glute kickback, cable glute kickback',
  ],
  'air-squat': [
    'приседания без отягощения, приседания с собственным весом, присед дома',
    'bodyweight squat, squats',
  ],
  'jump-squat': ['выпрыгивания, присед с прыжком, прыжковые приседания', 'squat jumps, jump squats'],
  'reverse-lunge': ['обратные выпады, выпады назад на месте, шаг назад', 'reverse lunges, backward lunge'],
  'lateral-lunge': ['выпады в сторону, боковой выпад', 'lateral lunges, side lunges'],
  'curtsy-lunge': ['реверанс, перекрестные выпады, выпад крестом', 'curtsy lunges, crossover lunge'],
  'split-squat': ['сплит, статические выпады, выпады на месте', 'split squats, static lunge'],
  'barbell-reverse-lunge': [
    'выпады со штангой, обратные выпады со штангой',
    'barbell lunges, bb reverse lunge',
  ],
  'step-down': ['спуск с платформы, шаг вниз со ступеньки', 'step downs, eccentric step down'],
  'single-leg-glute-bridge': [
    'мостик на одной ноге, ягодичный мост одной ногой',
    'single leg bridge, one leg glute bridge',
  ],
  'db-hip-thrust': [
    'хип траст с гантелью, хиптраст с гантелью, мостик с гантелью',
    'dumbbell hip thrust, db thrust',
  ],
  'kettlebell-deadlift': ['становая с гирей, тяга гири от пола', 'kb deadlift, kettlebell dl'],
  'nordic-curl': [
    'нордики, нордические сгибания ног, скандинавские сгибания, обратные гиперэкстензии на коленях',
    'nordics, nordic hamstring curl, nhc',
  ],
  'donkey-kick': [
    'махи ногой назад, отведение ноги назад на четвереньках, ослик, кикбэк на полу',
    'donkey kicks, quadruped kickback',
  ],
  'fire-hydrant': [
    'пожарный гидрант, отведение колена в сторону, собачка',
    'fire hydrants, hip abduction quadruped',
  ],
  clamshell: ['ракушка, раскладушка лежа на боку, раскрытие колен', 'clamshells, clam, clams'],
  'single-leg-calf-raise': [
    'икры на одной ноге, подъем на носок одной ногой',
    'single leg calf raises, one leg calf raise',
  ],
  'tibialis-raise': [
    'передняя большеберцовая, подъемы носков, голень спереди',
    'tib raise, tibialis anterior raise',
  ],
  'leg-press-calf-raise': [
    'икры в жиме ногами, носки в платформе, икры в платформе',
    'calf press, leg press calf press',
  ],
  'cossack-squat': ['казак, казачьи приседания, боковой присед', 'cossack squats, side squat'],
  'cable-pull-through': [
    'протяжка между ног, тяга между ног на блоке, пул тру',
    'pull through, pull-through',
  ],
  'assisted-pistol-squat': [
    'пистолетик, пистолет, присед пистолетиком с опорой, присед на одной ноге',
    'pistol squat, assisted pistol, single leg squat',
  ],

  // ---------- кардио и функционал ----------
  'kettlebell-swing': [
    'махи гирей, свинг, свинги, мах гирей двумя руками',
    'kb swing, swings, russian swing',
  ],
  'kettlebell-push-press': ['толчок гири, толчковый жим гири, швунг гири', 'kb push press'],
  burpee: ['берпи, бурпи, барпи, упор присев с прыжком', 'burpees, burpies'],
  'jump-rope': ['скакалка, прыжки через скакалку, прыгалки', 'skipping, skipping rope, jumping rope'],
  'rowing-machine': ['гребля, гребной, гребной тренажер, греблю, концепт', 'rower, rowing, erg, concept2'],
  'treadmill-walk': [
    'ходьба, беговая дорожка, дорожка, ходьба на беговой дорожке',
    'treadmill, walking, brisk walk',
  ],
  'stationary-bike': [
    'велик, велотренажер, велосипед, крутить педали',
    'bike, exercise bike, cycling, spin bike',
  ],
  'farmer-carry': [
    'прогулка фермера, фермерская прогулка, ходьба с гантелями, переноска гантелей',
    'farmers walk, farmer walk, loaded carry',
  ],
  'mountain-climber': ['альпинист, скалолаз, бег в планке, бег в упоре лежа', 'mountain climbers, climbers'],
  'jumping-jack': [
    'джампинг джек, прыжки звездочка, прыжки ноги вместе ноги врозь, звездочка, разножка',
    'jumping jacks, star jumps',
  ],
  'high-knees': [
    'высокие колени, бег на месте с высоким подниманием колен, колени вверх',
    'high knee run, running in place',
  ],
  'butt-kicks': ['захлест, захлест голени, бег с захлестом', 'butt kickers, heel flicks'],
  'skater-jump': [
    'конькобежец, прыжки в сторону, конькобежные прыжки',
    'skaters, skater hops, lateral bounds',
  ],
  'squat-thrust': ['упор присев упор лежа, полуберпи, берпи без прыжка', 'squat thrusts, half burpee'],
  'box-jump': [
    'прыжки на тумбу, запрыгивания на ящик, прыжки на ящик, бокс джамп',
    'box jumps, plyo box jump',
  ],
  'shadow-boxing': ['бокс, бой с тенью, удары руками в воздух', 'shadowboxing, boxing'],
  'stair-climber': [
    'лестница, степпер, ступеньки, лестничный тренажер',
    'stairmaster, stair master, stepmill, stair stepper',
  ],
  elliptical: [
    'эллипс, эллипсоид, орбитрек, эллиптический тренажер',
    'elliptical trainer, cross trainer, orbitrek',
  ],
  'treadmill-jog': [
    'бег, бег на дорожке, пробежка, беговая дорожка',
    'treadmill, running, jogging, treadmill run',
  ],
  'incline-treadmill-walk': [
    'ходьба в горку, ходьба под наклоном, дорожка с наклоном, 12 3 30',
    'incline walk, 12-3-30, treadmill hill walk',
  ],
  'ski-erg': ['лыжи, лыжный эргометр, скиэрг', 'skierg, ski machine'],
  'bear-crawl': ['ходьба медведем, медведь, ползание на четвереньках', 'bear crawls, bear walk'],
  'db-thruster': [
    'трастер, трастеры, присед с жимом, присед и жим гантелей',
    'thruster, thrusters, squat to press',
  ],
  'kettlebell-clean': [
    'взятие гири на грудь, подъем гири на грудь, клин гири',
    'kb clean, kettlebell cleans',
  ],
  'double-under': ['двойные прыжки, двойка через скакалку, дабл андер', 'double unders, du'],

  // ---------- растяжка и мобильность ----------
  'cat-cow': ['кошка, кошка корова, кошечка, прогибы на четвереньках', 'cat cow stretch, cat camel'],
  'hip-flexor-stretch': [
    'растяжка подвздошной мышцы, растяжка паха на колене, растяжка бедра спереди',
    'kneeling hip flexor, hip flexor lunge stretch, psoas stretch',
  ],
  'hamstring-stretch': [
    'наклон к ногам сидя, растяжка бицепса бедра, растяжка задней поверхности, складка сидя',
    'seated forward bend, hamstring stretches, sit and reach',
  ],
  'thoracic-rotation': [
    'ротация грудного отдела, раскрытие груди на четвереньках, повороты корпуса на четвереньках',
    't spine rotation, thoracic rotations, quadruped rotation',
  ],
  'band-pull-apart': [
    'растягивание резинки, разведение эспандера, резинка перед грудью',
    'pull aparts, band pull aparts',
  ],
  'childs-pose': ['поза ребенка, баласана, отдых на коленях', 'child pose, balasana'],
  'doorway-chest-stretch': [
    'растяжка грудных, растяжка груди у двери, растяжка в дверях',
    'chest stretch, door stretch, pec stretch',
  ],
  'calf-stretch': [
    'растяжка икр, растяжка голени у стены, растяжка икроножных',
    'calf stretches, standing calf stretch',
  ],
  'arm-circles': ['вращения руками, круги руками, мельница, разминка плеч', 'arm circle, shoulder circles'],
  'figure-four-stretch': [
    'четверка, растяжка ягодиц лежа, растяжка грушевидной мышцы, нога на ногу лежа',
    'figure 4 stretch, piriformis stretch, glute stretch',
  ],
  'quad-stretch': [
    'растяжка квадрицепса, растяжка передней поверхности бедра, пятка к ягодице',
    'quadriceps stretch, standing quad',
  ],
  'leg-swing': [
    'махи ногами, махи ногой вперед назад, махи ногой в сторону',
    'leg swings, dynamic leg swing',
  ],
  'downward-dog': [
    'собака мордой вниз, собака вниз, домик, треугольник, адхо мукха',
    'down dog, downward facing dog',
  ],
  'cobra-stretch': ['кобра, поза кобры, прогиб лежа на животе', 'cobra pose, cobra stretch'],
  'low-lunge': ['низкий выпад, выпад на колене, анджанейасана', 'low lunge stretch, anjaneyasana'],
  'warrior-ii': ['воин 2, воин два, поза воина, вирабхадрасана', 'warrior 2, warrior two, virabhadrasana'],
  'tree-pose': ['дерево, поза дерева, врикшасана, баланс на одной ноге', 'tree, vrksasana'],
  'pigeon-stretch': ['голубь, поза голубя, растяжка ягодиц голубь', 'pigeon pose, pigeon'],
  'butterfly-stretch': [
    'бабочка, бабочка сидя, растяжка паха, стопы вместе колени в стороны',
    'butterfly, groin stretch, bound angle',
  ],
  'standing-forward-fold': [
    'наклон к ногам стоя, наклон вперед, складка стоя, достать пол',
    'forward fold, toe touch, uttanasana',
  ],
  'worlds-greatest-stretch': [
    'лучшая растяжка в мире, выпад со скручиванием, спайдермен с поворотом',
    'worlds greatest stretch, wgs, spiderman lunge with rotation',
  ],
  'hip-90-90': ['90 90, растяжка 90 на 90, переключения бедер сидя', '90 90, 90-90, hip switches'],
  'hip-circles': [
    'вращения тазом, круги бедрами, вращение бедра на четвереньках',
    'hip circle, hip rotations',
  ],
  'ankle-circles': [
    'вращения голеностопа, разминка стоп, вращения ступней',
    'ankle rotation, ankle mobility',
  ],
  'cross-body-shoulder-stretch': [
    'растяжка плеча, рука поперек груди, растяжка задней дельты',
    'shoulder stretch, cross arm stretch',
  ],
  'overhead-triceps-stretch': [
    'растяжка трицепса, рука за голову, растяжка трицепса за голову',
    'triceps stretch, tricep stretch',
  ],
  inchworm: ['гусеница, шагающая гусеница, проходка руками в планку', 'inchworms, walkout, walk out'],
  'thread-the-needle': [
    'нитка в иголку, продевание нити, скручивание на четвереньках',
    'thread the needle stretch',
  ],
  'open-book': [
    'книга, открытая книга лежа на боку, раскрытие грудного отдела',
    'open book stretch, side lying rotation',
  ],
  'wall-slide': ['скольжение по стене, ангелы у стены, слайды по стене', 'wall slides, wall angels'],
  'band-pass-through': [
    'выкруты, выкрут с резинкой, выкруты с палкой, перевод палки за спину',
    'pass through, dislocates, shoulder dislocates',
  ],
  'deep-squat-hold': [
    'глубокий присед, сидеть в приседе, азиатский присед, удержание в приседе',
    'deep squat, squat hold, asian squat',
  ],
  'lying-spinal-twist': [
    'скрутка лежа, скручивание позвоночника лежа, скрутка на спине',
    'spinal twist, supine twist',
  ],
  'kettlebell-halo': ['гало, нимб, гиря вокруг головы', 'halo, kb halo'],
  'wrist-mobility': [
    'разминка кистей, вращения кистями, суставная разминка рук',
    'wrist warm up, wrist circles',
  ],
};

/**
 * Синонимы мышц и инвентаря для поиска: «бицуха», «ноги», «спина», «турник», «лавка»…
 * Подставляются к названию группы/инвентаря на языке интерфейса (у основных мышц — с большим весом).
 */
export const TAG_SYNONYMS: Record<Muscle | Equipment, [ru: string, en: string]> = {
  chest: ['грудь, грудные, грудак, грудные мышцы', 'chest, pecs, pectorals'],
  lats: ['спина, широчайшие, крылья, ширина спины', 'back, lats, wings, latissimus'],
  'upper-back': ['спина, верх спины, ромбовидные, толщина спины', 'back, upper back, rhomboids, mid back'],
  traps: ['трапеция, трапы, трапеции, шея, спина', 'traps, trapezius, neck, back'],
  'front-delts': [
    'плечи, дельты, передняя дельта, передние дельты',
    'shoulders, delts, front delt, anterior delt',
  ],
  'side-delts': [
    'плечи, дельты, средняя дельта, боковая дельта',
    'shoulders, delts, side delt, lateral delt',
  ],
  'rear-delts': [
    'плечи, дельты, задняя дельта, задние дельты',
    'shoulders, delts, rear delt, posterior delt',
  ],
  biceps: ['руки, бицепс, бицуха, бицушка, банки', 'arms, biceps, bis, guns'],
  triceps: ['руки, трицепс, трицуха, трехглавая', 'arms, triceps, tris'],
  forearms: ['предплечья, кисти, запястья, хват', 'forearms, grip, wrists'],
  abs: ['пресс, живот, кубики, брюшной пресс', 'abs, core, six pack, stomach, belly'],
  obliques: ['косые, бока, талия, косые мышцы живота', 'obliques, sides, waist, love handles'],
  'deep-core': ['кор, корпус, мышцы кора, стабилизаторы', 'core, stability, stabilizers'],
  'lower-back': [
    'поясница, низ спины, разгибатели спины, спина',
    'lower back, low back, erectors, spinal erectors, back',
  ],
  'hip-flexors': ['сгибатели бедра, подвздошная, пах', 'hip flexors, psoas, iliopsoas'],
  quads: ['ноги, квадрицепс, квадры, передняя поверхность бедра, бедра', 'legs, quads, quadriceps, thighs'],
  hamstrings: [
    'ноги, бицепс бедра, задняя поверхность бедра, задняя цепь',
    'legs, hamstrings, hams, posterior chain',
  ],
  glutes: ['ягодицы, попа, булки, ягодичные мышцы, ноги', 'glutes, butt, booty, bum, legs'],
  adductors: ['приводящие, внутренняя поверхность бедра, пах, ноги', 'adductors, inner thighs, groin, legs'],
  abductors: [
    'отводящие, внешняя поверхность бедра, средняя ягодичная',
    'abductors, outer thighs, glute medius',
  ],
  calves: ['икры, голень, икроножные, ноги', 'calves, calf, lower legs'],
  bodyweight: [
    'собственный вес, без инвентаря, без оборудования, дома, свой вес, воркаут',
    'bodyweight, no equipment, home, calisthenics',
  ],
  dumbbell: ['гантели, гантеля, гантелька', 'dumbbells, db'],
  barbell: ['штанга, гриф, со штангой', 'barbell, bb'],
  machine: ['тренажер, в тренажере, машина', 'machine'],
  cable: ['блок, кроссовер, тросовый, на блоке, трос', 'cable, pulley, crossover'],
  kettlebell: ['гиря, гири', 'kettlebell, kb'],
  band: ['резинка, эспандер, лента, жгут', 'band, resistance band, elastic'],
  bench: ['скамья, лавка, скамейка', 'bench'],
  'pullup-bar': ['турник, перекладина', 'pull-up bar, chin-up bar, bar'],
  'dip-station': ['брусья', 'dip station, dip bars, parallel bars'],
  'jump-rope': ['скакалка', 'jump rope, skipping rope'],
};
