import { expect, test, type Page } from '@playwright/test';
import { fresh, onboard } from './helpers';

// Вёрстку меряем в покое: анимация появления сдвигает блоки на время 240 мс
test.use({ contextOptions: { reducedMotion: 'reduce' } });

/**
 * Правило владельца: после любых изменений проверять отступы между ВСЕМИ блоками на всех экранах.
 * Тест ищет «склеенные» блоки: две карточки (плашки, заметки, шапки дня…) одна под другой с зазором
 * меньше MIN_GAP. Необязательные блоки включены: напоминание о копии, советы, история с данными,
 * открытый пункт плана, идущая тренировка.
 */

const MIN_GAP = 8;

/** Блоки с фоном или рамкой, между которыми нужен воздух */
const BLOCKS = [
  '.card',
  '.note',
  '.dayhead',
  '.empty',
  '.item',
  '.lib-card',
  '.backup-reminder',
  '.tip',
  '.toc',
  '.pic',
  '.ex',
  '.week-chip',
  '.seg',
  '.btn',
  '.list > li',
  '.row',
].join(', ');

async function glued(page: Page, where: string): Promise<string[]> {
  return page.evaluate(
    ([sel, min, where]) => {
      const vis = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // Содержимое закрытого <details> WebKit всё равно раскладывает — не учитываем
        const closed = el.closest('details:not([open])');
        if (closed && !el.closest('summary')) return false;
        return r.width > 40 && r.height > 16 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const els = [...document.querySelectorAll(`main ${sel}`)].filter(vis);
      const name = (el: Element) =>
        (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).join('.')
          : el.tagName) +
        ' «' +
        (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28) +
        '»';
      const out: string[] = [];
      for (const a of els)
        for (const b of els) {
          if (a === b || a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          // b ниже a, по горизонтали перекрываются заметно
          const overlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          if (overlap < Math.min(ra.width, rb.width) * 0.4) continue;
          const gap = rb.top - ra.bottom;
          if (gap < -1 || gap >= min) continue;
          // кнопки внутри одной панели действий — не карточки: пропускаем пары «кнопка–кнопка» в одной строке
          if (a.matches('.btn') && b.matches('.btn') && a.parentElement === b.parentElement) continue;
          out.push(`${where}: ${name(a)} → ${name(b)} gap ${gap.toFixed(1)}px`);
        }
      return out;
    },
    [BLOCKS, MIN_GAP, where] as const,
  );
}

async function scan(page: Page, where: string, issues: string[]) {
  await page.waitForSelector('main .screen');
  await page.waitForTimeout(150);
  issues.push(...(await glued(page, where)));
}

for (const lang of ['en', 'ru'] as const) {
  test(`no glued blocks on any screen (${lang})`, async ({ page, browserName }, info) => {
    test.skip(browserName !== 'webkit' || !['iPhone 11', 'iPhone 15 Pro Max'].includes(info.project.name));
    test.setTimeout(120_000);
    const issues: string[] = [];
    await fresh(page);
    await scan(page, 'onboarding-language', issues);
    await onboard(page, { lang });
    // Тренировка с подходом → история, рекорды, напоминание о копии (копии ещё не было)
    await page.goto('./#/today');
    await page.locator('main .btn.on-color').first().click();
    await page.locator('.set input[inputmode="decimal"]').first().fill('20');
    await page.locator('.set input[inputmode="numeric"]').first().fill('10');
    await page.locator('.set-done').first().click();
    await scan(page, 'today-workout', issues);
    await page.locator('.dayhead-cta .btn.on-color').click();
    await page.getByRole('alertdialog').locator('.btn.primary, .btn.danger').last().click();
    await page.waitForTimeout(300);
    for (const r of [
      'today',
      'plan',
      'library',
      'library/back-squat',
      'history',
      'settings',
      'legal/terms',
    ]) {
      await page.goto('./#/' + r);
      if (r === 'plan') {
        await page.waitForSelector('.item summary');
        await page.locator('.item summary').first().click();
      }
      await scan(page, r, issues);
    }
    // История: тренировка и упражнение
    await page.goto('./#/history');
    await page.locator('main a[href^="#/history/workout/"]').first().click();
    await scan(page, 'history-workout', issues);
    await page.goto('./#/history');
    const ex = page.locator('main a[href^="#/history/exercise/"]').first();
    if (await ex.count()) {
      await ex.click();
      await scan(page, 'history-exercise', issues);
    }
    expect(issues).toEqual([]);
  });
}
