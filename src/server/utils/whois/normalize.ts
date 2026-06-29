import type { WhoisResult } from './types';

export const hasUsefulWhoisData = (result: WhoisResult | null): result is WhoisResult =>
  Boolean(
    result &&
    (result.dates.expiry_date ||
      result.registrar.name ||
      result.registrar.id ||
      result.registrar.registryDomainId),
  );

/* Drop literal REDACTED placeholders, keeping only real values */
export const cleanRedacted = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return !trimmed || /^redacted/i.test(trimmed) ? undefined : trimmed;
};
