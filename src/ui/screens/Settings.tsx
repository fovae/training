import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCALES, fmtDate, fmtTime, locale, setLocale, t } from '../../i18n';
import { CONTACT_EMAIL } from '../../lib/meta';
import { profile, saveProfile, settings, updateProfile, updateSettings } from '../../state/settings';
import { ask, route, toast } from '../../state/ui';
import { plan, setMode } from '../../state/plan';
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
import { Icon } from '../components/Icon';
import { Seg, Stepper, Toggle } from '../components/Controls';
import { ThemePicker } from '../components/ThemePicker';
import { ProfileForm, draftFrom, validateProfile, type ProfileDraft } from '../components/ProfileForm';
import { askRestore } from '../components/RestoreDialog';
import { scrollBehavior } from '../../lib/motion';
import { Select } from '../components/Select';

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
    location.hash = '#/';
    toast(t('reset.done'));
  };

  const standalone = installed.value || isStandalone();

  return (
    <div class="screen settings">
      <header class="topbar">
        <div class="eyebrow">{t('settings.eyebrow')}</div>
        <h1 class="screen-title">{t('settings.title')}</h1>
      </header>

      <ProfileCard />
      <ScheduleCard />

      <section class="card group-card">
        <h2 class="card-t">{t('settings.languageAndLook')}</h2>
        <div class="srow">
          <span>{t('settings.language')}</span>
          <Select
            label={t('settings.language')}
            value={locale.value}
            onChange={(code) => void setLocale(code).then(() => updateProfile({ locale: code }))}
            options={LOCALES.map((l) => ({ value: l.code, label: l.native, lang: l.code }))}
          />
        </div>
        <div class="field">
          <span class="field-lb">{t('settings.theme')}</span>
          <ThemePicker value={s.theme} onChange={(v) => set('theme', v)} />
        </div>
        <div class="field">
          <span class="field-lb" id="motion-lb">
            {t('settings.motion')}
          </span>
          <Seg<MotionPref>
            label={t('settings.motion')}
            value={s.motion ?? 'system'}
            options={(['system', 'on', 'off'] as const).map((v) => ({ v, t: t(`settings.motionOpt.${v}`) }))}
            onChange={(v) => set('motion', v)}
          />
        </div>
      </section>

      <section class="card group-card">
        <h2 class="card-t">{t('settings.tips')}</h2>
        <div class="srow">
          <span>
            {t('settings.showTips')}
            <small>{t('settings.tipsHint')}</small>
          </span>
          <Toggle label={t('settings.showTips')} on={s.tipsEnabled} onChange={(v) => set('tipsEnabled', v)} />
        </div>
        {s.weightWarningIgnored.length > 0 && (
          <div class="srow">
            <span>
              {t('settings.weightWarnOff', { count: s.weightWarningIgnored.length })}
              <small>{t('settings.weightWarnOffHint')}</small>
            </span>
            <button type="button" class="btn-ghost sm" onClick={() => set('weightWarningIgnored', [])}>
              {t('settings.weightWarnReset')}
            </button>
          </div>
        )}
      </section>

      <section class="card group-card">
        <h2 class="card-t">{t('settings.timer')}</h2>
        <div class="srow">
          <span>
            {t('settings.restBase')}
            <small>{t('settings.restBaseHint')}</small>
          </span>
          <Stepper
            label={t('settings.restBase')}
            value={s.restBaseSec}
            onChange={(v) => set('restBaseSec', v)}
          />
        </div>
        <div class="srow">
          <span>
            {t('settings.restIso')}
            <small>{t('settings.restIsoHint')}</small>
          </span>
          <Stepper
            label={t('settings.restIso')}
            value={s.restIsoSec}
            onChange={(v) => set('restIsoSec', v)}
          />
        </div>
        <div class="srow">
          <span>
            {t('settings.sound')}
            <small>{audioAvailable() ? t('settings.soundHint') : t('settings.soundNone')}</small>
          </span>
          <span class="srow-act">
            {s.sound && audioAvailable() && (
              <button type="button" class="btn-ghost sm" onClick={beep}>
                {t('settings.test')}
              </button>
            )}
            <Toggle label={t('settings.sound')} on={s.sound} onChange={(v) => set('sound', v)} />
          </span>
        </div>
        <div class="srow">
          <span>
            {t('settings.flash')}
            <small>{t('settings.flashHint')}</small>
          </span>
          <Toggle label={t('settings.flash')} on={!!s.flash} onChange={(v) => set('flash', v)} />
        </div>
        <div class="srow">
          <span>
            {t('settings.wake')}
            <small>{t(`settings.wake_${wakeStatus.value}`)}</small>
          </span>
          <Toggle
            label={t('settings.wakeLabel')}
            on={s.wakeLock && wakeSupported}
            disabled={!wakeSupported}
            onChange={(v) => set('wakeLock', v)}
          />
        </div>
      </section>

      <section class="card group-card" id="data">
        <h2 class="card-t">{t('settings.data')}</h2>
        <p class="muted small">{t('legal.backupNote')}</p>
        <div class="srow">
          <span>
            {t('backup.lastCopy')}
            <small>{s.lastBackupAt ? when(s.lastBackupAt) : t('backup.never')}</small>
          </span>
        </div>
        <div class="btn-row">
          <button type="button" class="btn primary" onClick={() => void onSave()}>
            <Icon name="share" size={18} /> {t('backup.save')}
          </button>
          <button type="button" class="btn secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {t('backup.restore')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onRestoreFile(e)}
            data-testid="import-input"
          />
        </div>
        {undoAvailable.value && (
          <button type="button" class="btn secondary block" onClick={() => void onUndo()}>
            {t('backup.undo')}
          </button>
        )}
        <div class="srow">
          <span>
            {t('backup.pointsTitle')}
            <small>
              {restorePoints.value.length === 0 ? t('backup.pointsNone') : t('backup.pointsNote')}
            </small>
          </span>
        </div>
        {restorePoints.value.length > 0 && (
          restorePoints.value.map((p) => (
            <div class="srow" key={p.id}>
              <span>
                {when(p.takenAt)}
                <small>{t(`backup.pointReason.${p.reason}`)}</small>
              </span>
              <button type="button" class="btn-ghost sm" onClick={() => void onRestorePoint(p.id, p.takenAt)}>
                {t('backup.pointsRestore')}
              </button>
            </div>
          ))
        )}
        <div class="srow">
          <span>
            {t('settings.persist')}
            <small>{t(`settings.persist_${persistStatus.value}`)}</small>
          </span>
          {persistStatus.value === 'not-persisted' && (
            <button type="button" class="btn-ghost sm" onClick={() => void requestPersist()}>
              {t('settings.request')}
            </button>
          )}
        </div>
        <button type="button" class="btn danger-ghost block" onClick={() => void onReset()}>
          <Icon name="trash" size={18} /> {t('reset.button')}
        </button>
      </section>

      <section class="card group-card about">
        <h2 class="card-t">{t('about.title')}</h2>
        <div class="srow">
          <span>{t('about.version')}</span>
          <b>{__APP_VERSION__}</b>
        </div>
        <p class="muted small">{t('about.privacy')}</p>
        {standalone ? (
          <div class="srow">
            <span>{t('install.title')}</span>
            <span class="muted small">{t('install.installed')}</span>
          </div>
        ) : installPrompt.value ? (
          <div class="srow">
            <span>{t('install.title')}</span>
            <button type="button" class="btn-ghost sm" onClick={() => void promptInstall()}>
              <Icon name="download" size={16} /> {t('install.app')}
            </button>
          </div>
        ) : platform !== 'desktop' ? (
          <div class="srow">
            <span>{t('install.title')}</span>
            <button type="button" class="btn-ghost sm" onClick={() => showInstructions(true)}>
              {t('install.howTo')}
            </button>
          </div>
        ) : null}
        <div class="srow">
          <span>
            {t('about.responsible')}
            <small>{t('legal.responsible')}</small>
          </span>
        </div>
        <div class="srow">
          <span>{t('about.contact')}</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
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
        <p class="credits">{t('about.credits')}</p>
      </section>
    </div>
  );
}

