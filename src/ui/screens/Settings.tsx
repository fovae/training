import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCALES, fmtDate, fmtTime, locale, setLocale, t } from '../../i18n';
import { CONTACT_EMAIL } from '../../lib/meta';
import { profile, saveProfile, settings, units, updateProfile, updateSettings } from '../../state/settings';
import { history } from '../../state/session';
import { cmToFtIn, fmtWeight } from '../../lib/format';
import { ask, pickedDayId, planDayId, route, toast } from '../../state/ui';
import { stopRest } from '../../features/timer';
import { plan, setMode } from '../../state/plan';
import { openPlanner } from '../../state/planner';
import { openTour } from '../../state/tour';
import {
  applyRestore,
  checkPersist,
  persistStatus,
  readBackupFile,
  requestPersist,
  loadRestorePoints,
  resetAll,
  restoreFromPoint,
  restorePoints,
  saveCopyFlow,
  undoAvailable,
  undoRestore,
} from '../../features/backup';
import { LEGAL_META } from '../../content/legal';
import { fmtDocDate } from './Legal';
import { wakeStatus, wakeSupported } from '../../features/wakelock';
import { audioAvailable, beep } from '../../features/audio';
import {
  installPrompt,
  installed,
  isStandalone,
  platform,
  promptInstall,
  showInstructions,
} from '../../features/install';
import type { Level, MotionPref, Settings as S } from '../../types';
import { Icon, type IconName } from '../components/Icon';
import { Seg, Stepper, Toggle } from '../components/Controls';
import { ThemePicker } from '../components/ThemePicker';
import { ProfileForm, draftFrom, validateProfile, type ProfileDraft } from '../components/ProfileForm';
import { askRestore } from '../components/RestoreDialog';
import { scrollBehavior } from '../../lib/motion';
import { Select } from '../components/Select';
import { HelpTip } from '../components/HelpTip';
import { Sheet } from '../components/Sheet';
import { resetLibraryFilter } from '../components/ExerciseFilters';

