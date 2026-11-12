import { h } from 'preact';
import { checkWeight } from '../advice/weight';
import { performances } from '../advice/rules';
import { t } from '../i18n';
import { fmtWeight } from '../lib/format';
import { history } from '../state/session';
import { profile, settings, updateSettings } from '../state/settings';
import { ask } from '../state/ui';

/**
 * Проверка веса снаряда при вводе подхода: опечатка (×8 от прошлой записи) и нереальный вес
 * (по таблице src/data/weightLimits.ts). Окно не блокирует: «Всё верно» сохраняет вес.
 * Возвращает вес для сохранения или null — человек выбрал «Исправить».
 */
export async function confirmWeight(exerciseId: string, weightKg: number): Promise<number | null> {
  const p = profile.value;
  const last = performances(history.value, exerciseId)[0];
  const lastWeightKg = last
    ? Math.max(0, ...last.sets.filter((s) => s.done).map((s) => s.weightKg ?? 0))
    : null;
  const res = checkWeight({
    exerciseId,
    weightKg,
    bodyWeightKg: p?.weightKg,
    sex: p?.sex,
    level: p?.level,
    lastWeightKg,
    ignored: settings.value.weightWarningIgnored,
  });
  if (!res) return weightKg;

  if (res.kind === 'typo') {
    const r = await ask({
      title: t('weight.typoTitle', { value: fmtWeight(res.suggestionKg) }),
      body: t('weight.typoBody', { entered: fmtWeight(weightKg), last: fmtWeight(lastWeightKg) }),
      confirm: t('weight.fix'),
      cancel: t('weight.correct'),
    });
    return r === 'confirm' ? res.suggestionKg : weightKg;
  }

  let dontWarn = false;
  const r = await ask({
    title: t('legal.weightWarnTitle'),
    body: h('div', { class: 'weight-warn' }, [
      h('p', null, t('legal.weightWarnBody')),
      h('label', { class: 'check' }, [
        h('input', {
          type: 'checkbox',
          onChange: (e: Event) => (dontWarn = (e.currentTarget as HTMLInputElement).checked),
        }),
        h('span', null, t('weight.dontWarn')),
      ]),
    ]),
    confirm: t('weight.fix'),
    cancel: t('weight.correct'),
  });
  if (dontWarn)
    updateSettings({
      weightWarningIgnored: [...new Set([...settings.value.weightWarningIgnored, exerciseId])],
    });
  return r === 'confirm' ? null : weightKg;
}
