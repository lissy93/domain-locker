import { callPgExecutor } from './pgExecutor';
import { notifyUser } from './notify';

const DEFAULT_USER_ID = 'a0000000-aaaa-42a0-a0a0-00a000000a69';

export async function recordDomainUpdate(
  pgExec: string,
  domainId: string,
  changeDescription: string,
  changeType: string,
  oldValue: string,
  newValue: string,
): Promise<void> {
  await callPgExecutor(
    pgExec,
    `INSERT INTO domain_updates (domain_id, user_id, change, change_type, old_value, new_value)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    [domainId, DEFAULT_USER_ID, changeDescription, changeType, oldValue, newValue],
  );

  await notifyUser(
    pgExec,
    domainId,
    DEFAULT_USER_ID,
    changeType,
    `${changeDescription}: ${oldValue} → ${newValue}`,
  );
}
