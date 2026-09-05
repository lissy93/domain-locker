import { repos } from '../../db/repos';
import { notify } from '../notify';
import Logger from '../../utils/logger';

const log = new Logger('domain-updater');

/** Sends a detected change through the shared delivery path */
export async function notifyUser(
  domainId: string,
  changeType: string,
  message?: string,
): Promise<void> {
  try {
    const domainName = (await repos().domains.nameById(domainId)) ?? 'unknown domain';
    await notify({
      domainId,
      domainName,
      changeType,
      message: message || `Change detected: ${changeType}`,
      title: 'Domain Locker Update',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Failed to send notification for ${changeType}: ${msg}`);
  }
}
