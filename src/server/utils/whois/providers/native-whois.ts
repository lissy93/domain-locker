import { execFile } from 'child_process';
import { promisify } from 'util';
import type { WhoisResult } from '../types';
import { parseDate } from '../dates';
import { parseStatusArray } from '../status';
import Logger from '../../logger';

const execFileAsync = promisify(execFile);
const log = new Logger('whois');

/* Try the native whois command as a fallback when libraries fail */
export const tryNativeWhois = async (domain: string): Promise<WhoisResult | null> => {
  // Skip native whois on serverless environments where system packages aren't available
  if (
    process.env['VERCEL'] ||
    process.env['AWS_LAMBDA_FUNCTION_NAME'] ||
    process.env['NETLIFY']
  ) {
    return null;
  }

  try {
    // Sanitize domain input to prevent command injection
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
    if (!sanitizedDomain || sanitizedDomain !== domain) {
      log.warn(`Invalid domain format for native whois: ${domain}`);
      return null;
    }

    const { stdout } = await execFileAsync('whois', [sanitizedDomain], {
      timeout: 10000,
    });

    if (!stdout || stdout.length < 50) {
      log.warn(
        `Native whois returned insufficient data for ${domain}: ${stdout?.length || 0} bytes`,
      );
      return null;
    }

    // Parse key-value pairs, collecting every status line (not just the last)
    const data: Record<string, string> = {};
    const statuses: string[] = [];

    for (const line of stdout.split(/\r?\n/)) {
      const match = line.trim().match(/^([^:]+):\s*(.+)$/);
      if (!match) continue;
      const key = match[1]
        .trim()
        .toLowerCase()
        .replace(/[\s/]+/g, '_');
      const value = match[2].trim();
      if (!value || value.startsWith('REDACTED')) continue;
      data[key] = value;
      if (key === 'domain_status' || key === 'status') statuses.push(value);
    }

    log.success(`Got WHOIS data via native whois command for ${domain}`);
    return {
      domainName: data['domain_name'] || null,
      registrar: {
        name: data['registrar'] || undefined,
        id: data['registrar_iana_id'] || undefined,
        url: data['registrar_url'] || data['registrar_whois_server'] || undefined,
        registryDomainId: data['registry_domain_id'] || undefined,
      },
      dates: {
        creation_date: parseDate(
          data['creation_date'] || data['created_date'] || data['registration_time'],
        ),
        updated_date: parseDate(data['updated_date'] || data['last_updated']),
        expiry_date: parseDate(
          data['registry_expiry_date'] ||
            data['registrar_registration_expiration_date'] ||
            data['expiry_date'] ||
            data['expiration_time'] ||
            data['expire'] ||
            data['paid_until'],
        ),
      },
      whois: {
        name: data['registrant_name'] || undefined,
        organization: data['registrant_organization'] || undefined,
        street: data['registrant_street'] || undefined,
        city: data['registrant_city'] || undefined,
        country: data['registrant_country'] || undefined,
        state: data['registrant_state_province'] || data['registrant_state'] || undefined,
        postal_code: data['registrant_postal_code'] || undefined,
      },
      abuse: {
        email: data['registrar_abuse_contact_email'] || undefined,
        phone: data['registrar_abuse_contact_phone'] || undefined,
      },
      status: parseStatusArray(statuses.join(' ')),
      dnssec: data['dnssec'] || null,
    };
  } catch (err) {
    log.warn(`Native whois failed for ${domain}: ${(err as Error).message}`);
    return null;
  }
};
