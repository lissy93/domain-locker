/** SQLite mirror of db/schema.sql: TEXT ids and timestamps, INTEGER booleans, REAL numerics */

// SQLite has no uuid type or generator, so ids default to a v4 built from randomblob
const UUID = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`;

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const SELF_HOSTED_USER = `'a0000000-aaaa-42a0-a0a0-00a000000a69'`;

export const SQLITE_INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT ${SELF_HOSTED_USER},
  email TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS registrars (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  name TEXT NOT NULL,
  url TEXT,
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  domain_name TEXT NOT NULL,
  expiry_date TEXT,
  notes TEXT,
  registrar_id TEXT REFERENCES registrars (id) ON DELETE SET NULL,
  registration_date TEXT,
  updated_date TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW},
  UNIQUE (user_id, domain_name)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  name TEXT NOT NULL,
  color TEXT,
  description TEXT,
  icon TEXT,
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS domain_tags (
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (domain_id, tag_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  message TEXT,
  sent INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW},
  UNIQUE (domain_id, notification_type)
);

CREATE TABLE IF NOT EXISTS ssl_certificates (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  issuer TEXT,
  issuer_country TEXT,
  subject TEXT,
  valid_from TEXT,
  valid_to TEXT,
  fingerprint TEXT,
  key_size INTEGER,
  signature_algorithm TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS whois_info (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  country TEXT,
  state TEXT,
  name TEXT,
  organization TEXT,
  street TEXT,
  city TEXT,
  postal_code TEXT,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS dns_records (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_value TEXT NOT NULL,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW},
  UNIQUE (domain_id, record_type, record_value)
);

CREATE TABLE IF NOT EXISTS domain_costings (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL UNIQUE REFERENCES domains (id) ON DELETE CASCADE,
  purchase_price REAL DEFAULT 0,
  current_value REAL DEFAULT 0,
  renewal_cost REAL DEFAULT 0,
  auto_renew INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS domain_statuses (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  status_code TEXT NOT NULL,
  created_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS uptime (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  checked_at TEXT DEFAULT ${NOW},
  is_up INTEGER NOT NULL,
  response_code INTEGER,
  response_time_ms REAL,
  dns_lookup_time_ms REAL,
  ssl_handshake_time_ms REAL
);

CREATE TABLE IF NOT EXISTS ip_addresses (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  is_ipv6 INTEGER NOT NULL,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  ip TEXT NOT NULL,
  lat REAL,
  lon REAL,
  isp TEXT,
  org TEXT,
  as_number TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  UNIQUE (user_id, ip)
);

CREATE TABLE IF NOT EXISTS domain_hosts (
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  host_id TEXT NOT NULL REFERENCES hosts (id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW},
  PRIMARY KEY (domain_id, host_id)
);

CREATE TABLE IF NOT EXISTS domain_updates (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  change TEXT NOT NULL,
  change_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  date TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS sub_domains (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sd_info TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS domain_links (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  domain_id TEXT NOT NULL REFERENCES domains (id) ON DELETE CASCADE,
  link_name TEXT NOT NULL,
  link_url TEXT NOT NULL,
  link_description TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS billing (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  user_id TEXT DEFAULT ${SELF_HOSTED_USER},
  current_plan TEXT NOT NULL,
  next_payment_due TEXT,
  billing_method TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS user_info (
  id TEXT PRIMARY KEY DEFAULT ${UUID},
  user_id TEXT DEFAULT ${SELF_HOSTED_USER} UNIQUE,
  notification_channels TEXT,
  current_plan TEXT,
  created_at TEXT DEFAULT ${NOW},
  updated_at TEXT DEFAULT ${NOW}
);

CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains (user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags (user_id);
CREATE INDEX IF NOT EXISTS idx_hosts_user_id ON hosts (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_domain ON notifications (user_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_domain_id ON dns_records (domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_costings_domain_id ON domain_costings (domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_statuses_domain_id ON domain_statuses (domain_id);
CREATE INDEX IF NOT EXISTS idx_uptime_domain_checked ON uptime (domain_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_uptime_checked_at ON uptime (checked_at);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_domain_id ON ip_addresses (domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_hosts_domain_id ON domain_hosts (domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_hosts_host_id ON domain_hosts (host_id);
CREATE INDEX IF NOT EXISTS idx_domain_updates_user_id ON domain_updates (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_domain_id ON notification_preferences (domain_id);
CREATE INDEX IF NOT EXISTS idx_sub_domains_domain_id ON sub_domains (domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_links_domain_id ON domain_links (domain_id);
CREATE INDEX IF NOT EXISTS idx_user_info_user_id ON user_info (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_user_id ON billing (user_id);

INSERT OR IGNORE INTO users (id, email) VALUES (${SELF_HOSTED_USER}, NULL);
`;
