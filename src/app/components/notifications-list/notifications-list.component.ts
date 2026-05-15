import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import DatabaseService from '~/app/services/database.service';
import { Notification } from '~/app/../types/Database';
import { PrimeNgModule } from '~/app/prime-ng.module';
import { DomainFaviconComponent } from '~/app/components/misc/favicon.component';
import { CommonModule } from '@angular/common';
import { PaginatorModule } from 'primeng/paginator';
import { ErrorHandlerService } from '~/app/services/error-handler.service';

@Component({
  standalone: true,
  selector: 'app-notifications-list',
  imports: [CommonModule, PrimeNgModule, DomainFaviconComponent, PaginatorModule],
  templateUrl: './notifications-list.component.html',
  styleUrls: ['./notifications-list.component.scss'],
})
export class NotificationsListComponent implements OnInit {
  private databaseService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(ErrorHandlerService);

  notifications: (Notification & { domain_name: string })[] = [];
  totalNotifications = 0;
  @Input() isInModal = false;
  rowsPerPage = 25;
  unreadNotificationsCount = 0;

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications(page = 0) {
    const limit = this.isInModal ? this.rowsPerPage : undefined;
    const offset = page * this.rowsPerPage;

    this.databaseService.instance.notificationQueries
      .getUserNotifications(limit, offset)
      .subscribe(
        ({ notifications, total }) => {
          this.notifications = notifications;
          if (this.isInModal)
            this.notifications = this.sortByUnreadFirst(this.notifications);
          this.totalNotifications = total;
          this.updateUnreadCount();
        },
        (error) => {
          this.errorHandler.handleError({
            message: 'Failed to load notifications',
            error,
            showToast: true,
            location: 'NotificationsListComponent.loadNotifications',
          });
        },
      );
  }

  sortByUnreadFirst(notifications: Notification[]) {
    return notifications.sort((a: Notification, b: Notification) => {
      if (a.read && !b.read) return 1;
      if (!a.read && b.read) return -1;
      return 0;
    });
  }

  updateUnreadCount() {
    this.unreadNotificationsCount = this.notifications.filter((n) => !n.read).length;
    this.cdr.detectChanges();
  }

  markAsRead(notificationId: string) {
    this.databaseService.instance.notificationQueries
      .markNotificationReadStatus(notificationId, true)
      .subscribe(() => {
        const notification = this.notifications.find((n) => n.id === notificationId);
        if (notification) notification.read = true;
        this.updateUnreadCount();
      });
  }

  markAsUnread(notificationId: string) {
    this.databaseService.instance.notificationQueries
      .markNotificationReadStatus(notificationId, false)
      .subscribe(() => {
        const notification = this.notifications.find((n) => n.id === notificationId);
        if (notification) notification.read = false;
        this.updateUnreadCount();
      });
  }

  async markAllAsRead(read = true) {
    (
      await this.databaseService.instance.notificationQueries.markAllNotificationsRead(
        read,
      )
    ).subscribe(() => {
      this.notifications.forEach((notification) => (notification.read = read));
      this.updateUnreadCount();
      this.cdr.detectChanges();
    });
  }
}