export function Settings() {
  const s = settings.value;
  const set = <K extends keyof S>(k: K, v: S[K]) => updateSettings({ [k]: v } as Partial<S>);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkPersist();
    void loadRestorePoints();
  }, []);

  const onSave = () => saveCopyFlow();

  /** Точная дата и время: «14 ноября, пт, 12:33» */
  const when = (iso: string) => `${fmtDate(Date.parse(iso))}, ${fmtTime(Date.parse(iso))}`;

  const onRestorePoint = async (id: string, takenAt: string) => {
    const r = await ask({
      title: t('backup.pointsAskTitle'),
      body: t('backup.pointsAskBody', { date: when(takenAt) }),
      confirm: t('backup.pointsRestore'),
    });
    if (r !== 'confirm') return;
    try {
      if (await restoreFromPoint(id)) toast(t('backup.restored'));
    } catch (e) {
      console.error(e);
      toast(t('backup.err.invalid'));
    }
  };

  const onRestoreFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const ready = await readBackupFile(file);
      const ok = await askRestore(ready, {
        title: t('legal.restoreTitle'),
        body: t('legal.restoreBody'),
        confirm: t('backup.replace'),
      });
      if (ok !== 'confirm') return;
      await applyRestore(ready);
      toast(t('backup.restored'));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('backup.err.invalid'));
    }
  };

  const onUndo = async () => {
    if (await undoRestore()) toast(t('backup.undone'));
  };

  const onReset = async () => {
    const r = await ask({
      title: t('legal.deleteTitle'),
      body: t('legal.deleteBody'),
      confirm: t('legal.deleteConfirm'),
      danger: true,
      extra: { label: t('backup.saveFirst') },
    });
    if (r === 'extra') {
      await onSave();
      return;
    }
    if (r !== 'confirm') return;
    await resetAll();
    resetLibraryFilter();
    // Всё, что жило только в памяти: идущий таймер отдыха и выбранные дни — тоже к началу
    stopRest();
    pickedDayId.value = null;
    planDayId.value = null;
    location.hash = '#/';
    toast(t('reset.done'));
  };

  const standalone = installed.value || isStandalone();
  const p = plan.value;
  const weekdays = p?.mode === 'weekdays';
  const schedRef = useRef<HTMLDivElement>(null);
  const [themes, setThemes] = useState(false);
  const [docs, setDocs] = useState(false);

  // #/settings/schedule — прокрутить к строке расписания (переход с экрана «План»)
  useEffect(() => {
    if (route.value.sub?.id === 'schedule' && schedRef.current) {
      schedRef.current.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
      schedRef.current.focus({ preventScroll: true });
    }
  }, [route.value.sub?.id, !!p]);

  const onSwitchMode = async () => {
    const r = await ask({
      title: t(weekdays ? 'settings.toCycleTitle' : 'settings.toWeekdaysTitle'),
      body: t(weekdays ? 'settings.toCycleBody' : 'settings.toWeekdaysBody'),
      confirm: t('settings.switch'),
    });
    if (r !== 'confirm') return;
    setMode(weekdays ? 'cycle' : 'weekdays');
    toast(t('settings.switched', { mode: t(weekdays ? 'plan.modeCycle' : 'plan.modeWeekdays') }));
  };

  return (
    <div class="screen settings">
      <header class="topbar">
        <div class="eyebrow">{t('settings.eyebrow')}</div>
        <h1 class="screen-title">{t('settings.title')}</h1>
      </header>

      <ProfileCard />

      <Group title={t('settings.sec.training')}>
        {p && (
          <Row
            icon="plan"
            c="c1"
            label={t('plan.mode')}
            value={t(weekdays ? 'plan.modeWeekdays' : 'plan.modeCycle')}
            onClick={() => void onSwitchMode()}
            rowRef={schedRef}
            id="schedule"
          />
        )}
        {p && (
          <Row
            icon="spark"
            c="c2"
            label={t('planner.assistant')}
            value={t('planner.cta')}
            onClick={() => openPlanner()}
          />
        )}
        <Row
          icon="clock"
          c="c3"
          label={
            <span class="srow-title">
              {t('settings.restBase')}
              <HelpTip topic={t('settings.restBase')} text={t('settings.restBaseHelp')} />
            </span>
          }
        >
          <Stepper
            label={t('settings.restBase')}
            value={s.restBaseSec}
            onChange={(v) => set('restBaseSec', v)}
          />
        </Row>
        <Row
          icon="clock"
          c="c4"
          label={
            <span class="srow-title">
              {t('settings.restIso')}
              <HelpTip topic={t('settings.restIso')} text={t('settings.restIsoHelp')} />
            </span>
          }
        >
          <Stepper
            label={t('settings.restIso')}
            value={s.restIsoSec}
            onChange={(v) => set('restIsoSec', v)}
          />
        </Row>
        <Row icon="trend" c="c5" label={t('settings.pace')} tall>
          <Seg<NonNullable<S['pace']>>
            label={t('settings.pace')}
            value={s.pace ?? 'normal'}
            mini={false}
            options={(['slow', 'normal', 'fast'] as const).map((v) => ({ v, t: t(`settings.paceOpt.${v}`) }))}
            onChange={(v) => set('pace', v)}
          />
        </Row>
        <Row icon="history" c="c6" label={t('settings.useHistory')}>
          <Toggle
            label={t('settings.useHistory')}
            on={s.useHistory !== false}
            onChange={(v) => set('useHistory', v)}
          />
        </Row>
      </Group>

      <Group title={t('settings.secRest')}>
        <Row
          icon="sound"
          c="c1"
          label={t('settings.sound')}
          sub={audioAvailable() ? undefined : t('settings.soundNone')}
        >
          <span class="srow-act">
            {s.sound && audioAvailable() && (
              <button type="button" class="btn-ghost sm" onClick={beep}>
                {t('settings.test')}
              </button>
            )}
            <Toggle label={t('settings.sound')} on={s.sound} onChange={(v) => set('sound', v)} />
          </span>
        </Row>
        <Row icon="flash" c="c2" label={t('settings.flash')}>
          <Toggle label={t('settings.flash')} on={!!s.flash} onChange={(v) => set('flash', v)} />
        </Row>
        <Row
          icon="sun"
          c="c3"
          label={t('settings.wake')}
          sub={wakeSupported ? undefined : t(`settings.wake_${wakeStatus.value}`)}
        >
          <Toggle
            label={t('settings.wakeLabel')}
            on={s.wakeLock && wakeSupported}
            disabled={!wakeSupported}
            onChange={(v) => set('wakeLock', v)}
          />
        </Row>
      </Group>

      <Group title={t('settings.sec.tips')}>
        <Row icon="bulb" c="c4" label={t('settings.showTips')}>
          <Toggle label={t('settings.showTips')} on={s.tipsEnabled} onChange={(v) => set('tipsEnabled', v)} />
        </Row>
        <Row icon="check" c="c5" label={t('settings.showRules')}>
          <Toggle label={t('settings.showRules')} on={!s.hideRules} onChange={(v) => set('hideRules', !v)} />
        </Row>
        {s.weightWarningIgnored.length > 0 && (
          <Row
            icon="shield"
            c="c6"
            label={t('settings.weightWarnOff', { count: s.weightWarningIgnored.length })}
          >
            <button type="button" class="btn-ghost sm" onClick={() => set('weightWarningIgnored', [])}>
              {t('settings.weightWarnReset')}
            </button>
          </Row>
        )}
      </Group>

      <Group title={t('settings.sec.look')}>
        <Row icon="globe" c="c1" label={t('settings.language')}>
          <Select
            label={t('settings.language')}
            value={locale.value}
            onChange={(code) => void setLocale(code).then(() => updateProfile({ locale: code }))}
            options={LOCALES.map((l) => ({ value: l.code, label: l.native, lang: l.code }))}
          />
        </Row>
        <Row
          icon="palette"
          c="c2"
          label={t('settings.theme')}
          value={t(`theme.${s.theme}`)}
          haspopup
          onClick={() => setThemes(true)}
        />
        <Row icon="play" c="c3" label={t('settings.motion')} tall>
          <Seg<MotionPref>
            label={t('settings.motion')}
            value={s.motion ?? 'on'}
            mini={false}
            options={(['system', 'on', 'off'] as const).map((v) => ({ v, t: t(`settings.motionOpt.${v}`) }))}
            onChange={(v) => set('motion', v)}
          />
        </Row>
      </Group>

      <Group title={t('settings.data')} id="data" foot={t('legal.backupNote')}>
        <Row
          icon="share"
          c="c4"
          label={t('backup.save')}
          sub={s.lastBackupAt ? when(s.lastBackupAt) : t('backup.never')}
          onClick={() => void onSave()}
        />
        <Row icon="upload" c="c5" label={t('backup.restore')} onClick={() => fileRef.current?.click()} />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void onRestoreFile(e)}
          data-testid="import-input"
        />
        {undoAvailable.value && (
          <Row icon="back" c="c6" label={t('backup.undo')} onClick={() => void onUndo()} />
        )}
        <Row
          icon="history"
          c="c7"
          label={t('backup.pointsTitle')}
          sub={restorePoints.value.length === 0 ? t('backup.pointsNone') : t('backup.pointsNote')}
        />
        {restorePoints.value.map((pt) => (
          <Row key={pt.id} sub={t(`backup.pointReason.${pt.reason}`)} label={when(pt.takenAt)} indent>
            <button type="button" class="btn-ghost sm" onClick={() => void onRestorePoint(pt.id, pt.takenAt)}>
              {t('backup.pointsRestore')}
            </button>
          </Row>
        ))}
        <Row
          icon="shield"
          c="c1"
          label={t('settings.persist')}
          sub={t(`settings.persist_${persistStatus.value}`)}
        >
          {persistStatus.value === 'not-persisted' && (
            <button type="button" class="btn-ghost sm" onClick={() => void requestPersist()}>
              {t('settings.request')}
            </button>
          )}
        </Row>
        <Row icon="trash" c="danger" label={t('reset.button')} danger onClick={() => void onReset()} />
      </Group>

      <Group title={t('contact.title')} cls="contact-list" foot={t('contact.desc')}>
        {CONTACTS.map((c) => (
          <Row
            key={c.id}
            icon={c.id}
            c="soft"
            label={t(`contact.${c.id}`)}
            value={c.handle}
            href={c.href}
            external
          />
        ))}
        <Row
          icon="mail"
          c="soft"
          label={t('about.contact')}
          value={CONTACT_EMAIL}
          href={`mailto:${CONTACT_EMAIL}`}
        />
      </Group>

      <Group title={t('about.title')} cls="about" foot={t('about.privacy')}>
        <Row icon="info" c="c2" label={t('about.version')} value={__APP_VERSION__} />
        {standalone ? (
          <Row icon="download" c="c3" label={t('install.title')} value={t('install.installed')} />
        ) : installPrompt.value ? (
          <Row icon="download" c="c3" label={t('install.title')}>
            <button type="button" class="btn-ghost sm" onClick={() => void promptInstall()}>
              {t('install.app')}
            </button>
          </Row>
        ) : platform !== 'desktop' ? (
          <Row
            icon="download"
            c="c3"
            label={t('install.title')}
            value={t('install.howTo')}
            onClick={() => showInstructions(true)}
          />
        ) : null}
        <Row icon="library" c="c4" label={t('about.documents')} haspopup onClick={() => setDocs(true)} />
        <Row icon="play" c="c5" label={t('settings.showTour')} onClick={openTour} />
      </Group>
      <p class="credits">{t('about.credits')}</p>

      {themes && (
        <Sheet title={t('settings.theme')} onClose={() => setThemes(false)}>
          <ThemePicker value={s.theme} onChange={(v) => set('theme', v)} />
        </Sheet>
      )}
      {docs && (
        <Sheet title={t('about.documents')} onClose={() => setDocs(false)}>
          <ul class="list">
            {(['terms', 'privacy'] as const).map((d) => (
              <li key={d}>
                <a class="row" href={`#/legal/${d}`}>
                  <span class="row-main">
                    <b>{t(`legal.${d}Title`)}</b>
                    <span class="muted">
                      {t('legal.versionLine', {
                        version: LEGAL_META[d].version,
                        date: fmtDocDate(LEGAL_META[d].updated),
                      })}
                    </span>
                  </span>
                  <Icon name="chevron" size={18} />
                </a>
              </li>
            ))}
            <li>
              <a class="row" href="#/legal/licenses">
                <span class="row-main">
                  <b>{t('legal.licensesTitle')}</b>
                </span>
                <Icon name="chevron" size={18} />
              </a>
            </li>
          </ul>
        </Sheet>
      )}
    </div>
  );
}

