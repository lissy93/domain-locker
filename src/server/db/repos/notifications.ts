import type { Kysely } from 'kysely';
import type { Database, NotificationChannels } from '../schema';
import { currentUserId, toBoolean, toNumber } from './helpers';

export interface NotificationPreference {
  domain_id: string;
  notification_type: string;
  is_enabled: boolean;
}

export function notificationsRepo(db: Kysely<Database>) {
  return {
    async preferences(userId = currentUserId()): Promise<NotificationPreference[]> {
      const rows = await db
        .selectFrom('notification_preferences')
        .innerJoin('domains', 'domains.id', 'notification_preferences.domain_id')
        .where('domains.user_id', '=', userId)
        .select([
          'notification_preferences.domain_id',
          'notification_preferences.notification_type',
          'notification_preferences.is_enabled',
        ])
        .execute();
      return rows.map((row) => ({ ...row, is_enabled: toBoolean(row.is_enabled) }));
    },

    /** One domain's preferences, for the per-change delivery path */
    async preferencesFor(
      domainId: string,
      userId = currentUserId(),
    ): Promise<NotificationPreference[]> {
      const rows = await db
        .selectFrom('notification_preferences')
        .innerJoin('domains', 'domains.id', 'notification_preferences.domain_id')
        .where('domains.user_id', '=', userId)
        .where('notification_preferences.domain_id', '=', domainId)
        .select([
          'notification_preferences.domain_id',
          'notification_preferences.notification_type',
          'notification_preferences.is_enabled',
        ])
        .execute();
      return rows.map((row) => ({ ...row, is_enabled: toBoolean(row.is_enabled) }));
    },

    /** Whether this change was already notified since the given time */
    async sentSince(
      domainId: string,
      changeType: string,
      since: string,
      userId = currentUserId(),
    ): Promise<boolean> {
      const row = await db
        .selectFrom('notifications')
        .where('user_id', '=', userId)
        .where('domain_id', '=', domainId)
        .where('change_type', '=', changeType)
        .where('created_at', '>=', since)
        .select('id')
        .executeTakeFirst();
      return Boolean(row);
    },

    /** Upserts many preferences at once, ignoring domains the user does not own */
    async setPreferences(
      preferences: NotificationPreference[],
      userId = currentUserId(),
    ): Promise<void> {
      if (!preferences.length) return;
      const domainIds = [...new Set(preferences.map((pref) => pref.domain_id))];

      await db.transaction().execute(async (trx) => {
        const owned = new Set(
          (
            await trx
              .selectFrom('domains')
              .where('user_id', '=', userId)
              .where('id', 'in', domainIds)
              .select('id')
              .execute()
          ).map((domain) => domain.id),
        );
        const allowed = preferences.filter((pref) => owned.has(pref.domain_id));
        if (!allowed.length) return;

        await trx
          .insertInto('notification_preferences')
          .values(
            allowed.map((pref) => ({
              domain_id: pref.domain_id,
              notification_type: pref.notification_type,
              is_enabled: pref.is_enabled,
            })),
          )
          .onConflict((conflict) =>
            conflict
              .columns(['domain_id', 'notification_type'])
              .doUpdateSet((eb) => ({ is_enabled: eb.ref('excluded.is_enabled') })),
          )
          .execute();
      });
    },

    async list(limit = 25, offset = 0, userId = currentUserId()) {
      const [rows, total] = await Promise.all([
        db
          .selectFrom('notifications')
          .innerJoin('domains', 'domains.id', 'notifications.domain_id')
          .where('notifications.user_id', '=', userId)
          .select([
            'notifications.id',
            'notifications.domain_id',
            'notifications.change_type',
            'notifications.message',
            'notifications.sent',
            'notifications.read',
            'notifications.created_at',
            'domains.domain_name',
          ])
          .orderBy('notifications.created_at', 'desc')
          .limit(limit)
          .offset(offset)
          .execute(),
        db
          .selectFrom('notifications')
          .where('user_id', '=', userId)
          .select((eb) => eb.fn.countAll().as('total'))
          .executeTakeFirst(),
      ]);

      return {
        notifications: rows.map((row) => ({
          id: row.id,
          domainId: row.domain_id,
          domain_name: row.domain_name,
          change_type: row.change_type,
          message: row.message,
          sent: toBoolean(row.sent),
          read: toBoolean(row.read),
          created_at: row.created_at,
        })),
        total: toNumber(total?.total) ?? 0,
      };
    },

    async unreadCount(userId = currentUserId()): Promise<number> {
      const row = await db
        .selectFrom('notifications')
        .where('user_id', '=', userId)
        .where('read', '=', false)
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst();
      return toNumber(row?.total) ?? 0;
    },

    async markRead(
      notificationId: string,
      read: boolean,
      userId = currentUserId(),
    ): Promise<boolean> {
      const result = await db
        .updateTable('notifications')
        .set({ read })
        .where('id', '=', notificationId)
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0) > 0;
    },

    async markAllRead(read = true, userId = currentUserId()): Promise<number> {
      const result = await db
        .updateTable('notifications')
        .set({ read })
        .where('user_id', '=', userId)
        .executeTakeFirst();
      return Number(result.numUpdatedRows ?? 0);
    },

    async add(
      domainId: string,
      changeType: string,
      message: string,
      userId = currentUserId(),
    ): Promise<void> {
      await db
        .insertInto('notifications')
        .values({
          user_id: userId,
          domain_id: domainId,
          change_type: changeType,
          message,
          sent: true,
          read: false,
        })
        .execute();
    },

    async channels(userId = currentUserId()): Promise<NotificationChannels | null> {
      const row = await db
        .selectFrom('user_info')
        .where('user_id', '=', userId)
        .select('notification_channels')
        .executeTakeFirst();
      return row?.notification_channels ?? null;
    },

    async setChannels(
      channels: NotificationChannels,
      userId = currentUserId(),
    ): Promise<void> {
      const serialised = JSON.stringify(channels);
      await db
        .insertInto('user_info')
        .values({ user_id: userId, notification_channels: serialised })
        .onConflict((conflict) =>
          conflict.column('user_id').doUpdateSet({ notification_channels: serialised }),
        )
        .execute();
    },
  };
}
