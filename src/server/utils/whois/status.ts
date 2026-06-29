const KNOWN_STATUSES = [
  'clientDeleteProhibited',
  'clientHold',
  'clientRenewProhibited',
  'clientTransferProhibited',
  'clientUpdateProhibited',
  'serverDeleteProhibited',
  'serverHold',
  'serverRenewProhibited',
  'serverTransferProhibited',
  'serverUpdateProhibited',
  'inactive',
  'ok',
  'pendingCreate',
  'pendingDelete',
  'pendingRenew',
  'pendingRestore',
  'pendingTransfer',
  'pendingUpdate',
  'addPeriod',
  'autoRenewPeriod',
  'renewPeriod',
  'transferPeriod',
];
const STATUS_BY_TOKEN = new Map(KNOWN_STATUSES.map((s) => [s.toLowerCase(), s]));

/* Extract canonical ICANN codes from whois text or rdap's space-separated phrases */
export const parseStatusArray = (status?: string | string[]): string[] => {
  if (!status) return [];
  const found = new Set<string>();
  for (const part of Array.isArray(status) ? status : [status]) {
    const lower = part.toLowerCase();
    // whois free text, e.g. "clientTransferProhibited https://icann.org/epp#..."
    for (const token of lower.split(/[^a-z]+/)) {
      const code = STATUS_BY_TOKEN.get(token);
      if (code) found.add(code);
    }
    // rdap rfc-9083 phrase, e.g. "client transfer prohibited"
    const phrase = STATUS_BY_TOKEN.get(lower.replace(/[^a-z]+/g, ''));
    if (phrase) found.add(phrase);
  }
  return [...found];
};
