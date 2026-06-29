const pad = (value: number): string => String(value).padStart(2, '0');

// Format y/m/d as YYYY-MM-DD, only if it is a real calendar date (rejects e.g. Feb 31)
const toIsoDate = (year: number, month: number, day: number): string | undefined => {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? `${year}-${pad(month)}-${pad(day)}` : undefined;
};

// Parse a whois/rdap/cert date to YYYY-MM-DD, with no timezone round-trip to shift the day
export const parseDate = (date: string | null | undefined): string | undefined => {
  if (!date) return undefined;
  const cleaned = date
    .trim()
    .replace(/\s+[A-Z]+$/, '')
    .trim();

  // ISO-ish (YYYY-MM-DD...) - keep the date part verbatim
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // DD/MM/YYYY or DD.MM.YYYY - day-first unless a value can only be a day (ambiguous when both <= 12)
  const dmy = cleaned.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const [day, month] =
      first > 12 ? [first, second] : second > 12 ? [second, first] : [first, second];
    return toIsoDate(Number(dmy[3]), month, day);
  }

  // Other formats (e.g. "15 Jan 2025") - require a year so a bare time never becomes today
  if (!/\d{4}/.test(cleaned)) return undefined;
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime())
    ? undefined
    : toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
};
