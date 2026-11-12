import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCALES, fmtDate, locale, setLocale, t } from '../../i18n';
import { CONTACT_EMAIL } from '../../lib/meta';
import { profile, saveProfile, settings, updateProfile, updateSettings } from '../../state/settings';
import { ask, route, toast } from '../../state/ui';
import { history } from '../../state/session';
import { plan, setMode } from '../../state/plan';
import {
  applyBackup,
  checkPersist,
  exportData,
  parseBackup,
  persistStatus,
  requestPersist,
  resetAll,
} from '../../features/backup';
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
import type { Level, Settings as S } from '../../types';
import { Icon } from '../components/Icon';
import { Seg, Stepper, Toggle } from '../components/Controls';
import { ProfileForm, draftFrom, validateProfile, type ProfileDraft } from '../components/ProfileForm';

export function Settings() {
  const s = settings.value;
  const set = <K extends keyof S>(k: K, v: S[K]) => updateSettings({ [k]: v } as Partial<S>);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkPersist();
  }, []);

  const onExport = async () => {
    try {
      const r = await exportData();
      if (r === 'downloaded') toast(t('backup.downloaded'));
      if (r === 'shared') toast(t('backup.shared'));
    } catch (e) {
      console.error(e);
      toast(t('backup.exportFailed'));
    }
  };

  const onImportFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error(t('backup.errTooBig'));
      const parsed = parseBackup(await file.text());
      const n = parsed.sessions.length;
      const ok = await ask({
        title: t('backup.restoreTitle'),
        body: (
          <>
            {t('backup.restoreCount', { count: n })}
            {parsed.exportedAt
              ? ' ' + t('backup.restoreDate', { date: fmtDate(Date.parse(parsed.exportedAt)) })
              : ''}
            <br />
            {t('backup.restoreReplace', { count: history.value.length })}
          </>
        ),
        confirm: t('backup.replace'),
        danger: true,
      });
      if (ok !== 'confirm') return;
      await applyBackup(parsed);
      toast(t('backup.restored'));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('backup.errRead'));
    }
  };

  const onReset = async () => {
    const r = await ask({
      title: t('reset.title'),
      body: t('reset.body'),
      confirm: t('reset.confirm'),
      danger: true,
      extra: { label: t('reset.exportFirst') },
    });
    if (r === 'extra') {
      await onExport();
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
          <label class="select">
            <span class="sr-only">{t('settings.language')}</span>
            <select
              aria-label={t('settings.language')}
              value={locale.value}
              onChange={(e) => {
                const code = e.currentTarget.value;
                void setLocale(code).then(() => updateProfile({ locale: code }));
              }}
            >
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code} lang={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="srow">
          <span>{t('settings.theme')}</span>
          <Seg
            label={t('settings.theme')}
            value={s.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { v: 'system', t: t('settings.themeAuto') },
              { v: 'light', t: t('settings.themeLight') },
              { v: 'dark', t: t('settings.themeDark') },
            ]}
          />
        </div>
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

      <section class="card group-card">
        <h2 class="card-t">{t('settings.data')}</h2>
        <p class="muted small">{t('settings.dataHint')}</p>
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
        <div class="btn-row">
          <button type="button" class="btn secondary" onClick={() => void onExport()}>
            <Icon name="share" size={18} /> {t('backup.export')}
          </button>
          <button type="button" class="btn secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {t('backup.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImportFile(e)}
            data-testid="import-input"
          />
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
          <span>{t('about.contact')}</span>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </div>
        <ul class="list">
          <li>
            <a class="row" href="#/legal/privacy">
              <span class="row-main">
                <b>{t('legal.privacy.title')}</b>
              </span>
              <Icon name="chevron" size={18} />
            </a>
          </li>
          <li>
            <a class="row" href="#/legal/terms">
              <span class="row-main">
                <b>{t('legal.terms.title')}</b>
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
        <label class="select">
          <span class="sr-only">{t('settings.level')}</span>
          <select
            aria-label={t('settings.level')}
            value={p.level}
            onChange={(e) => updateProfile({ level: e.currentTarget.value as Level })}
          >
            {(['first', 'few', 'intermediate', 'veteran'] as const).map((v) => (
              <option key={v} value={v}>
                {t(`level.${v}`)}
              </option>
            ))}
          </select>
        </label>
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
      ref.current.scrollIntoView({ block: 'center' });
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
