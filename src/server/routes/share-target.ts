import { defineEventHandler, readBody, sendRedirect } from 'h3';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const sharedUrl = body?.url || '';
  const domain = extractDomainFromUrl(sharedUrl);

  if (!domain) {
    throw new Error('Invalid domain URL provided');
  }
  return sendRedirect(event, `/domains/add?domain=${encodeURIComponent(domain)}`);
});

function extractDomainFromUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname || null;
  } catch {
    return null;
  }
}
