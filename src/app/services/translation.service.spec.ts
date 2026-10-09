import { describe, expect, it } from 'vitest';
import { selectLanguage } from '~/app/utils/language-preference';

describe('selectLanguage', () => {
  it('gives an explicit URL language precedence over a stored preference', () => {
    expect(selectLanguage('de', 'fr', 'en')).toBe('de');
  });

  it('uses the stored preference when no URL language is provided', () => {
    expect(selectLanguage(null, 'fr', 'en')).toBe('fr');
  });

  it('falls back to the default language when neither source is set', () => {
    expect(selectLanguage(null, null, 'en')).toBe('en');
  });
});
