import type { LegalAcceptance } from '../../types';

export type LegalVersions = Record<'privacy' | 'terms', { version: string }>;

/** Документы нужно (заново) принять: ещё не приняты или выросла версия любого из двух */
export function needsAcceptanceFor(a: LegalAcceptance | null | undefined, meta: LegalVersions): boolean {
  return !a || a.privacy !== meta.privacy.version || a.terms !== meta.terms.version;
}
