import { defineEventHandler, getQuery, getRequestHeader } from 'h3';

export default defineEventHandler(async (event) => {
  // Get the domain name from query params
  const domain = getQuery(event)['domain'] as string;
  if (!domain) {
    return { statusCode: 404, body: { error: 'Domain name is required' } };
  }

  // Get details for the API endpoint
  const AS93_DOMAIN_INFO_URL = import.meta.env['AS93_DOMAIN_INFO_URL'];
  const AS93_DOMAIN_INFO_KEY = import.meta.env['AS93_DOMAIN_INFO_KEY'];
  const useExternalApi = AS93_DOMAIN_INFO_URL && AS93_DOMAIN_INFO_KEY;

  // Create fetch request, to either the external or internal API
  let response;
  try {
    if (useExternalApi) {
      // Use our external API if specified
      response = await fetch(AS93_DOMAIN_INFO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${AS93_DOMAIN_INFO_KEY}`,
        },
        body: JSON.stringify({ domain }),
      });
    } else {
      // Fallback to normal /api/domain-info endpoint
      const host = getRequestHeader(event, 'host');
      const protocol = host?.startsWith('localhost') ? 'http' : 'https';
      const origin = `${protocol}://${host}`;
      const authHeader = getRequestHeader(event, 'authorization');
      const headers = authHeader ? { Authorization: authHeader } : undefined;
      response = await fetch(
        `${origin}/api/domain-info?domain=${encodeURIComponent(domain)}`,
        {
          headers,
        },
      );
    }

    // If response is anything other than 200, return the error
    if (!response.ok) {
      try {
        return { statusCode: response.status, body: await response.json() };
      } catch (_e) {
        return {
          statusCode: response.status,
          body: { error: 'Upstream request failed, with no body' },
        };
      }
    }

    // Success, parse and respond with the JSON
    const data = await response.json();
    const result = data?.body || data;
    return result;
  } catch (error) {
    // If the fetch itself fucked up, return a 500 error
    const msg = error instanceof Error ? error.message : 'Failed to fetch domain info';
    return { statusCode: 500, body: { error: msg } };
  }
});