/** Внешние профили автора (Настройки → Contact Me) */
const CONTACTS = [
  { id: 'instagram', href: 'https://www.instagram.com/vfovae/', handle: 'vfovae' },
  { id: 'telegram', href: 'https://t.me/fovae', handle: 'fovae' },
  { id: 'discord', href: 'https://discord.com/users/1468713991852396557', handle: 'fovae' },
] as const;

/**
 * Группа настроек как в iOS (3.22): маленький заголовок, карточка со строками, подпись снизу.
 * Всё на одном экране — без вложенных экранов.
 */
function Group({
  title,
  foot,
  id,
  cls,
  children,
}: {
  title: string;
  foot?: string;
  id?: string;
  cls?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={'ig' + (cls ? ' ' + cls : '')} id={id} aria-label={title}>
      <h2 class="ig-h">{title}</h2>
      <div class="ig-card">{children}</div>
      {foot && <p class="ig-foot">{foot}</p>}
    </section>
  );
}

/**
 * Строка: цветной значок, подпись (и пояснение мелко), справа — значение, переключатель или кнопка.
 * onClick / href — вся строка нажимается (со стрелкой). tall — элемент управления под подписью.
 */
function Row({
  icon,
  c,
  label,
  sub,
  value,
  children,
  onClick,
  href,
  external,
  haspopup,
  danger,
  tall,
  indent,
  id,
  rowRef,
}: {
  icon?: IconName;
  /** цвет значка: cN — заливка цвета темы, soft — нейтральный, danger — красный */
  c?: string;
  label: ComponentChildren;
  sub?: string | undefined;
  value?: string;
  children?: ComponentChildren;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  haspopup?: boolean;
  danger?: boolean;
  tall?: boolean;
  indent?: boolean;
  id?: string;
  rowRef?: Ref<HTMLDivElement>;
}) {
  const cls = 'ir' + (danger ? ' danger' : '') + (tall ? ' tall' : '') + (indent ? ' indent' : '');
  const bg =
    c === 'soft' ? 'var(--soft)' : c === 'danger' ? 'var(--danger-fill)' : c ? `var(--${c}-fill)` : '';
  const head = (
    <>
      {icon && (
        <span class={'ir-ic' + (c === 'soft' ? ' soft' : '')} style={{ background: bg }} aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
      )}
      <span class="ir-txt">
        <span class="ir-lb">{label}</span>
        {sub && <small>{sub}</small>}
      </span>
      {value && <span class="ir-val">{value}</span>}
    </>
  );
  if (href)
    return (
      <a
        class={cls + ' tap'}
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {head}
        {external && <span class="sr-only">{t('contact.newTab')}</span>}
        <Icon name={external ? 'external' : 'chevron'} size={16} class="ir-chev" />
      </a>
    );
  if (onClick)
    return (
      <div class="ir-wrap" id={id} ref={rowRef} tabIndex={id ? -1 : undefined}>
        <button
          type="button"
          class={cls + ' tap'}
          aria-haspopup={haspopup ? 'dialog' : undefined}
          onClick={onClick}
        >
          {head}
          {!danger && <Icon name="chevron" size={16} class="ir-chev" />}
        </button>
      </div>
    );
  return (
    <div class={cls} id={id}>
      {head}
      {children && <span class="ir-ctl">{children}</span>}
    </div>
  );
}

