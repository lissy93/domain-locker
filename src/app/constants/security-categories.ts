// This file lists the categories that are used to classify the security status of domains

// EPP (Extensible Provisioning Protocol) status codes show sec and opp statuses of domains
// Client codes are set by registrars, server codes are set by registries and take precedence
// The standardized EPP codes are defined in STD-69 and the additional RGP codes in RFC-3915

type Severity = 'good' | 'bad' | 'info';
type SetBy = 'client' | 'server';

export interface SecurityCategory {
  eppCode: string;
  label: string;
  severity: Severity;
  setBy: SetBy;
  description: string;
  actionToTake?: string;
}

export const getAllBySeverity = (severity: Severity): SecurityCategory[] => {
  return securityCategories.filter((cat) => cat.severity === severity);
};

export const getEppCodesBySeverity = (severity: Severity): string[] => {
  return getAllBySeverity(severity).map((cat) => cat.eppCode);
};

export const getAllByClientServer = (setBy: SetBy): SecurityCategory[] => {
  return securityCategories.filter((cat) => cat.setBy === setBy);
};

export const getEppCodesByClientServer = (setBy: SetBy): string[] => {
  return getAllByClientServer(setBy).map((cat) => cat.eppCode);
};

export const getAllWithActions = (): SecurityCategory[] => {
  return securityCategories.filter((cat) => cat.actionToTake !== undefined);
};

export const getEppCodesWithActions = (): string[] => {
  return getAllWithActions().map((cat) => cat.eppCode);
};

export const getByEppCode = (eppCode: string): SecurityCategory | undefined => {
  return securityCategories.find((cat) => cat.eppCode === eppCode);
};

export const makeEppArrayFromLabels = (labels: string[]): SecurityCategory[] => {
  if (!labels) return [];
  return labels
    .map((label) => securityCategories.find((cat) => cat.eppCode === label))
    .filter((cat): cat is SecurityCategory => cat !== undefined)
    .sort((a, b) => {
      const severityOrder = { good: 1, info: 2, bad: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
};

export const securityCategories: SecurityCategory[] = [
  {
    eppCode: 'addPeriod',
    label: 'Add Period',
    severity: 'info',
    setBy: 'server',
    description:
      'Domain has been recently registered, and still within the grace period.',
  },
  {
    eppCode: 'autoRenewPeriod',
    label: 'Auto Renew Period',
    severity: 'info',
    setBy: 'server',
    description: 'Domain is set to auto-renew, ensuring it will not expire.',
  },
  {
    eppCode: 'inactive',
    label: 'Inactive',
    severity: 'info',
    setBy: 'server',
    description: 'Domain is registered but not yet associated with any nameservers.',
    actionToTake: 'Add nameservers to activate the domain.',
  },
  {
    eppCode: 'ok',
    label: 'OK',
    severity: 'good',
    setBy: 'server',
    description:
      'Domain is active and does not have any pending operations or prohibitions.',
  },
  {
    eppCode: 'pendingCreate',
    label: 'Pending Create',
    severity: 'info',
    setBy: 'server',
    description: 'Domain creation is being processed and is not yet fully completed.',
  },
  {
    eppCode: 'pendingDelete',
    label: 'Pending Delete',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain is in the process of being deleted.',
    actionToTake: 'If this was unintentional, recover the domain before it is deleted.',
  },
  {
    eppCode: 'pendingRenew',
    label: 'Pending Renew',
    severity: 'info',
    setBy: 'server',
    description: 'Domain renewal is being processed and is not yet fully completed.',
  },
  {
    eppCode: 'pendingTransfer',
    label: 'Pending Transfer',
    severity: 'info',
    setBy: 'server',
    description: 'A transfer request for the domain is pending.',
    actionToTake: 'Verify if the transfer request is intended.',
  },
  {
    eppCode: 'pendingUpdate',
    label: 'Pending Update',
    severity: 'info',
    setBy: 'server',
    description: 'Domain update is in progress and is not yet fully completed.',
  },
  {
    eppCode: 'renewPeriod',
    label: 'Renew Period',
    severity: 'info',
    setBy: 'server',
    description:
      'Domain has been recently renewed and is within the renewal grace period.',
  },
  {
    eppCode: 'serverHold',
    label: 'Server Hold',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain is suspended by the registry and cannot resolve.',
    actionToTake: 'Contact your registrar to resolve the issue and lift the hold.',
  },
  {
    eppCode: 'serverRenewProhibited',
    label: 'Server Renew Prohibited',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain renewal is prohibited by the registry.',
    actionToTake: 'Check why the renewal is blocked and contact the registrar.',
  },
  {
    eppCode: 'serverTransferProhibited',
    label: 'Server Transfer Prohibited',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain transfer is blocked by the registry.',
    actionToTake: 'Contact your registrar to lift the transfer prohibition.',
  },
  {
    eppCode: 'serverUpdateProhibited',
    label: 'Server Update Prohibited',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain update is blocked by the registry.',
    actionToTake: 'Investigate the reason for the block with the registrar.',
  },
  {
    eppCode: 'clientDeleteProhibited',
    label: 'Client Delete Prohibited',
    severity: 'good',
    setBy: 'client',
    description: 'Registrar has blocked domain deletion, providing extra protection.',
  },
  {
    eppCode: 'clientHold',
    label: 'Client Hold',
    severity: 'bad',
    setBy: 'client',
    description: 'Domain is on hold by the registrar and will not resolve.',
    actionToTake: 'Contact your registrar to lift the hold.',
  },
  {
    eppCode: 'clientRenewProhibited',
    label: 'Client Renew Prohibited',
    severity: 'bad',
    setBy: 'client',
    description: 'Registrar has blocked domain renewal.',
    actionToTake: 'Contact the registrar to allow renewal if needed.',
  },
  {
    eppCode: 'clientTransferProhibited',
    label: 'Client Transfer Prohibited',
    severity: 'good',
    setBy: 'client',
    description: 'Registrar has blocked domain transfer to protect the domain.',
  },
  {
    eppCode: 'clientUpdateProhibited',
    label: 'Client Update Prohibited',
    severity: 'good',
    setBy: 'client',
    description: 'Registrar has blocked domain updates to protect the domain.',
  },
  {
    eppCode: 'redemptionPeriod',
    label: 'Redemption Period',
    severity: 'bad',
    setBy: 'server',
    description: 'Domain has been deleted but can still be restored during this period.',
    actionToTake: 'Recover the domain from redemption before it is permanently deleted.',
  },
  {
    eppCode: 'pendingRestore',
    label: 'Pending Restore',
    severity: 'info',
    setBy: 'server',
    description: 'Domain is in the process of being restored from the redemption period.',
  },
  {
    eppCode: 'serverDeleteProhibited',
    label: 'Server Delete Prohibited',
    severity: 'good',
    setBy: 'server',
    description: 'Registry has blocked domain deletion to protect the domain.',
  },
  {
    eppCode: 'transferPeriod',
    label: 'Transfer Period',
    severity: 'info',
    setBy: 'server',
    description:
      'Domain is within the grace period after being transferred to a new registrar.',
  },
];
