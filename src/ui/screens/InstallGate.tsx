import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, tList } from '../../i18n';
import {
  browser,
  closeManualGate,
  continueInBrowser,
  gate,
  gateManual,
  installPrompt,
  iosSafariVersion,
  markInstalled,
  platform,
  promptInstall,
  showInstructions,
} from '../../features/install';
import { Seg } from '../components/Controls';
import { Icon } from '../components/Icon';
import { InstallScene, type SceneId } from '../components/InstallScene';

type Os = 'ios' | 'android';

interface Step {
  key: string;
  text: string;
  note?: string | undefined;
  scenes: { id: SceneId; caption?: string }[];
}

function iosSteps(): Step[] {
  const steps: Step[] = [];
  const inSafari = platform === 'ios' && browser === 'safari';
  if (platform === 'ios' && browser === 'in-app')
    steps.push({ key: 'open', text: t('install.ios.openInApp'), scenes: [{ id: 'open-browser' }] });
  else if (platform === 'ios' && !inSafari)
    steps.push({ key: 'open', text: t('install.ios.openSafari'), scenes: [{ id: 'open-browser' }] });

  const v = inSafari ? iosSafariVersion : null;
  if (v != null && v >= 26) {
    steps.push({ key: 'dots', text: t('install.ios.dots'), scenes: [{ id: 'ios-menu' }] });
    steps.push({
      key: 'share',
      text: t('install.ios.share'),
      note: t('install.ios.shareAlt'),
      scenes: [{ id: 'ios-page-menu' }],
    });
  } else if (v != null) {
    steps.push({ key: 'share', text: t('install.ios.shareOld'), scenes: [{ id: 'ios-share-bar' }] });
  } else {
    // Версию не знаем — показываем оба варианта рядом
    steps.push({
      key: 'share',
      text: t('install.ios.shareEither'),
      note: t('install.ios.lookHere'),
      scenes: [
        { id: 'ios-menu', caption: t('install.ios.sceneNew') },
        { id: 'ios-share-bar', caption: t('install.ios.sceneOld') },
      ],
    });
  }
  steps.push({
    key: 'add',
    text: t('install.ios.addHome'),
    note: t('install.ios.editActions'),
    scenes: [{ id: 'ios-share-sheet' }],
  });
  steps.push({
    key: 'webapp',
    text: v != null && v < 26 ? t('install.ios.addOld') : t('install.ios.webApp'),
    scenes: [{ id: 'ios-add' }],
  });
  steps.push({ key: 'home', text: t('install.openHome'), scenes: [{ id: 'home' }] });
  return steps;
}

function androidSteps(): Step[] {
  const steps: Step[] = [];
  if (platform === 'android' && browser === 'in-app')
    steps.push({ key: 'open', text: t('install.and.openInApp'), scenes: [{ id: 'open-browser' }] });
  steps.push({ key: 'menu', text: t('install.and.menu'), scenes: [{ id: 'android-menu' }] });
  steps.push({ key: 'item', text: t('install.and.item'), scenes: [{ id: 'android-item' }] });
  steps.push({ key: 'confirm', text: t('install.and.confirm'), scenes: [{ id: 'android-confirm' }] });
  steps.push({ key: 'home', text: t('install.openHome'), scenes: [{ id: 'home' }] });
  return steps;
}

export function InstallGate() {
  return gate.value === 'done' ? <InstallDone /> : <InstallSteps />;
}

function useHeadingFocus() {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    ref.current?.focus();
    window.scrollTo(0, 0);
  }, []);
  return ref;
}

