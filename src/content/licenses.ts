export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  text: string;
}

/** Список собирается при сборке (scripts/licenses.mjs) и грузится отдельным чанком */
export async function loadLicenses(): Promise<LicenseEntry[]> {
  return (await import('./generated/licenses.json')).default as LicenseEntry[];
}
