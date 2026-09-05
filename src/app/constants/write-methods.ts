/** Methods that change the domain list. The cache is dropped after one settles */
export const DOMAIN_WRITE_METHODS = new Set([
  // Domains
  'saveDomain',
  'updateDomain',
  'deleteDomain',
  'deleteAllData',
  // Domain assets
  'saveDnsRecords',
  'saveHost',
  'saveIpAddresses',
  'saveRegistrar',
  'saveSslInfo',
  'saveStatuses',
  'saveWhoisInfo',
  // Tags
  'addTag',
  'createTag',
  'updateTag',
  'deleteTag',
  'saveTags',
  'updateTags',
  'saveDomainsForTag',
  // Subdomains
  'saveSubdomains',
  'saveSubdomainsForDomainName',
  'saveSubdomainForDomain',
  'updateSubdomains',
  'deleteSubdomain',
  'deleteSubdomainsByDomain',
  // Links
  'updateLinks',
  'addLinkToDomains',
  'updateLinkInDomains',
  'deleteLinks',
  // Notifications
  'saveNotifications',
  'updateBulkNotificationPreferences',
  'updateNotificationTypes',
  // Valuation
  'updateDomainCostings',
]);
