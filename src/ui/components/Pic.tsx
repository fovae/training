import { PICS, picMarkup, type PicKey } from '../../pics/defs';

const isPic = (k: string): k is PicKey => k in PICS;

/** Схема движения. Разметка статична и генерируется из src/pics — безопасна для innerHTML. */
export function Pic({ pic }: { pic?: string | undefined }) {
  if (!pic || !isPic(pic)) return null;
  return <div class="pic" dangerouslySetInnerHTML={{ __html: picMarkup(pic) }} />;
}
