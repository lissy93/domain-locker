import { defineEventHandler } from 'h3';
import Parser from 'rss-parser';

interface Service {
  service: string;
  rss: string;
}

interface HistoryItem {
  service: string;
  date: string;
  details: string;
  link: string;
  severity: Severity;
  severityIcon: SeverityIcon;
}

type Severity = 'operational' | 'info' | 'minor' | 'critical' | 'unknown';
type SeverityIcon = '✅' | 'ℹ️' | '⚠️' | '❌' | '❔';

interface FeedItem {
  title: string;
  pubDate: string;
  link: string;
  description: string;
}

interface StatusResults {
  summary: { service: string; status: Severity; details: string }[];
  history: HistoryItem[];
  scheduled: HistoryItem[];
}

// Cache to store the last fetched data, and TTL
const cache: { timestamp: number; data: StatusResults | null } = {
  timestamp: 0,
  data: null,
};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// List of services to monitor
const services: Service[] = [
  {
    service: 'Resend',
    rss: 'https://resend-status.com/feed.rss',
  },
  {
    service: 'Supabase',
    rss: 'https://status.supabase.com/history.rss',
  },
  {
    service: 'Stripe',
    rss: 'https://www.stripestatus.com/history.rss',
  },
  {
    service: 'Twilio',
    rss: 'https://status.twilio.com/history.rss',
  },
  {
    service: 'Cloudflare',
    rss: 'https://www.cloudflarestatus.com/history.rss',
  },
  {
    service: 'Vercel',
    rss: 'https://www.vercel-status.com/history.rss',
  },
  {
    service: 'Formbricks',
    rss: 'https://status.formbricks.com/feed.xml',
  },
  {
    service: 'Freshdesk',
    rss: 'https://freshdesk.freshstatus.io/rss',
  },
  {
    service: 'GitHub',
    rss: 'https://www.githubstatus.com/history.rss',
  },
  // {
  //   service: 'GitHub',
  //   rss: 'https://www.githubstatus.com/history.rss',
  // },
];

/**
 * Uses native fetch with an AbortController and rss-parser to retrieve and parse the RSS feed.
 * Returns an array of normalized items.
 */
