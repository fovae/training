import { picMarkup, type PicKey } from '../../pics/defs';

/** Схема движения. Разметка статична и генерируется из src/pics — безопасна для innerHTML. */
export function Pic({ pic }: { pic?: PicKey | undefined }) {
  if (!pic) return null;
  return <div class="pic" dangerouslySetInnerHTML={{ __html: picMarkup(pic) }} />;
}
