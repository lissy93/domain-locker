export interface NotificationType {
  key: string;
  label: string;
  description: string;
  note?: string;
  default?: boolean;
}

// The following keys are set in the `change` field in the `domain_updates` table
// registrar
// whois_organization
// dns_ns
// dns_txt
// dns_mx
// ip_ipv4
// ip_ipv6
// ssl_issuer
// status
// dates_expiry
// dates_updated

export const notificationTypes: NotificationType[] = [
  {
    key: 'expiry_domain',
    label: 'Expiring Soon',
    description: 'Get notified before a domain is due to expire',
    default: true,
  },
  {
    key: 'ip_',
    label: 'IP Change',
    description: 'Get notified when the IP address the domain points to changes',
    note: 'If you use a firewall service like Cloudflare, this is NOT recommended, as the IP address will change frequently',
  },
  {
    key: 'registrar',
    label: 'Registrar',
    description: 'Get notified when the domain is transferred to a different registrar',
  },
  {
    key: 'whois_',
    label: 'WHOIS Change',
    description: 'Get notified when any WHOIS records change',
  },
  {
    key: 'dns_',
    label: 'DNS Change',
    description: 'Get notified when any DNS records are added, removed or amended',
  },
  {
    key: 'expiry_ssl',
    label: 'SSL Expiry',
    description: 'Get notified when an SSL certificate is due to expire',
    note: 'This is not recommended if you have auto-SSL, as the certificates have a short lifespan and are renewed automatically',
  },
  {
    key: 'ssl_issuer',
    label: 'SSL Change',
    description: 'Get notified when any attributes in an SSL certificate change',
    note: 'This is not recommended if you have auto-SSL, as the certificates have a short lifespan and so will change frequently',
  },
  {
    key: 'host',
    label: 'Host Change',
    description: 'Get notified when the domain is moved to a different host',
  },
  {
    key: 'status',
    label: 'Security Features Change',
    description:
      'Get notified when any security features on your domain are added, removed or amended',
  },
];
