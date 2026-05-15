import { FeatureService } from '~/app/services/features.service';
import { GlobalMessageService } from '~/app/services/messaging.service';
import { defer, from, Observable, switchMap, throwError } from 'rxjs';

const defaultWriteMethods = new Set([
  // Save domain and assets
  'saveDomain',
  'saveDnsRecords',
  'saveHost',
  'saveIpAddresses',
  'saveRegistrar',
  'saveSslInfo',
  'saveStatuses',
  'saveWhoisInfo',
  // Tags
  'addTag',
  'saveTags',
  'updateTags',
  'createTag',
  'updateTag',
  'deleteTag',
  'saveDomainsForTag',
  // Subdomains
  'saveSubdomains',
  'saveSubdomainsForDomainName',
  'deleteSubdomainsByDomain',
  'updateSubdomains',
  'deleteSubdomain',
  'saveSubdomainForDomain',
  // Link Editing
  'updateLinks',
  'addLinkToDomains',
  'updateLinkInDomains',
  'deleteLinks',
  // Notification Editing
  'saveNotifications',
  // 'updateNotificationChannels',
  'updateBulkNotificationPreferences',
  'markAllNotificationsRead',
  'addNotification',
  'updateNotification',
  'deleteNotification',
  'updateNotificationTypes',
  // Valuation
  'updateDomainCostings',
]);

const environmentType = import.meta.env['DL_ENV_TYPE'];
const disableWriteEnvVar = import.meta.env['DL_DISABLE_WRITE_METHODS'];
const writeMethods =
  environmentType === 'demo' || disableWriteEnvVar
    ? defaultWriteMethods
    : new Set<string>();

export function createDbProxy<T extends object>(
  realService: T,
  featureService: FeatureService,
  globalMsg: GlobalMessageService,
  writeMethodNames: Set<string> = writeMethods,
): T {
  return new Proxy(realService, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver);
      // If it's not a function, just return it (like a property).
      if (typeof original !== 'function') {
        return original;
      }

      // If not in the "write" set, just return as-is
      if (!writeMethodNames.has(property as string)) {
        return original;
      }

      // If write permissions are enabled, just return the original method.
      // if (await featureService.isFeatureEnabledPromise('writePermissions')) {
      //   return original;
      // }

      // It's a "write" method => wrap it so we do the check before the actual DB call.
      return function (...args: unknown[]): Observable<unknown> {
        return defer(() =>
          from(featureService.isFeatureEnabledPromise('writePermissions')).pipe(
            switchMap((canWrite) => {
              // Write access disabled. Show warning, and exit with error.
              if (!canWrite) {
                globalMsg.showWarn(
                  'Write Permissions Disabled',
                  "It's not possible to perform write operations on the demo instance.",
                );
                return throwError(() => new Error('Write permissions disabled'));
              }
              // Write access enabled. Call the original method, and return in expected format.
              const result = original.apply(target, args);
              if (result && typeof result.subscribe === 'function') {
                return result; // already an Observable
              } else if (result && typeof result.then === 'function') {
                return from(result); // it's a Promise => convert
              } else {
                return from([result]); // sync => wrap
              }
            }),
          ),
        );
      };
    },
  }) as T;
}
