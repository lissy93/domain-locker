import { repos } from '../../db/repos';
import { notifyUser } from './notify';

/** Records a change against the domain's real owner, not a hardcoded user */
export async function recordDomainUpdate(
  domainId: string,
  changeDescription: string,
  changeType: string,
  oldValue: string,
  newValue: string,
): Promise<void> {
  const db = repos();
  const recorded = await db.history.record(domainId, {
    change: changeDescription,
    change_type: changeType,
    old_value: oldValue,
    new_value: newValue,
  });
  if (!recorded) return;

  await notifyUser(
    domainId,
    changeType,
    `${changeDescription}: ${oldValue} → ${newValue}`,
  );
}
