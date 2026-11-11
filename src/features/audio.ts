/**
 * Звуковой сигнал окончания отдыха через Web Audio.
 * iOS разрешает звук только после жеста пользователя — поэтому контекст
 * создаётся и «разблокируется» первым тапом/нажатием клавиши.
 * Если Web Audio недоступен, остаётся визуальная вспышка.
 */

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function unlock(): void {
  const Ctor = getCtor();
  if (!Ctor) return;
  try {
    // Safari 17+: короткие сигналы не останавливают музыку пользователя надолго.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'transient';
  } catch {
    /* ignore */
  }
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    // Тихий буфер окончательно разблокирует вывод на iOS
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    ctx = null;
  }
}

export function installAudioUnlock(): void {
  const once = () => {
    unlock();
    if (ctx) {
      removeEventListener('pointerdown', once, true);
      removeEventListener('keydown', once, true);
    }
  };
  addEventListener('pointerdown', once, true);
  addEventListener('keydown', once, true);
}

export const audioAvailable = (): boolean => getCtor() !== null;

/** Три коротких сигнала */
export function beep(): void {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((dt, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.18);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.2);
    });
  } catch {
    /* ignore */
  }
}
