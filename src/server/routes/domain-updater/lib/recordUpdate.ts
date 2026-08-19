import { callPgExecutor } from './pgExecutor';
import { notifyUser } from './notify';

/** Records a change against the domain's real owner, not a hardcoded user */
export async function recordDomainUpdate(
  pgExec: string,
  domainId: string,
  changeDescription: string,
  changeType: string,
  oldValue: string,
  newValue: string,
): Promise<void> {
  const owners = await callPgExecutor<{ user_id: string }>(
    pgExec,
    `SELECT user_id FROM domains WHERE id = $1::uuid`,
    [domainId],
  );
  const userId = owners[0]?.user_id;
  if (!userId) return;

  await callPgExecutor(
    pgExec,
    `INSERT INTO domain_updates (domain_id, user_id, change, change_type, old_value, new_value)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    [domainId, userId, changeDescription, changeType, oldValue, newValue],
  );

  await notifyUser(
    pgExec,
    domainId,
    userId,
    changeType,
    `${changeDescription}: ${oldValue} → ${newValue}`,
  );
}
