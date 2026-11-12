import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { LOCALES, fmtNum, locale, setLocale, t } from '../../i18n';
import { TEMPLATES, buildPlan, findTemplate } from '../../data/templates';
import { plan, setPlan } from '../../state/plan';
import { draftUnits, saveProfile } from '../../state/settings';
import { go, toast } from '../../state/ui';
import type { LegalAcceptance, Level, Plan } from '../../types';
import { Choice, Seg, Stepper } from '../components/Controls';
import { Rich } from '../components/Rich';
import { currentAcceptance } from '../../content/legal';
import { ProfileForm, draftFrom, validateProfile, type ProfileDraft } from '../components/ProfileForm';
import { Icon } from '../components/Icon';

const STEPS = ['language', 'terms', 'profile', 'level', 'plan'] as const;
type Step = (typeof STEPS)[number];

/** Состояние живёт вне компонента: переход на страницу условий и назад ничего не теряет */
const step = signal<Step>('language');
const adult = signal(false);
/** Принятые версии документов — записываются при «Далее» на шаге условий */
const accepted = signal<LegalAcceptance | null>(null);
const termsTried = signal(false);
const draft = signal<ProfileDraft | null>(null);
const profileTried = signal(false);
const level = signal<Level | null>(null);
const mode = signal<Plan['mode']>('cycle');
const dayCount = signal(3);
const start = signal<string>('empty');

function resetOnboarding(): void {
  step.value = 'language';
  adult.value = false;
  accepted.value = null;
  termsTried.value = false;
  draft.value = null;
  profileTried.value = false;
  level.value = null;
  mode.value = 'cycle';
  dayCount.value = 3;
  start.value = 'empty';
}

export function Onboarding() {
  const s = step.value;
  const i = STEPS.indexOf(s);
  const headRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    // Фокус на заголовок шага — для экранных дикторов. До отрисовки, чтобы не перехватить ввод.
    headRef.current?.focus();
    window.scrollTo(0, 0);
  }, [s]);

  useEffect(() => {
    if (!draft.value) draft.value = draftFrom(null, draftUnits.value);
  }, []);

  const back = () => i > 0 && (step.value = STEPS[i - 1]!);
  const next = async () => {
    if (s === 'terms') {
      if (!adult.value) {
        termsTried.value = true;
        return;
      }
      // Версии берутся из метаданных файлов документов (src/content/legal)
      accepted.value = currentAcceptance();
    }
    if (s === 'profile') {
      profileTried.value = true;
      if (!validateProfile(draft.value!).value) return;
    }
    if (s === 'level' && !level.value) return;
    if (s === 'plan') return finish();
    step.value = STEPS[i + 1]!;
  };

  const finish = async () => {
    const pv = validateProfile(draft.value!).value;
    if (!pv || !level.value) return;
    try {
      {
        await setPlan(
          buildPlan({
            templateId: start.value === 'empty' ? null : start.value,
            days: dayCount.value,
            mode: mode.value,
            level: level.value,
          }),
        );
      }
      await saveProfile({
        ...pv,
        level: level.value,
        locale: locale.value,
        adult16Confirmed: true,
        confirmedAt: new Date().toISOString(),
        legalAccepted: accepted.value ?? currentAcceptance(),
      });
      resetOnboarding();
      const empty = !plan.value?.days.some((d) => d.items.length);
      go(empty ? 'plan' : 'today');
      if (empty) toast(t('onb.emptyPlanToast'));
    } catch (e) {
      console.error(e);
      toast(t('common.saveFailed'));
    }
  };

  const canNext = (s !== 'level' || !!level.value) && (s !== 'terms' || adult.value || !termsTried.value);

  return (
    <div class="screen onboarding">
      <header class="topbar">
        <div class="eyebrow">{t('onb.step', { n: i + 1, total: STEPS.length })}</div>
        <h1 class="screen-title" tabIndex={-1} ref={headRef}>
          {t(`onb.${s}.title`)}
        </h1>
        <div class="ob-progress" aria-hidden="true">
          {STEPS.map((x, k) => (
            <i key={x} class={k <= i ? 'on' : ''} />
          ))}
        </div>
      </header>

      {s === 'language' && <LanguageStep />}
      {s === 'terms' && <TermsStep />}
      {s === 'profile' && draft.value && (
        <section class="card">
          <p class="muted small">{t('onb.profile.lead')}</p>
          <ProfileForm
            draft={draft.value}
            update={(fn) => (draft.value = fn(draft.value!))}
            errors={profileTried.value ? validateProfile(draft.value).errors : {}}
          />
        </section>
      )}
      {s === 'level' && (
        <section>
          <p class="muted">{t('onb.level.lead')}</p>
          <Choice
            label={t('onb.level.title')}
            value={level.value}
            onChange={(v) => (level.value = v)}
            options={(['first', 'few', 'intermediate', 'veteran'] as const).map((v) => ({
              v,
              t: t(`level.${v}`),
              d: t(`level.desc.${v}`),
            }))}
          />
        </section>
      )}
      {s === 'plan' && <PlanStep />}

      <div class="ob-actions">
        {i > 0 && (
          <button type="button" class="btn secondary" onClick={back}>
            <Icon name="back" size={18} /> {t('common.back')}
          </button>
        )}
        <button type="button" class="btn primary" aria-disabled={!canNext} onClick={() => void next()}>
          {s === 'plan' ? t('onb.finish') : t('common.next')}
          {s !== 'plan' && <Icon name="chevron" size={18} />}
        </button>
      </div>
    </div>
  );
}

