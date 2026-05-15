/**
 * This file defines which features of the app should be enabled. Based upon:
 * 1. The environment the app is running in (managed, self-hosted, dev, demo)
 * 2. The user's billing plan (free, hobby, pro, enterprise)
 */

import { BillingPlans } from '~/app/services/billing.service';

export interface FeatureConfig<T> {
  default: T;
  managed?: T | Record<BillingPlans, T>;
  selfHosted?: T;
  dev?: T;
  demo?: T;
}

export interface FeatureDefinitions {
  domainLimit: FeatureConfig<number>;
  notificationChannels: FeatureConfig<boolean>;
  changeNotifications: FeatureConfig<boolean>;
  visualStats: FeatureConfig<boolean>;
  domainMonitor: FeatureConfig<boolean>;
  changeHistory: FeatureConfig<boolean>;
  accountSettings: FeatureConfig<boolean>;
  writePermissions: FeatureConfig<boolean>;
  enableDocs: FeatureConfig<boolean>;
  enableSignUp: FeatureConfig<boolean>;
  enableSocialLogin: FeatureConfig<boolean>;
  enableBilling: FeatureConfig<boolean>;
  allowLocalDbConfig: FeatureConfig<boolean>;
  enablePreviewDomain: FeatureConfig<boolean>;
  enableDeletionTool: FeatureConfig<boolean>;
  enableAdvancedInfo: FeatureConfig<boolean>;
}

export const features: FeatureDefinitions = {
  domainLimit: {
    default: 10000,
    managed: {
      free: 5,
      hobby: 20,
      pro: 100,
      enterprise: 1000,
    },
    selfHosted: 500,
    dev: 100,
    demo: 25,
  },
  notificationChannels: {
    default: false,
    managed: {
      free: false,
      hobby: true,
      pro: true,
      enterprise: true,
    },
  },
  changeNotifications: {
    default: false,
    dev: true,
    managed: {
      free: false,
      hobby: true,
      pro: true,
      enterprise: true,
    },
  },
  visualStats: {
    default: true,
    managed: {
      free: false,
      hobby: true,
      pro: true,
      enterprise: true,
    },
  },
  domainMonitor: {
    default: true,
    selfHosted: true,
    managed: {
      free: false,
      hobby: false,
      pro: true,
      enterprise: true,
    },
  },
  changeHistory: {
    default: true,
    selfHosted: true,
    managed: {
      free: false,
      hobby: true,
      pro: true,
      enterprise: true,
    },
  },
  accountSettings: {
    default: true,
  },
  writePermissions: {
    default: import.meta.env['DL_DISABLE_WRITE_METHODS'] ? false : true,
    demo: false,
  },
  enableDocs: {
    default: true,
    demo: false,
    selfHosted: false,
  },
  enableSignUp: {
    default: true,
    demo: false,
  },
  enableSocialLogin: {
    default: true,
    demo: false,
    dev: false,
    selfHosted: false,
  },
  enableBilling: {
    default: true,
    demo: false,
    selfHosted: false,
    dev: false,
  },
  allowLocalDbConfig: {
    default: false,
    demo: true,
    selfHosted: true,
    dev: true,
  },
  enableAdvancedInfo: {
    default: true,
  },
  enablePreviewDomain: {
    default: true,
  },
  enableDeletionTool: {
    default: import.meta.env['DL_DISABLE_WRITE_METHODS'] ? false : true,
  },
};

export const featureDescriptions: Record<
  keyof FeatureDefinitions,
  { label: string; description: string }
> = {
  domainLimit: {
    label: 'Domain Limit',
    description: 'The maximum number of domains you can add to your account',
  },
  notificationChannels: {
    label: 'Notification Channels',
    description: 'Receive notifications via email, push notifications, or webhooks',
  },
  changeNotifications: {
    label: 'Change Notifications',
    description: 'Receive notifications when the status of your domains change',
  },
  visualStats: {
    label: 'Stats',
    description: 'View detailed statistics for your domains',
  },
  domainMonitor: {
    label: 'Domain Monitor',
    description:
      'Monitor the status of your domains for uptime, responsiveness, and more',
  },
  changeHistory: {
    label: 'Change History',
    description: 'View a history of changes to your domains',
  },
  accountSettings: {
    label: 'Account Settings',
    description: 'Update your account settings',
  },
  writePermissions: {
    label: 'Write Permissions',
    description: 'Allow others to write to your account',
  },
  enableDocs: {
    label: 'Documentation Enabled',
    description: 'Allows local access to documentation and posts',
  },
  enableSignUp: {
    label: 'Disable Sign Up',
    description: 'Prevent new users from signing up',
  },
  enableSocialLogin: {
    label: 'Enable Social Login',
    description:
      'Allow users to sign up or log in with social accounts (like Google, GitHub, etc)',
  },
  enableBilling: {
    label: 'Enable Billing',
    description: 'Allow users to upgrade their accounts, and manage payments',
  },
  allowLocalDbConfig: {
    label: 'Allow Local DB Config',
    description:
      'Allow users to configure which database to use, and connect to it through the app',
  },
  enablePreviewDomain: {
    label: 'Enable Domain Preview',
    description:
      'Enables the /preview/:domain route, to fetch and display domain info without saving it',
  },
  enableDeletionTool: {
    label: 'Enable Deletion Tool',
    description:
      'Allow users to use the tools at /settings/delete-account to selectively and bulk delete data',
  },
  enableAdvancedInfo: {
    label: 'Advanced Info',
    description: 'Debug tools and settings for advanced users',
  },
};
