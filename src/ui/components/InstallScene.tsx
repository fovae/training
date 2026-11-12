import { createContext, type ComponentChildren } from 'preact';
import { useContext, useId } from 'preact/hooks';

/** Уникальные id для marker/clipPath — на странице несколько сцен */
const Uid = createContext('sc');

/**
 * Схематичные сцены установки. Свои рисунки в стиле схем упражнений: условный телефон,
 * общие формы значков (квадрат со стрелкой, три точки, плюс в квадрате). Никакого текста
 * внутри SVG — подписи только в HTML, чтобы переводить на любой язык. Цвета — токены темы.
 */

export type SceneId =
  | 'ios-menu'
  | 'ios-page-menu'
  | 'ios-share-bar'
  | 'ios-share-sheet'
  | 'ios-add'
  | 'home'
  | 'android-menu'
  | 'android-item'
  | 'android-confirm'
  | 'open-browser';

// Экран телефона: x 46..154, y 14..246
const S = { x: 46, y: 14, w: 108, h: 232 };

/** Строки «текста» страницы — серые полоски */
function Lines({ y, n, x = S.x + 10, w = 88 }: { y: number; n: number; x?: number; w?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          class="sc-line"
          x={x}
          y={y + i * 11}
          width={i % 3 === 2 ? w * 0.6 : w}
          height="5"
          rx="2.5"
        />
      ))}
    </>
  );
}

/** Подсветка: пульсирующее кольцо и стрелка к элементу */
function Ring({
  cx,
  cy,
  r = 11,
  from = 'left',
}: {
  cx: number;
  cy: number;
  r?: number;
  from?: 'left' | 'right' | 'top' | 'bottom';
}) {
  const a =
    from === 'left'
      ? `M${cx - r - 26} ${cy - 18} Q${cx - r - 14} ${cy - 2} ${cx - r - 4} ${cy}`
      : from === 'right'
        ? `M${cx + r + 26} ${cy - 18} Q${cx + r + 14} ${cy - 2} ${cx + r + 4} ${cy}`
        : from === 'top'
          ? `M${cx - 18} ${cy - r - 26} Q${cx - 4} ${cy - r - 14} ${cx} ${cy - r - 4}`
          : `M${cx - 22} ${cy + r + 24} Q${cx - 4} ${cy + r + 16} ${cx} ${cy + r + 4}`;
  const uid = useContext(Uid);
  return (
    <g class="sc-hl-g">
      <circle class="sc-ring" cx={cx} cy={cy} r={r} />
      <circle class="sc-ring sc-pulse" cx={cx} cy={cy} r={r} />
      <path class="sc-arrow" d={a} marker-end={`url(#${uid}-head)`} />
    </g>
  );
}

function Phone({ children, label }: { children: ComponentChildren; label?: string | undefined }) {
  const uid = useId().replace(/[^\w-]/g, '');
  return (
    <svg
      class="scene"
      viewBox="0 0 200 260"
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <marker
          id={`${uid}-head`}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path class="sc-head" d="M0 0 L10 5 L0 10 z" />
        </marker>
        <clipPath id={`${uid}-clip`}>
          <rect x={S.x} y={S.y} width={S.w} height={S.h} rx="13" />
        </clipPath>
      </defs>
      <rect class="sc-phone" x="40" y="8" width="120" height="244" rx="19" />
      <g clip-path={`url(#${uid}-clip)`}>
        <rect class="sc-screen" x={S.x} y={S.y} width={S.w} height={S.h} />
        <Uid.Provider value={uid}>{children}</Uid.Provider>
      </g>
      <rect class="sc-notch" x="85" y="18" width="30" height="8" rx="4" />
    </svg>
  );
}

// ---------- значки (общие формы) ----------

