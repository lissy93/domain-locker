export interface UptimeData {
  checked_at: string;
  is_up: boolean;
  response_code: number;
  response_time_ms: number;
  dns_lookup_time_ms: number;
  ssl_handshake_time_ms: number;
}

export function getUptimeColor(percentage: number, prefix = 'text-'): string {
  if (isNaN(percentage)) return `${prefix}bluegray-400`;
  if (percentage > 99) return `${prefix}green-400`;
  if (percentage > 95) return `${prefix}yellow-400`;
  if (percentage > 90) return `${prefix}orange-400`;
  if (percentage === 0) return `${prefix}bluegray-400`;
  return `${prefix}red-400`;
}

export function getResponseCodeColor(code: number): string {
  if (isNaN(code)) return 'var(--bluegray-400)';
  if (code >= 200 && code < 300) return 'var(--green-400)';
  if (code >= 300 && code < 400) return 'var(--blue-400)';
  if (code >= 400 && code < 500) return 'var(--yellow-400)';
  if (code >= 500) return 'var(--red-400)';
  return 'var(--bluegray-400)';
}

export function getPerformanceColor(
  value: number,
  type: 'ssl' | 'dns' | 'response',
  prefix = 'text-',
  postfix = '-400',
): string {
  if (typeof value !== 'number' || value < 0 || !type) {
    return 'grey';
  }

  // Define ranges for each type
  const thresholds = {
    // in ms
    ssl: { green: 100, yellow: 200, orange: 400 },
    dns: { green: 40, yellow: 80, orange: 150 },
    response: { green: 250, yellow: 500, orange: 1000 },
  };

  // Ensure the type exists in thresholds
  const typeThresholds = thresholds[type];
  if (!typeThresholds || value === 0) {
    return `${prefix}bluegray${postfix}`;
  }

  // Determine the color based on the value
  if (isNaN(value)) {
    return `${prefix}bluegray${postfix}`;
  } else if (value <= typeThresholds.green) {
    return `${prefix}green${postfix}`;
  } else if (value <= typeThresholds.yellow) {
    return `${prefix}yellow${postfix}`;
  } else if (value <= typeThresholds.orange) {
    return `${prefix}orange${postfix}`;
  } else {
    return `${prefix}red${postfix}`;
  }
}
