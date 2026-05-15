export interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  domainId: string;
  domain_name: string;
  change_type: string;
  message: string;
  sent: boolean;
  read: boolean;
  created_at: string;
}

export interface NotificationChannel {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface NotificationChannels {
  email?: NotificationChannel;
  pushNotification?: NotificationChannel;
  webHook?: NotificationChannel;
  signal?: NotificationChannel;
  telegram?: NotificationChannel;
  slack?: NotificationChannel;
  matrix?: NotificationChannel;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

export interface Subdomain {
  id: string;
  domainId: string;
  name: string;
  sd_info?: string; // JSONB stored/passed as JSON string
}

export interface Valuation {
  auto_renew: boolean;
  current_value: number;
  purchase_price: number;
  renewal_cost: number;
}

export interface IpAddresses {
  ipv4: string[];
  ipv6: string[];
}

export interface Dates {
  expiry_date: string;
  updated_date: string;
  creation_date: string;
}

export interface Registrar {
  name: string;
  id: string;
  url: string;
  registryDomainId: string;
}

export interface Contact {
  name: string;
  organization: string;
  street: string;
  city: string;
  country: string;
  state: string;
  postal_code: string;
}

export interface Abuse {
  email: string;
  phone: string;
}

export interface Dns {
  dnssec: string;
  nameServers: string[];
  mxRecords: string[];
  txtRecords: string[];
}

export interface Ssl {
  issuer: string | null;
  issuer_country: string;
  valid_from: string;
  valid_to: string;
  subject: string;
  fingerprint: string;
  key_size: number;
  signature_algorithm: string;
}

export interface Host {
  query: string;
  country: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  asNumber: string;
  domain_count?: number;
  ip?: string;
}

export interface Link {
  id: string;
  link_url: string;
  link_name: string;
  link_description?: string;
}
