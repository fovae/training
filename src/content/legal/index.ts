import meta from 'virtual:legal-meta';
import type { LegalAcceptance } from '../../types';
import { needsAcceptanceFor } from './acceptance';

/**
 * Юридические документы. Тексты — дословно от юриста (src/content/legal/en/*.md),
 * версии — из их frontmatter (плагин virtual:legal-meta в vite.config.ts).
 * Русской версии пока нет: в русском интерфейсе показываем английский текст с пометкой.
 */
export type LegalDoc = 'privacy' | 'terms';
export const LEGAL_DOCS: LegalDoc[] = ['terms', 'privacy'];
export const LEGAL_META = meta;

/** Тексты грузятся отдельным чанком только при открытии документа */
export async function loadLegal(doc: LegalDoc): Promise<string> {
  const mod = doc === 'privacy' ? await import('./en/privacy.md?raw') : await import('./en/terms.md?raw');
  return mod.default.replace(/^---\n[\s\S]*?\n---\n/, '');
}

export function currentAcceptance(now = new Date()): LegalAcceptance {
  return { privacy: meta.privacy.version, terms: meta.terms.version, at: now.toISOString() };
}

/** Документы нужно (заново) принять: ещё не приняты или выросла версия любого из двух */
export const needsAcceptance = (a: LegalAcceptance | null | undefined): boolean =>
  needsAcceptanceFor(a, meta);
