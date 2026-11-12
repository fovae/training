import { picMarkup } from '../../data/exercises';

/** Схема движения. Разметка статична и генерируется из src/pics — безопасна для innerHTML. */
export function Pic({ pic }: { pic?: string | undefined }) {
  const html = pic ? picMarkup(pic) : null;
  if (!html) return null;
  return <div class="pic" dangerouslySetInnerHTML={{ __html: html }} />;
}
