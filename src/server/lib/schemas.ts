import { z } from 'zod';

const optionalText = z.string().trim().max(2000).nullish();

export const saveDomainSchema = z.object({
  domain: z.object({
    domain_name: z.string().trim().min(1).max(253),
    expiry_date: optionalText,
    registration_date: optionalText,
    updated_date: optionalText,
    notes: optionalText,
    registrar: z
      .union([
        z.string().trim().max(255),
        z.object({ name: z.string().trim().max(255).optional(), url: optionalText }),
      ])
      .nullish(),
  }),
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
  notifications: z
    .array(z.object({ type: z.string().trim().min(1), isEnabled: z.boolean() }))
    .optional(),
  statuses: z.array(z.string().trim().min(1)).optional(),
  ipAddresses: z
    .array(z.object({ ipAddress: z.string().trim().min(1), isIpv6: z.boolean() }))
    .optional(),
  ssl: z.record(z.string(), z.unknown()).nullish(),
  whois: z.record(z.string(), z.unknown()).nullish(),
  dns: z
    .object({
      mxRecords: z.array(z.string()).optional(),
      txtRecords: z.array(z.string()).optional(),
      nameServers: z.array(z.string()).optional(),
    })
    .nullish(),
  host: z.record(z.string(), z.unknown()).nullish(),
  subdomains: z
    .array(z.object({ name: z.string().trim().min(1), sd_info: z.unknown().optional() }))
    .optional(),
  links: z.array(linkSchema()).optional(),
});

export function linkSchema() {
  return z.object({
    link_name: z.string().trim().min(1).max(255),
    link_url: z.string().trim().min(1).max(2048),
    link_description: optionalText,
  });
}

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: optionalText,
  icon: optionalText,
  description: optionalText,
});

export const notificationPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      domain_id: z.string().uuid(),
      notification_type: z.string().trim().min(1),
      is_enabled: z.boolean(),
    }),
  ),
});

export const costingsSchema = z.object({
  updates: z.array(
    z.object({
      domain_id: z.string().uuid(),
      purchase_price: z.number().nullish(),
      current_value: z.number().nullish(),
      renewal_cost: z.number().nullish(),
      auto_renew: z.boolean().optional(),
    }),
  ),
});

/** Filters the change-history list and its count share */
export const historyFiltersSchema = z.object({
  domain: z.string().trim().optional(),
  category: z.string().trim().optional(),
  changeType: z.string().trim().optional(),
  search: z.string().trim().max(253).optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const uptimeQuerySchema = z.object({
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year']).default('day'),
});

// The yearly calendar asks for 52 weeks plus a week of padding, so 371
export const dailyUptimeQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(400).default(30),
});
