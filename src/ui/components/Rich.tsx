import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';

/**
 * Перевод с вставками-компонентами: «I accept the {terms} and the {privacy}» →
 * текст + ссылки. Порядок слов задаёт словарь, поэтому вставки работают в любом языке.
 */
export function Rich({ k, parts }: { k: string; parts: Record<string, ComponentChildren> }) {
  const src = t(k);
  const out: ComponentChildren[] = [];
  let last = 0;
  for (const m of src.matchAll(/\{(\w+)\}/g)) {
    out.push(src.slice(last, m.index));
    out.push(parts[m[1]!] ?? m[0]);
    last = m.index + m[0].length;
  }
  out.push(src.slice(last));
  return <>{out}</>;
}
