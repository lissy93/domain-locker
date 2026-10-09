export function selectLanguage(
  languageFromUrl: string | null,
  languageFromStorage: string | null,
  defaultLanguage: string,
): string {
  return languageFromUrl || languageFromStorage || defaultLanguage;
}