const ShareIcon = ({ x, y, hl }: { x: number; y: number; hl?: boolean }) => (
  <g class={hl ? 'sc-icon hl' : 'sc-icon'} transform={`translate(${x - 6} ${y - 7})`}>
    <path d="M3 5 H1.5 V14 H10.5 V5 H9" />
    <path d="M6 9 V0.5 M3 3.5 L6 0.5 L9 3.5" />
  </g>
);
const Dots = ({ x, y, vertical, hl }: { x: number; y: number; vertical?: boolean; hl?: boolean }) => (
  <g class={hl ? 'sc-dots hl' : 'sc-dots'}>
    {[-5, 0, 5].map((d) => (
      <circle key={d} cx={vertical ? x : x + d} cy={vertical ? y + d : y} r="1.7" />
    ))}
  </g>
);
const PlusSquare = ({ x, y, hl }: { x: number; y: number; hl?: boolean }) => (
  <g class={hl ? 'sc-icon hl' : 'sc-icon'} transform={`translate(${x - 6} ${y - 6})`}>
    <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" />
    <path d="M6 3 V9 M3 6 H9" />
  </g>
);
const Chevron = ({ x, y, left }: { x: number; y: number; left?: boolean }) => (
  <path
    class="sc-icon"
    d={
      left
        ? `M${x + 2} ${y - 4} L${x - 2} ${y} L${x + 2} ${y + 4}`
        : `M${x - 2} ${y - 4} L${x + 2} ${y} L${x - 2} ${y + 4}`
    }
  />
);
const AppIcon = ({ x, y, s = 18, accent }: { x: number; y: number; s?: number; accent?: boolean }) => (
  <g>
    <rect class={accent ? 'sc-app accent' : 'sc-app'} x={x} y={y} width={s} height={s} rx={s * 0.24} />
    {accent && (
      <path
        class="sc-app-mark"
        d={`M${x + s * 0.22} ${y + s * 0.5} H${x + s * 0.78} M${x + s * 0.3} ${y + s * 0.34} V${y + s * 0.66} M${x + s * 0.7} ${y + s * 0.34} V${y + s * 0.66}`}
      />
    )}
  </g>
);

function Page() {
  return (
    <>
      <rect class="sc-hero" x={S.x + 8} y={S.y + 30} width={S.w - 16} height="44" rx="8" />
      <Lines y={S.y + 84} n={6} />
      <rect class="sc-card" x={S.x + 8} y={S.y + 152} width={S.w - 16} height="34" rx="7" />
    </>
  );
}

/** Нижняя панель Safari: компактная (iOS 26) — плавающая строка адреса с «⋯» */
function CompactBar({ hlDots }: { hlDots?: boolean }) {
  const y = S.y + S.h - 30;
  return (
    <>
      <rect class="sc-bar" x={S.x + 6} y={y} width={S.w - 12} height="22" rx="11" />
      <Chevron x={S.x + 16} y={y + 11} left />
      <rect class="sc-line" x={S.x + 28} y={y + 8.5} width="50" height="5" rx="2.5" />
      <Dots x={S.x + S.w - 18} y={y + 11} hl={hlDots} />
    </>
  );
}

/** Классическая нижняя панель: назад, вперёд, поделиться, закладки, вкладки */
function ClassicBar({ hlShare }: { hlShare?: boolean }) {
  const y = S.y + S.h - 24;
  const cx = S.x + S.w / 2;
  return (
    <>
      <rect class="sc-bar flat" x={S.x} y={y} width={S.w} height="24" />
      <Chevron x={S.x + 14} y={y + 11} left />
      <Chevron x={S.x + 34} y={y + 11} />
      <ShareIcon x={cx} y={y + 11} hl={hlShare} />
      <rect class="sc-icon-r" x={S.x + 72} y={y + 6} width="10" height="10" rx="2" />
      <rect class="sc-icon-r" x={S.x + 90} y={y + 6} width="10" height="10" rx="2" />
    </>
  );
}

function Sheet({ top, children }: { top: number; children: ComponentChildren }) {
  return (
    <>
      <rect class="sc-dim" x={S.x} y={S.y} width={S.w} height={S.h} />
      <rect class="sc-sheet" x={S.x} y={top} width={S.w} height={S.y + S.h - top + 10} rx="12" />
      {children}
    </>
  );
}

/** Строка меню: значок + полоска «текста» */
function Row({ y, icon, hl, w = 52 }: { y: number; icon?: ComponentChildren; hl?: boolean; w?: number }) {
  return (
    <>
      {hl && <rect class="sc-row-hl" x={S.x + 6} y={y - 8} width={S.w - 12} height="16" rx="5" />}
      <rect
        class={hl ? 'sc-line strong' : 'sc-line'}
        x={S.x + 14}
        y={y - 2.5}
        width={w}
        height="5"
        rx="2.5"
      />
      {icon}
    </>
  );
}

