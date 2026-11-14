/**
 * iOS, установленное приложение: при запуске (и иногда при возврате в приложение) окно считается
 * короче экрана на высоту статус-бара, пока его не тронешь. Нижняя панель в это время обрезается
 * полосой. Первое касание или прокрутка чинят окно — делаем то же сами: прокрутка на 1 px и обратно,
 * когда высота окна меньше большой высоты экрана (100lvh). Страница короче экрана на время «пинка»
 * получает запас в 2 px, чтобы прокрутка вообще была возможна.
 */
export function installViewportFix(): void {
  // только установленное приложение iOS (в Safari navigator.standalone === false)
  if ((navigator as Navigator & { standalone?: boolean }).standalone !== true) return;
  if (!CSS.supports('height', '100lvh')) return;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
  const short = () => innerHeight < probe.offsetHeight - 1;
  let busy = false;
  const kick = () => {
    if (busy || document.hidden) return;
    if (!probe.isConnected) document.body.appendChild(probe);
    if (!short()) return;
    busy = true;
    const root = document.documentElement;
    const y = scrollY;
    const prevMin = root.style.minHeight;
    root.style.minHeight = 'calc(100lvh + 2px)';
    scrollTo(0, y + 1);
    requestAnimationFrame(() => {
      scrollTo(0, y);
      root.style.minHeight = prevMin;
      busy = false;
    });
  };
  const soon = () => {
    // окно «доходит» не сразу: проверяем несколько раз в первые полсекунды
    for (const ms of [0, 120, 400]) setTimeout(kick, ms);
  };
  if (document.readyState === 'complete') soon();
  else addEventListener('load', soon, { once: true });
  addEventListener('pageshow', soon);
  document.addEventListener('visibilitychange', () => document.hidden || soon());
  addEventListener('orientationchange', soon);
}
