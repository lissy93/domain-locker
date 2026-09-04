import { defineEventHandler, getQuery } from 'h3';
import { verifyAuth } from '../utils/auth';
import { isValidDomain, lookupDomainInfo } from '../utils/domain-info';
import Logger from '../utils/logger';

const log = new Logger('domain-info');

export default defineEventHandler(async (event) => {
  const authResult = await verifyAuth(event);
  if (!authResult.success) {
    return { statusCode: 401, body: { error: authResult.error } };
  }

  const { domain } = getQuery(event);
  if (!domain || typeof domain !== 'string') {
    log.warn('Domain name is required for domain info lookup');
    return { error: 'Domain name is required' };
  }

  if (!isValidDomain(domain)) {
    log.warn(`Invalid domain format: ${domain}`);
    return { error: 'Invalid domain format' };
  }

  try {
    return await lookupDomainInfo(domain);
  } catch (err) {
    log.error(`Fatal error during domain lookup: ${(err as Error).message}`);
    return {
      error: 'An unexpected error occurred while processing domain information',
    };
  }
});
