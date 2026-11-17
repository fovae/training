/**
 * Уход загрузочной заставки (#boot в index.html, 3.23). Полная анимация (html[data-boot=full])
 * держится, пока не доиграет — BOOT_ANIM_MS от начала загрузки страницы, но не меньше самой
 * загрузки, — затем гаснет по прозрачности (BOOT_OUT_MS), под ней уже проявился интерфейс.
 * Во время тренировки (quick) и без анимаций (calm) заставка уходит в тот же кадр, что и раньше.
 */
export const BOOT_ANIM_MS = 1150;
export const BOOT_OUT_MS = 260;

let started = false;

export function hideBoot(): void {
  const el = document.getElementById('boot');
  if (!el || started) return;
  started = true;
  if (document.documentElement.dataset.boot !== 'full') {
    el.remove();
    return;
  }
  const wait = Math.max(0, BOOT_ANIM_MS - performance.now());
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), BOOT_OUT_MS);
  }, wait);
}