function LanguageStep() {
  return (
    <section>
      <p class="muted">{t('onb.language.lead')}</p>
      <Choice
        label={t('onb.language.title')}
        value={locale.value}
        onChange={(v) => void setLocale(v)}
        options={LOCALES.map((l) => ({ v: l.code, t: l.native }))}
      />
    </section>
  );
}

function TermsStep() {
  const showErr = termsTried.value && !adult.value;
  return (
    <section class="card">
      <label class={'check' + (showErr ? ' invalid' : '')}>
        <input
          type="checkbox"
          checked={adult.value}
          aria-describedby={showErr ? 'adult-err' : undefined}
          onChange={(e) => (adult.value = e.currentTarget.checked)}
        />
        <span>
          <Rich
            k="legal.adultLabel"
            parts={{
              terms: <a href="#/legal/terms">{t('legal.termsLink')}</a>,
              privacy: <a href="#/legal/privacy">{t('legal.privacyLink')}</a>,
            }}
          />
        </span>
      </label>
      {showErr && (
        <p class="field-err" id="adult-err" role="alert">
          {t('legal.adultRequired')}
        </p>
      )}
      <p class="muted small">{t('onb.terms.noBirthdate')}</p>
      <div class="note warn">
        <span aria-hidden="true">⚠️</span>
        <span>{t('legal.disclaimer')}</span>
      </div>
    </section>
  );
}

function PlanStep() {
  const tpl = findTemplate(start.value);
  const options = [
    { v: 'empty', t: t('onb.plan.empty'), d: t('onb.plan.emptyDesc') },
    ...TEMPLATES.map((x) => ({
      v: x.id,
      t: t(x.nameKey),
      d: t(x.descKey) + (x.fixedDays ? ' ' + t('onb.plan.fixedDays', { count: x.fixedDays }) : ''),
    })),
  ];
  return (
    <section>
      {
        <div class="card group-card">
          <div class="srow">
            <span>{t('plan.mode')}</span>
            <Seg
              label={t('plan.mode')}
              value={mode.value}
              onChange={(v) => (mode.value = v)}
              options={[
                { v: 'weekdays', t: t('plan.modeWeekdays') },
                { v: 'cycle', t: t('plan.modeCycle') },
              ]}
            />
          </div>
          <p class="muted small">
            {t(mode.value === 'weekdays' ? 'plan.modeWeekdaysHint' : 'plan.modeCycleHint')}
          </p>
          <div class="srow">
            <span>{t('onb.plan.days')}</span>
            {tpl?.fixedDays ? (
              <b>{fmtNum(tpl.fixedDays)}</b>
            ) : (
              <Stepper
                label={t('onb.plan.days')}
                value={dayCount.value}
                min={1}
                max={7}
                step={1}
                format={(v) => fmtNum(v)}
                onChange={(v) => (dayCount.value = v)}
              />
            )}
          </div>
        </div>
      }
      <h2 class="ob-sub">{t('onb.plan.start')}</h2>
      <Choice
        label={t('onb.plan.start')}
        value={start.value}
        onChange={(v) => (start.value = v)}
        options={options}
      />
      <p class="muted small">{t('onb.plan.levelNote')}</p>
      <p class="muted small">{t('onb.plan.later')}</p>
    </section>
  );
}