function InstallSteps() {
  const [os, setOs] = useState<Os>(platform === 'android' ? 'android' : 'ios');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const head = useHeadingFocus();
  const manual = gateManual.value;

  // Кнопки — только после прокрутки до конца инструкции (если всё помещается — сразу)
  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setReady(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (ready) primary.current?.focus({ preventScroll: true });
  }, [ready]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setProgress(max > 0 ? Math.min(1, scrollY / max) : 1);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    };
  }, []);

  const steps = os === 'ios' ? iosSteps() : androidSteps();
  const canPrompt = os === 'android' && !!installPrompt.value;

  const onInstallNow = async () => {
    const r = await promptInstall();
    if (r === 'accepted') markInstalled();
  };

  return (
    <div class="screen install-gate">
      <div class="ig-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <header class="topbar">
        {manual && (
          <button type="button" class="back" onClick={closeManualGate}>
            <Icon name="back" size={20} /> {t('common.back')}
          </button>
        )}
        <div class="eyebrow">{t('app.name')}</div>
        <h1 class="screen-title" tabIndex={-1} ref={head}>
          {t('install.gate.title')}
        </h1>
      </header>

      <section class="card ig-why">
        <p>{t('install.gate.lead')}</p>
        <ul>
          {tList('install.gate.why').map((w, i) => (
            <li key={i}>
              <span class="ig-why-ic" aria-hidden="true">
                <Icon name={(['download', 'today', 'check'] as const)[i] ?? 'check'} size={18} />
              </span>
              {w}
            </li>
          ))}
        </ul>
      </section>
      <div class="note warn" role="note">
        <span aria-hidden="true">⚠️</span>
        <span>{t('install.gate.warn')}</span>
      </div>

      <div class="ig-os">
        <span>{t('install.gate.yourPhone')}</span>
        <Seg
          label={t('install.gate.yourPhone')}
          value={os}
          onChange={setOs}
          options={[
            { v: 'ios', t: 'iPhone' },
            { v: 'android', t: 'Android' },
          ]}
        />
      </div>

      {canPrompt && (
        <div class="ig-now">
          <button type="button" class="btn primary block lg" onClick={() => void onInstallNow()}>
            <Icon name="download" size={20} /> {t('install.app')}
          </button>
          <p class="muted small">{t('install.gate.orSteps')}</p>
        </div>
      )}

      <ol class="ig-steps" aria-label={t('install.gate.stepsLabel')}>
        {steps.map((s, i) => (
          <li key={s.key} class="card ig-step">
            <span class="ig-num" aria-hidden="true">
              {i + 1}
            </span>
            <div class="ig-txt">
              <p>{s.text}</p>
              {s.note && <p class="muted small">{s.note}</p>}
            </div>
            <div class={'ig-scenes' + (s.scenes.length > 1 ? ' two' : '')}>
              {s.scenes.map((sc) => (
                <figure key={sc.id}>
                  <InstallScene id={sc.id} />
                  {sc.caption && <figcaption>{sc.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {os === 'android' && (
        <section class="card ig-other">
          <h2 class="card-t">{t('install.and.otherTitle')}</h2>
          <ul>
            {tList('install.and.other').map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      <p class="muted small">{t('install.gate.translated')}</p>

      <div ref={anchor} class="ig-end" aria-hidden="true" />

      {!ready && (
        <div class="ig-scroll-hint" aria-hidden="true">
          {t('install.gate.scrollHint')} <span class="ig-bounce">↓</span>
        </div>
      )}
      {ready && (
        <div class="ig-actions">
          <button ref={primary} type="button" class="btn primary block" onClick={markInstalled}>
            <Icon name="check" size={18} /> {t('install.gate.installed')}
          </button>
          <button type="button" class="link-btn" onClick={continueInBrowser}>
            {t('install.gate.continue')}
          </button>
          <p class="muted small ig-fine">
            {t(os === 'ios' ? 'install.gate.continueNoteIos' : 'install.gate.continueNoteAndroid')}
          </p>
        </div>
      )}
    </div>
  );
}

function InstallDone() {
  const head = useHeadingFocus();
  return (
    <div class="screen install-gate done">
      <header class="topbar">
        <div class="eyebrow">{t('app.name')}</div>
        <h1 class="screen-title" tabIndex={-1} ref={head}>
          {t('install.done.title')}
        </h1>
      </header>
      <section class="card ig-done">
        <p>{t('install.done.text')}</p>
        <figure>
          <InstallScene id="home" />
        </figure>
      </section>
      <button type="button" class="link-btn" onClick={() => showInstructions()}>
        {t('install.done.again')}
      </button>
    </div>
  );
}
