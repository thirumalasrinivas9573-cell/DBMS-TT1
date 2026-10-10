/**
 * Notifications View (Section 9.7, 12)
 */
const NotificationsView = {
  async render(container) {
    const user = Auth.getUser();
    if (!user) {
      window.location.hash = '#login';
      return;
    }

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <div>
            <h1 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.25rem;">System Notifications</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Alerts, loan reminders, misplaced shelf events, and return receipts.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="NotificationsView.markAllRead()">
            <i class="fa-solid fa-check-double"></i> Mark All as Read
          </button>
        </div>

        <div id="notifications-list" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="card skeleton" style="height: 80px;"></div>
          <div class="card skeleton" style="height: 80px;"></div>
        </div>
      </div>
    `;

    this.loadNotifications();
  },

  async loadNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    try {
      const data = await API.get('/notifications');
      const notifs = data.notifications || [];

      if (notifs.length === 0) {
        list.innerHTML = `
          <div class="card empty-state">
            <div class="empty-state-icon">🔔</div>
            <div class="empty-state-title">No notifications yet</div>
            <p class="empty-state-text">You are all caught up on due dates, transfers, and system alerts.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = notifs.map(n => {
        let icon = '<i class="fa-solid fa-bell"></i>';
        let badgeColor = 'var(--amber-500)';

        if (n.type === 'WRONG_RACK') {
          icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
          badgeColor = 'var(--rose-500)';
        } else if (n.type === 'RETURN_CONFIRMATION') {
          icon = '<i class="fa-solid fa-receipt"></i>';
          badgeColor = 'var(--emerald-500)';
        } else if (n.type === 'OVERDUE') {
          icon = '<i class="fa-solid fa-clock"></i>';
          badgeColor = 'var(--rose-500)';
        } else if (n.type === 'TRANSFER_UPDATE') {
          icon = '<i class="fa-solid fa-truck"></i>';
          badgeColor = '#3B82F6';
        }

        const isUnread = n.status === 'UNREAD';

        return `
          <div class="card" style="display: flex; align-items: flex-start; gap: 1rem; ${isUnread ? 'border-left: 4px solid var(--amber-500);' : 'opacity: 0.85;'}">
            <div class="logo-badge" style="background-color: var(--bg-secondary); color: ${badgeColor}; border: none; font-size: 1.25rem; width: 44px; height: 44px;">
              ${icon}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: ${badgeColor};">
                  ${n.type.replace(/_/g, ' ')}
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${n.sent_at}</span>
              </div>
              <p style="font-size: 0.95rem; font-weight: ${isUnread ? '600' : 'normal'}; margin-bottom: 0.5rem;">
                ${n.message}
              </p>
              ${isUnread ? `
                <button class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 2px 8px;" onclick="NotificationsView.markSingleRead(${n.notification_id})">
                  Mark as Read
                </button>
              ` : '<span style="font-size: 0.75rem; color: var(--text-muted);">✓ Read</span>'}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      list.innerHTML = `<div style="color:var(--rose-500); padding: 1.5rem;">Failed to load alerts: ${err.message}</div>`;
    }
  },

  async markSingleRead(id) {
    try {
      await API.patch(`/notifications/${id}/read`);
      this.loadNotifications();
      Auth.updateUnreadCount();
    } catch (_) {}
  },

  async markAllRead() {
    try {
      await API.patch('/notifications/read-all');
      Toast.success('All alerts marked as read.');
      this.loadNotifications();
      Auth.updateUnreadCount();
    } catch (_) {}
  }
};

window.NotificationsView = NotificationsView;