/**
 * Профиль — карточка пользователя, а не форма: ник, уровень и данные; «⋯» справа вверху открывает
 * лист редактирования (вес, рост, ник, возраст, пол, уровень) с кнопкой «Сохранить».
 */
function ProfileCard() {
  const p = profile.value;
  const [editing, setEditing] = useState(false);
  if (!p) return null;
  const name = p.name?.trim();
  const done = history.value.length;
  const ft = units.value === 'imperial' ? cmToFtIn(p.heightCm) : null;
  const stats: [string, string][] = [
    [t('profile.card.weight'), fmtWeight(p.weightKg)],
    [t('profile.card.height'), ft ? `${ft.ft}′${ft.inch}″` : `${p.heightCm} ${t('unit.cm')}`],
    [t('profile.age'), p.age ? String(p.age) : '—'],
    [t('profile.card.workouts'), String(done)],
    // «11.2026» — коротко, чтобы влезало в плитку
    [
      t('profile.card.since'),
      new Intl.DateTimeFormat(locale.value, { month: '2-digit', year: 'numeric' }).format(
        Date.parse(p.confirmedAt),
      ),
    ],
    [t('profile.sex'), p.sex ? t(`profile.${p.sex}`) : '—'],
  ];
  return (
    <section class="card profile-card" aria-labelledby="pc-name">
      <div class="pc-head">
        <span class="pc-ava" aria-hidden="true">
          {name ? [...name][0]!.toUpperCase() : <Icon name="today" size={26} />}
        </span>
        <div class="pc-id">
          <h2 id="pc-name" class="pc-name">
            <span class="sr-only">{t('settings.profile')}: </span>
            {name || t('profile.card.noName')}
          </h2>
          <span class="pc-level">{t(`level.${p.level}`)}</span>
        </div>
        <button
          type="button"
          class="icon-btn pc-more"
          aria-label={t('profile.card.edit')}
          aria-haspopup="dialog"
          onClick={() => setEditing(true)}
        >
          <Icon name="more" />
        </button>
      </div>
      <dl class="pc-stats">
        {stats.map(([k, v]) => (
          <div key={k} class="pc-stat">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
    </section>
  );
}

/** Лист редактирования профиля: всё сохраняется одной кнопкой */
function ProfileEditor({ onClose }: { onClose: () => void }) {
  const p = profile.value!;
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(p));
  const [level, setLevel] = useState<Level>(p.level);
  const [tried, setTried] = useState(false);
  const errors = tried ? validateProfile(draft).errors : {};

  const onSave = async () => {
    setTried(true);
    const { value } = validateProfile(draft);
    if (!value) return;
    const next = { ...p, ...value, level };
    if (!value.name) delete next.name;
    if (!value.age) delete next.age;
    if (!value.sex) delete next.sex;
    await saveProfile(next);
    onClose();
    toast(t('settings.profileSaved'));
  };

  return (
    <Sheet
      title={t('profile.card.editTitle')}
      onClose={onClose}
      footer={
        <button type="button" class="btn primary block" onClick={() => void onSave()}>
          {t('common.save')}
        </button>
      }
    >
      <div class="profile-edit">
        <ProfileForm draft={draft} update={setDraft} errors={errors} />
        <div class="field">
          <span class="field-lb">{t('settings.level')}</span>
          <Select
            label={t('settings.level')}
            describedBy="level-desc"
            value={level}
            onChange={(v) => setLevel(v as Level)}
            options={(['first', 'few', 'intermediate', 'veteran'] as const).map((v) => ({
              value: v,
              label: t(`level.${v}`),
            }))}
          />
          <small id="level-desc" class="muted">
            {t(`level.desc.${level}`)}
          </small>
        </div>
      </div>
    </Sheet>
  );
}