export function InstallScene({ id, label }: { id: SceneId; label?: string | undefined }) {
  const R = S.x + S.w; // правый край экрана
  const B = S.y + S.h; // нижний край
  switch (id) {
    case 'ios-menu':
      return (
        <Phone label={label}>
          <Page />
          <CompactBar hlDots />
          <Ring cx={R - 18} cy={B - 19} from="top" />
        </Phone>
      );
    case 'ios-page-menu':
      return (
        <Phone label={label}>
          <Page />
          <rect class="sc-dim" x={S.x} y={S.y} width={S.w} height={S.h} />
          <rect class="sc-sheet" x={S.x + 30} y={B - 118} width="72" height="82" rx="10" />
          {[0, 1, 2, 3].map((i) => {
            const y = B - 104 + i * 18;
            return (
              <g key={i}>
                {i === 0 && <rect class="sc-row-hl" x={S.x + 34} y={y - 7} width="64" height="14" rx="5" />}
                <rect
                  class={i === 0 ? 'sc-line strong' : 'sc-line'}
                  x={S.x + 40}
                  y={y - 2.5}
                  width="34"
                  height="5"
                  rx="2.5"
                />
                {i === 0 ? (
                  <ShareIcon x={S.x + 88} y={y} hl />
                ) : (
                  <circle class="sc-icon-c" cx={S.x + 88} cy={y} r="3.5" />
                )}
              </g>
            );
          })}
          <CompactBar />
          <Ring cx={S.x + 88} cy={B - 104} r={10} from="left" />
        </Phone>
      );
    case 'ios-share-bar':
      return (
        <Phone label={label}>
          <rect class="sc-bar flat" x={S.x} y={S.y + 14} width={S.w} height="20" />
          <rect class="sc-line" x={S.x + 24} y={S.y + 21.5} width="60" height="5" rx="2.5" />
          <g transform="translate(0 10)">
            <Page />
          </g>
          <ClassicBar hlShare />
          <Ring cx={S.x + S.w / 2} cy={B - 13} from="top" />
        </Phone>
      );
    case 'ios-share-sheet':
      return (
        <Phone label={label}>
          <Page />
          <Sheet top={S.y + 74}>
            <g>
              {[0, 1, 2, 3].map((i) => (
                <AppIcon key={i} x={S.x + 10 + i * 24} y={S.y + 86} s={16} />
              ))}
            </g>
            <Row y={S.y + 122} icon={<circle class="sc-icon-c" cx={R - 16} cy={S.y + 122} r="3.5" />} />
            <Row
              y={S.y + 140}
              icon={<circle class="sc-icon-c" cx={R - 16} cy={S.y + 140} r="3.5" />}
              w={40}
            />
            <Row y={S.y + 160} hl w={60} icon={<PlusSquare x={R - 16} y={S.y + 160} hl />} />
            <Row
              y={S.y + 180}
              icon={<circle class="sc-icon-c" cx={R - 16} cy={S.y + 180} r="3.5" />}
              w={46}
            />
            <Row
              y={S.y + 198}
              icon={<circle class="sc-icon-c" cx={R - 16} cy={S.y + 198} r="3.5" />}
              w={36}
            />
          </Sheet>
          <Ring cx={R - 16} cy={S.y + 160} r={10} from="left" />
        </Phone>
      );
    case 'ios-add':
      return (
        <Phone label={label}>
          <rect class="sc-sheet" x={S.x} y={S.y + 26} width={S.w} height={S.h} rx="12" />
          {/* шапка: «Отмена» слева, «Добавить» справа */}
          <rect class="sc-line" x={S.x + 8} y={S.y + 38} width="20" height="5" rx="2.5" />
          <rect class="sc-btn-txt" x={R - 30} y={S.y + 36} width="22" height="9" rx="4.5" />
          <rect class="sc-card" x={S.x + 8} y={S.y + 56} width={S.w - 16} height="34" rx="7" />
          <AppIcon x={S.x + 14} y={S.y + 62} s={22} accent />
          <rect class="sc-line strong" x={S.x + 44} y={S.y + 66} width="44" height="5" rx="2.5" />
          <rect class="sc-line" x={S.x + 44} y={S.y + 77} width="30" height="4" rx="2" />
          {/* переключатель «Open as Web App» — включён */}
          <rect class="sc-card" x={S.x + 8} y={S.y + 98} width={S.w - 16} height="22" rx="7" />
          <rect class="sc-line" x={S.x + 16} y={S.y + 106.5} width="44" height="5" rx="2.5" />
          <rect class="sc-toggle" x={R - 34} y={S.y + 103} width="22" height="12" rx="6" />
          <circle class="sc-knob" cx={R - 18} cy={S.y + 109} r="4.5" />
          <Lines y={S.y + 132} n={3} w={80} />
          <Ring cx={R - 19} cy={S.y + 40.5} r={11} from="left" />
          <Ring cx={R - 23} cy={S.y + 109} r={10} from="left" />
        </Phone>
      );
    case 'home':
      return (
        <Phone label={label}>
          <rect class="sc-wall" x={S.x} y={S.y} width={S.w} height={S.h} />
          {Array.from({ length: 16 }, (_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const accent = i === 9;
            return <AppIcon key={i} x={S.x + 10 + col * 24} y={S.y + 34 + row * 30} s={18} accent={accent} />;
          })}
          <rect class="sc-dock" x={S.x + 6} y={B - 34} width={S.w - 12} height="26" rx="9" />
          {[0, 1, 2, 3].map((i) => (
            <AppIcon key={i} x={S.x + 12 + i * 24} y={B - 30} s={18} />
          ))}
          <Ring cx={S.x + 10 + 24 + 9} cy={S.y + 34 + 60 + 9} r={14} from="right" />
        </Phone>
      );
    case 'android-menu':
      return (
        <Phone label={label}>
          <rect class="sc-bar flat" x={S.x} y={S.y + 14} width={S.w} height="22" />
          <rect class="sc-bar" x={S.x + 8} y={S.y + 18} width="70" height="14" rx="7" />
          <rect class="sc-icon-r" x={R - 34} y={S.y + 20} width="9" height="9" rx="2" />
          <Dots x={R - 12} y={S.y + 25} vertical hl />
          <g transform="translate(0 12)">
            <Page />
          </g>
          <Ring cx={R - 12} cy={S.y + 25} r={10} from="bottom" />
        </Phone>
      );
    case 'android-item':
      return (
        <Phone label={label}>
          <rect class="sc-bar flat" x={S.x} y={S.y + 14} width={S.w} height="22" />
          <g transform="translate(0 12)">
            <Page />
          </g>
          <rect class="sc-sheet" x={S.x + 34} y={S.y + 18} width="70" height="128" rx="8" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = S.y + 32 + i * 19;
            const hl = i === 4;
            return (
              <g key={i}>
                {hl && <rect class="sc-row-hl" x={S.x + 37} y={y - 7} width="64" height="14" rx="5" />}
                {hl ? (
                  <g class="sc-icon hl" transform={`translate(${S.x + 42} ${y - 6})`}>
                    <rect x="0.5" y="0.5" width="7" height="11" rx="1.5" />
                    <path d="M4 3 V8 M2 6 L4 8 L6 6" />
                  </g>
                ) : (
                  <circle class="sc-icon-c" cx={S.x + 46} cy={y} r="3" />
                )}
                <rect
                  class={hl ? 'sc-line strong' : 'sc-line'}
                  x={S.x + 56}
                  y={y - 2.5}
                  width={hl ? 40 : 32}
                  height="5"
                  rx="2.5"
                />
              </g>
            );
          })}
          <Ring cx={S.x + 46} cy={S.y + 108} r={10} from="left" />
        </Phone>
      );
    case 'android-confirm':
      return (
        <Phone label={label}>
          <Page />
          <rect class="sc-dim" x={S.x} y={S.y} width={S.w} height={S.h} />
          <rect class="sc-sheet" x={S.x + 10} y={S.y + 80} width={S.w - 20} height="78" rx="12" />
          <AppIcon x={S.x + 20} y={S.y + 92} s={20} accent />
          <rect class="sc-line strong" x={S.x + 48} y={S.y + 96} width="40" height="5" rx="2.5" />
          <rect class="sc-line" x={S.x + 48} y={S.y + 106} width="30" height="4" rx="2" />
          <rect class="sc-line" x={S.x + 26} y={S.y + 139.5} width="20" height="5" rx="2.5" />
          <rect class="sc-btn" x={R - 52} y={S.y + 134} width="34" height="16" rx="8" />
          <Ring cx={R - 35} cy={S.y + 142} r={13} from="top" />
        </Phone>
      );
    case 'open-browser':
      return (
        <Phone label={label}>
          {/* встроенный браузер: шапка с крестиком и «⋯», внутри — меню «Открыть в браузере» */}
          <rect class="sc-bar flat" x={S.x} y={S.y + 14} width={S.w} height="22" />
          <path class="sc-icon" d={`M${S.x + 10} ${S.y + 21} l8 8 m0 -8 l-8 8`} />
          <rect class="sc-line" x={S.x + 30} y={S.y + 22.5} width="44" height="5" rx="2.5" />
          <Dots x={R - 14} y={S.y + 25} />
          <g transform="translate(0 12)">
            <Page />
          </g>
          <Sheet top={B - 92}>
            <Row y={B - 76} icon={<circle class="sc-icon-c" cx={R - 16} cy={B - 76} r="3.5" />} />
            <Row
              y={B - 56}
              hl
              w={60}
              icon={
                <g class="sc-icon hl" transform={`translate(${R - 22} ${B - 62})`}>
                  <circle cx="6" cy="6" r="5.5" />
                  <path d="M8.5 3.5 L7 7 L3.5 8.5 L5 5 Z" />
                </g>
              }
            />
            <Row y={B - 36} icon={<circle class="sc-icon-c" cx={R - 16} cy={B - 36} r="3.5" />} w={40} />
          </Sheet>
          <Ring cx={R - 16} cy={B - 56} r={10} from="left" />
        </Phone>
      );
  }
}