function ProfileCard() {
  const p = profile.value;
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(p));
  const [tried, setTried] = useState(false);
  if (!p) return null;
  const errors = tried ? validateProfile(draft).errors : {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(p));

  const onSave = async () => {
    setTried(true);
    const { value } = validateProfile(draft);
    if (!value) return;
    const next = { ...p, ...value };
    if (!value.name) delete next.name;
    if (!value.age) delete next.age;
    if (!value.sex) delete next.sex;
    await saveProfile(next);
    setDraft(draftFrom(next));
    setTried(false);
    toast(t('settings.profileSaved'));
  };

  return (
    <section class="card group-card">
      <h2 class="card-t">{t('settings.profile')}</h2>
      <ProfileForm draft={draft} update={setDraft} errors={errors} />
      <div class="field">
        <span class="field-lb">{t('settings.level')}</span>
        <Select
          label={t('settings.level')}
          describedBy="level-desc"
          value={p.level}
          onChange={(v) => updateProfile({ level: v as Level })}
          options={(['first', 'few', 'intermediate', 'veteran'] as const).map((v) => ({
            value: v,
            label: t(`level.${v}`),
          }))}
        />
        <small id="level-desc" class="muted">
          {t(`level.desc.${p.level}`)}
        </small>
      </div>
      {dirty && (
        <button type="button" class="btn primary block" onClick={() => void onSave()}>
          {t('common.save')}
        </button>
      )}
    </section>
  );
}

/** Режим расписания: переключение с подтверждением, чтобы не сменить его случайно */
function ScheduleCard() {
  const p = plan.value;
  const ref = useRef<HTMLElement>(null);
  // #/settings/schedule — прокрутить к карточке (переход с экрана «План»)
  useEffect(() => {
    if (route.value.sub?.id === 'schedule' && ref.current) {
      ref.current.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
      ref.current.focus({ preventScroll: true });
    }
  }, [route.value.sub?.id, !!p]);
  if (!p) return null;
  const weekdays = p.mode === 'weekdays';
  const target = weekdays ? 'cycle' : 'weekdays';

  const onSwitch = async () => {
    const r = await ask({
      title: t(weekdays ? 'settings.toCycleTitle' : 'settings.toWeekdaysTitle'),
      body: t(weekdays ? 'settings.toCycleBody' : 'settings.toWeekdaysBody'),
      confirm: t('settings.switch'),
    });
    if (r !== 'confirm') return;
    setMode(target);
    toast(t('settings.switched', { mode: t(weekdays ? 'plan.modeCycle' : 'plan.modeWeekdays') }));
  };

  return (
    <section class="card group-card" id="schedule" ref={ref} tabIndex={-1}>
      <h2 class="card-t">{t('plan.mode')}</h2>
      <div class="srow">
        <span>
          {t(weekdays ? 'plan.modeWeekdays' : 'plan.modeCycle')}
          <small>{t(weekdays ? 'plan.modeWeekdaysHint' : 'plan.modeCycleHint')}</small>
        </span>
      </div>
      <button type="button" class="btn secondary block" onClick={() => void onSwitch()}>
        {t(weekdays ? 'settings.switchToCycle' : 'settings.switchToWeekdays')}
      </button>
    </section>
  );
}
