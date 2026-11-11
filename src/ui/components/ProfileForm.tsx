import { t } from '../../i18n';
import { cmToFtIn, ftInToCm, inputNum, kgToLb, lbToKg, parseDecimal } from '../../lib/format';
import type { Profile, Sex, Units } from '../../types';
import { Field, Seg } from './Controls';

export interface ProfileDraft {
  units: Units;
  weight: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  name: string;
  age: string;
  sex: Sex | null;
}

export type ProfileValue = Pick<Profile, 'weightKg' | 'heightCm' | 'units' | 'name' | 'age' | 'sex'>;
type Errors = Partial<Record<'weight' | 'height' | 'age', string>>;

export function draftFrom(p: Partial<Profile> | null, units: Units = 'metric'): ProfileDraft {
  const u = p?.units ?? units;
  const ftin = p?.heightCm ? cmToFtIn(p.heightCm) : null;
  return {
    units: u,
    weight: p?.weightKg ? inputNum(u === 'imperial' ? kgToLb(p.weightKg) : p.weightKg) : '',
    heightCm: p?.heightCm ? String(p.heightCm) : '',
    heightFt: ftin ? String(ftin.ft) : '',
    heightIn: ftin ? String(ftin.inch) : '',
    name: p?.name ?? '',
    age: p?.age ? String(p.age) : '',
    sex: p?.sex ?? null,
  };
}

/** Мягкая проверка: ошибки показываются только после попытки сохранить */
export function validateProfile(d: ProfileDraft): { errors: Errors; value: ProfileValue | null } {
  const errors: Errors = {};
  const imp = d.units === 'imperial';
  const w = parseDecimal(d.weight);
  const weightKg = w == null ? null : imp ? lbToKg(w) : Math.round(w * 10) / 10;
  if (weightKg == null) errors.weight = t('profile.err.weightRequired');
  else if (weightKg < 25 || weightKg > 350) errors.weight = t('profile.err.weightRange');

  let heightCm: number | null;
  if (imp) {
    const ft = parseDecimal(d.heightFt);
    const inch = parseDecimal(d.heightIn) ?? 0;
    heightCm = ft == null ? null : ftInToCm(ft, inch);
  } else {
    const h = parseDecimal(d.heightCm);
    heightCm = h == null ? null : Math.round(h);
  }
  if (heightCm == null) errors.height = t('profile.err.heightRequired');
  else if (heightCm < 100 || heightCm > 250) errors.height = t('profile.err.heightRange');

  let age: number | undefined;
  if (d.age.trim()) {
    const a = parseDecimal(d.age);
    if (a == null || a < 16 || a > 100) errors.age = t('profile.err.age');
    else age = Math.round(a);
  }

  if (Object.keys(errors).length || weightKg == null || heightCm == null) return { errors, value: null };
  const value: ProfileValue = { weightKg, heightCm, units: d.units };
  const name = d.name.trim().slice(0, 40);
  if (name) value.name = name;
  if (age) value.age = age;
  if (d.sex) value.sex = d.sex;
  return { errors, value };
}

/** Пересчёт уже введённых чисел при смене единиц */
export function switchUnits(d: ProfileDraft, u: Units): ProfileDraft {
  if (u === d.units) return d;
  const { value } = validateProfile(d);
  const w = parseDecimal(d.weight);
  const next = { ...d, units: u };
  if (w != null) next.weight = inputNum(u === 'imperial' ? kgToLb(w) : lbToKg(w));
  const cm = value?.heightCm ?? (d.units === 'metric' ? parseDecimal(d.heightCm) : null);
  if (u === 'imperial' && cm) {
    const { ft, inch } = cmToFtIn(cm);
    next.heightFt = String(ft);
    next.heightIn = String(inch);
  }
  if (u === 'metric' && d.heightFt) {
    next.heightCm = String(ftInToCm(parseDecimal(d.heightFt) ?? 0, parseDecimal(d.heightIn) ?? 0));
  }
  return next;
}

/** update получает функцию: быстрый ввод в несколько полей подряд не теряет значения */
export function ProfileForm({
  draft,
  update,
  errors,
}: {
  draft: ProfileDraft;
  update: (fn: (d: ProfileDraft) => ProfileDraft) => void;
  errors: Errors;
}) {
  const set = (patch: Partial<ProfileDraft>) => update((d) => ({ ...d, ...patch }));
  const imp = draft.units === 'imperial';
  const desc = (id: string, err?: string) => ({
    'aria-invalid': err ? true : undefined,
    'aria-describedby': err ? id + '-err' : undefined,
  });

  return (
    <div class="form">
      <div class="srow">
        <span>{t('profile.units')}</span>
        <Seg
          label={t('profile.units')}
          value={draft.units}
          onChange={(u) => update((d) => switchUnits(d, u))}
          options={[
            { v: 'metric', t: t('profile.metric') },
            { v: 'imperial', t: t('profile.imperial') },
          ]}
        />
      </div>
      <div class="form-row">
        <Field id="pf-weight" label={t(imp ? 'profile.weightLb' : 'profile.weightKg')} error={errors.weight}>
          <input
            id="pf-weight"
            class="text-in"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            value={draft.weight}
            onInput={(e) => set({ weight: e.currentTarget.value })}
            {...desc('pf-weight', errors.weight)}
          />
        </Field>
        {imp ? (
          <Field id="pf-ft" label={t('profile.heightFtIn')} error={errors.height}>
            <div class="ftin">
              <input
                id="pf-ft"
                class="text-in"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                aria-label={t('profile.heightFt')}
                value={draft.heightFt}
                onInput={(e) => set({ heightFt: e.currentTarget.value })}
                {...desc('pf-ft', errors.height)}
              />
              <input
                class="text-in"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={t('profile.heightIn')}
                value={draft.heightIn}
                onInput={(e) => set({ heightIn: e.currentTarget.value })}
              />
            </div>
          </Field>
        ) : (
          <Field id="pf-height" label={t('profile.heightCm')} error={errors.height}>
            <input
              id="pf-height"
              class="text-in"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              value={draft.heightCm}
              onInput={(e) => set({ heightCm: e.currentTarget.value })}
              {...desc('pf-height', errors.height)}
            />
          </Field>
        )}
      </div>
      <p class="muted small">{t('profile.optionalNote')}</p>
      <Field id="pf-name" label={t('profile.name')}>
        <input
          id="pf-name"
          class="text-in"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          value={draft.name}
          onInput={(e) => set({ name: e.currentTarget.value })}
        />
      </Field>
      <Field id="pf-age" label={t('profile.age')} error={errors.age}>
        <input
          id="pf-age"
          class="text-in short"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={draft.age}
          onInput={(e) => set({ age: e.currentTarget.value })}
          {...desc('pf-age', errors.age)}
        />
      </Field>
      <div class="field">
        <span class="field-lb" id="pf-sex-lb">
          {t('profile.sex')}
        </span>
        <Seg
          label={t('profile.sex')}
          value={draft.sex}
          onChange={(v) => set({ sex: v })}
          options={[
            { v: 'female', t: t('profile.female') },
            { v: 'male', t: t('profile.male') },
            { v: 'unspecified', t: t('profile.unspecified') },
          ]}
        />
      </div>
    </div>
  );
}
