import { catchError, forkJoin, map, Observable, throwError } from 'rxjs';
import { Notification } from '~/app/../types/Database';
import { NotificationChannels } from '~/types/common';
import { PgApiUtilService } from '~/app/utils/pg-api.util';

interface NotificationRow {
  id: string;
  domain_id: string;
  domain_name: string;
  change_type: string;
  message: string;
  sent: boolean;
  read: boolean;
  created_at: string;
}

export class NotificationQueries {
  constructor(
    private pgApiUtil: PgApiUtilService,
    private handleError: (error: unknown) => void,
    private getCurrentUser: () => Promise<{ id: string } | null>,
  ) {}

  async saveNotifications(
    domainId: string,
    notifications: { type: string; isEnabled: boolean }[],
  ): Promise<void> {
    if (notifications.length === 0) return;

    const dbNotifications = notifications.map((n) => ({
      domain_id: domainId,
      notification_type: n.type,
      is_enabled: n.isEnabled,
    }));

    const query = `
      INSERT INTO notification_preferences (domain_id, notification_type, is_enabled)
      VALUES ${dbNotifications.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')}
    `;
    const params = dbNotifications.flatMap((n) => [
      n.domain_id,
      n.notification_type,
      n.is_enabled,
    ]);

    await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
  }

  async updateNotificationTypes(
    domainId: string,
    notifications: { type: string; isEnabled: boolean }[],
  ): Promise<void> {
    if (!notifications.length) return;

    const upsertQuery = `
      INSERT INTO notification_preferences (domain_id, notification_type, is_enabled)
      VALUES ${notifications.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ')}
      ON CONFLICT (domain_id, notification_type)
      DO UPDATE SET is_enabled = EXCLUDED.is_enabled
    `;

    const queryParams = [
      domainId,
      ...notifications.flatMap((n) => [n.type, n.isEnabled]),
    ];

    try {
      await this.pgApiUtil.postToPgExecutor(upsertQuery, queryParams).toPromise();
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async getNotificationChannels(): Promise<NotificationChannels | null> {
    const userId = await this.getCurrentUser().then((user) => user?.id);
    if (!userId) return null;

    const query = `SELECT notification_channels FROM user_info WHERE user_id = $1`;
    const params = [userId];

    const { data } = (await this.pgApiUtil
      .postToPgExecutor<{ notification_channels: NotificationChannels }>(query, params)
      .toPromise()) as { data: { notification_channels: NotificationChannels }[] };
    return data?.[0]?.notification_channels || null;
  }

  async updateNotificationChannels(preferences: NotificationChannels) {
    const userId = await this.getCurrentUser().then((user) => user?.id);
    if (!userId) return false;

    const query = `
      INSERT INTO user_info (user_id, notification_channels)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET notification_channels = $2
    `;
    const params = [userId, preferences];

    await this.pgApiUtil.postToPgExecutor(query, params).toPromise();
    return true;
  }

  getNotificationPreferences(): Observable<
    { domain_id: string; notification_type: string; is_enabled: boolean }[]
  > {
    const query = `SELECT domain_id, notification_type, is_enabled FROM notification_preferences`;

    return this.pgApiUtil
      .postToPgExecutor<{
        domain_id: string;
        notification_type: string;
        is_enabled: boolean;
      }>(query)
      .pipe(
        map(({ data }) => data),
        catchError((error) => {
          this.handleError(error);
          return throwError(() => error);
        }),
      );
  }

  updateBulkNotificationPreferences(
    preferences: { domain_id: string; notification_type: string; is_enabled: boolean }[],
  ): Observable<void> {
    const updates = preferences.map((pref) => {
      const query = `
        INSERT INTO notification_preferences (domain_id, notification_type, is_enabled)
        VALUES ($1, $2, $3)
        ON CONFLICT (domain_id, notification_type) DO UPDATE SET is_enabled = $3, updated_at = NOW()
      `;
      const params = [pref.domain_id, pref.notification_type, pref.is_enabled];
      return this.pgApiUtil.postToPgExecutor(query, params);
    });

    return forkJoin(updates).pipe(
      map(() => undefined),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }

  getUserNotifications(
    limit = 25,
    offset = 0,
  ): Observable<{
    notifications: (Notification & { domain_name: string })[];
    total: number;
  }> {
    const query = `
      SELECT n.id, n.change_type, n.message, n.sent, n.read, n.created_at, n.domain_id, d.domain_name
      FROM notifications n
      JOIN domains d ON n.domain_id = d.id
      ORDER BY n.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const params = [limit, offset];

    return this.pgApiUtil.postToPgExecutor<NotificationRow>(query, params).pipe(
      map(({ data }) => ({
        notifications: data.map((n) => ({
          id: n.id,
          domainId: n.domain_id,
          change_type: n.change_type,
          message: n.message,
          sent: n.sent,
          read: n.read,
          created_at: n.created_at,
          domain_name: n.domain_name,
        })),
        total: data.length,
      })),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }

  markNotificationReadStatus(
    notificationId: string,
    readStatus: boolean,
  ): Observable<void> {
    const query = `UPDATE notifications SET read = $1 WHERE id = $2`;
    const params = [readStatus, notificationId];

    return this.pgApiUtil.postToPgExecutor(query, params).pipe(
      map(() => undefined),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }

  getUnreadNotificationCount(): Observable<number> {
    const query = `SELECT COUNT(*) AS count FROM notifications WHERE read = false`;

    return this.pgApiUtil.postToPgExecutor<{ count: string | number }>(query).pipe(
      map(({ data }) => parseInt(String(data?.[0]?.count ?? '0'), 10)),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }

  async markAllNotificationsRead(read = true): Promise<Observable<void>> {
    const userId = await this.getCurrentUser().then((user) => user?.id);
    if (!userId) {
      throw new Error('User must be authenticated to mark notifications as read.');
    }

    const query = `
      UPDATE notifications
      SET read = $1
      WHERE user_id = $2
    `;
    const params = [read, userId];

    return this.pgApiUtil.postToPgExecutor(query, params).pipe(
      map(() => undefined),
      catchError((error) => {
        this.handleError(error);
        return throwError(() => error);
      }),
    );
  }
}
