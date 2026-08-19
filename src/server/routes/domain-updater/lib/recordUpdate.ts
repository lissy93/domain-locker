import { runQuery } from '../../../db/raw';
import { notifyUser } from './notify';

/** Records a change against the domain's real owner, not a hardcoded user */
export async function recordDomainUpdate(
  domainId: string,
  changeDescription: string,
  changeType: string,
  oldValue: string,
  newValue: string,
): Promise<void> {
  const owners = await runQuery<{ user_id: string }>(
    `SELECT user_id FROM domains WHERE id = $1`,
    [domainId],
  );
  const userId = owners[0]?.user_id;
  if (!userId) return;

  await runQuery(
    `INSERT INTO domain_updates (domain_id, user_id, change, change_type, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [domainId, userId, changeDescription, changeType, oldValue, newValue],
  );

  await notifyUser(
    domainId,
    userId,
    changeType,
    `${changeDescription}: ${oldValue} → ${newValue}`,
  );
}
