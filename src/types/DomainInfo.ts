import {
  IpAddresses,
  Dates,
  Registrar,
  Contact,
  Abuse,
  Dns,
  Ssl,
  Host,
  Subdomain,
  Link,
} from './common';

export interface DomainInfo {
  domainName: string;
  status: string[];
  ip_addresses: IpAddresses;
  dates: Dates;
  registrar: Registrar;
  whois: Contact;
  abuse: Abuse;
  dns: Dns;
  ssl: Ssl;
  host: Host | null;
  subdomains?: Subdomain[];
  links?: Link[];
}

export interface WhoisData extends Partial<Contact> {
  domainName?: string;
  registrarRegistrationExpirationDate?: string;
  updatedDate?: string;
  creationDate?: string;
  registrarName?: string;
  registrar?: string;
  registrarIanaId?: string;
  registrarUrl?: string;
  registryDomainId?: string;
  abuseContactEmail?: string;
  registrarAbuseContactEmail?: string;
  abuseContactPhone?: string;
  registrarAbuseContactPhone?: string;
  domainStatus?: string;
  dnssec?: string;
  nameServers?: string;
}

export type HostData = Host;