async function fetchRSS(rssUrl: string): Promise<FeedItem[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(rssUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS: ${response.statusText}`);
    }

    const xml = await response.text();
    const parser = new Parser();
    const feed = await parser.parseString(xml);

    return (feed.items || []).map((item) => ({
      title: item.title ?? '',
      pubDate: item.isoDate || item.pubDate || '',
      link: item.link ?? '',
      description: item.contentSnippet || item.content || '',
    }));
  } catch {
    // On any error, return an empty array.
    return [];
  }
}

/**
 * Returns a severity type based on textual analysis.
 * 'critical' if it includes severe keywords,
 * 'minor' if it includes less severe keywords,
 * or 'unknown' if nothing decisive is found.
 */
function getSeverityType(item: { title: string; description?: string }): Severity {
  const infoWords = ['scheduled', 'maintenance', 'planned'];
  const criticalWords = [
    'major',
    'outage',
    'down',
    'severe',
    'broken',
    'failure',
    'unavailable',
  ];
  const minorWords = [
    'partial',
    'degraded',
    'intermittent',
    'slow',
    'delays',
    'issues',
    'issue',
    'latency',
    'temporarily',
    'disruption',
    'degradation',
    'performance',
    'some',
    'queued',
  ];
  const goodWords = ['operational', 'all systems operational', 'no issues'];

  const text = (item.title + ' ' + (item.description || '')).toLowerCase();
  if (criticalWords.some((word) => text.includes(word))) return 'critical';
  if (minorWords.some((word) => text.includes(word))) return 'minor';
  if (infoWords.some((word) => text.includes(word))) return 'info';
  if (goodWords.some((word) => text.includes(word))) return 'operational';
  return 'unknown';
}

/**
 * Maps a severity type to a corresponding emoji.
 */
function mapSeverity(severityType: Severity): SeverityIcon {
  if (severityType === 'critical') return '❌';
  if (severityType === 'minor') return '⚠️';
  if (severityType === 'info') return 'ℹ️';
  if (severityType === 'operational') return '✅';
  return '❔';
}

/**
 * Returns the service summary based on past feed items.
 * Filters out resolved items (those that include 'resolved' or 'fixed').
 * Items older than 24h (if critical) or 12h (if minor/unknown) are considered resolved.
 * If no unresolved items remain, returns All good (✅).
 */
function getServiceSummary(pastItems: FeedItem[]): {
  status: Severity;
  details: string;
  link?: string;
} {
  if (pastItems.length === 0) {
    return { status: 'operational', details: 'Operational' };
  }

  // Sort past items by publication date (newest first)
  const sorted = pastItems
    .slice()
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  const now = Date.now();

  for (const item of sorted) {
    const combined = (item.title + ' ' + item.description).toLowerCase();
    // Skip items that indicate resolution.
    if (combined.includes('resolved') || combined.includes('fixed')) {
      continue;
    }

    const severityType = getSeverityType(item);
    const published = new Date(item.pubDate).getTime();
    const hoursSince = (now - published) / (1000 * 60 * 60);
    // Set thresholds: 24h for critical, 12h for minor/unknown.
    const threshold = severityType === 'critical' ? 24 : 12;
    if (hoursSince > threshold) continue;

    // Return summary based on the issue
    return { status: severityType, details: item.title, link: item.link };
  }

  return { status: 'operational', details: 'Operational' };
}

export default defineEventHandler(async (event) => {
  // Caching and headers
  event.node.res.setHeader(
    'Cache-Control',
    'public, max-age=900, stale-while-revalidate=30',
  );
  event.node.res.setHeader('Content-Type', 'application/json');

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  // Process each service concurrently.
  const serviceResults = await Promise.all(
    services.map(async (svc) => {
      const items = await fetchRSS(svc.rss);
      // Partition items into past/present and future.
      const now = Date.now();
      const pastItems = items.filter((item) => new Date(item.pubDate).getTime() <= now);
      const futureItems = items.filter((item) => new Date(item.pubDate).getTime() > now);

      const summary = getServiceSummary(pastItems);

      // Map past items for history with severity.
      const historyItems = pastItems.map((item) => ({
        service: svc.service,
        date: item.pubDate,
        details: item.title,
        link: item.link,
        severity: getSeverityType(item),
        severityIcon: mapSeverity(getSeverityType(item)),
      }));

      // Map future (scheduled) items. Mark severity as informational (ℹ️).
      const scheduledItems = futureItems.map((item) => ({
        service: svc.service,
        date: item.pubDate,
        details: item.title,
        link: item.link,
        severity: 'info' as Severity,
        severityIcon: 'ℹ️' as SeverityIcon,
      }));

      return {
        service: svc.service,
        status: summary.status,
        details: summary.details,
        historyItems,
        scheduledItems,
      };
    }),
  );

  // Build the overall summary array.
  const summary = serviceResults.map((result) => ({
    service: result.service,
    status: result.status,
    details: result.details,
  }));

  // Combine all history logs (past items) and sort by date (most recent first).
  let history: HistoryItem[] = serviceResults.flatMap((result) => result.historyItems);
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  // Combine all scheduled logs (future items) and sort by date (most recent first).
  let scheduled: HistoryItem[] = serviceResults.flatMap(
    (result) => result.scheduledItems,
  );
  scheduled.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (scheduled.length > 100) {
    scheduled = scheduled.slice(0, 100);
  }

  // Prepare the final results object
  const results = { summary, history, scheduled };

  // Update cache
  cache.timestamp = now;
  cache.data = results;

  // And then return results, and go to bed
  return results;
});
