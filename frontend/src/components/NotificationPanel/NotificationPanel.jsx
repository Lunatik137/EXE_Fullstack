import { useContext, useState, useRef, useEffect } from 'react';
import { NotificationContext } from '../../context/NotificationContext';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import notificationService from '../../services/notificationService';
import './NotificationPanel.css';

const NotificationPanel = () => {
  const { notifications, removeNotification, clearNotifications } = useContext(NotificationContext);
  const { url, token } = useContext(StoreContext);
  const [showPanel, setShowPanel] = useState(false);
  const [serverNotifications, setServerNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  // Fetch notifications from backend
  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${url}/api/notifications/list`, {
          headers: { token }
        });
        if (response.data.success) {
          setServerNotifications(response.data.notifications);
        }
      } catch (error) {
        console.error('Fetch notifications error:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch on mount and every 10 seconds
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [token, url]);

  const handleDeleteNotification = async (notificationId) => {
    try {
      await axios.delete(`${url}/api/notifications/${notificationId}`, {
        headers: { token }
      });
      setServerNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const handleTestNotification = async () => {
    try {
      console.log('🧪 Sending test notification...');
      const response = await axios.post(`${url}/api/notifications/test`, {}, {
        headers: { token }
      });
      console.log('✅ Test response:', response.data);
    } catch (error) {
      console.error('❌ Test error:', error);
    }
  };

  const handleMigrateUserId = async () => {
    try {
      console.log('🔄 Migrating userId format...');
      const response = await axios.post(`${url}/api/notifications/debug/migrate-userid`, {}, {
        headers: { token }
      });
      console.log('✅ Migrate response:', response.data);
    } catch (error) {
      console.error('❌ Migrate error:', error);
    }
  };

  const unreadCount = serverNotifications.length;
  const displayCount = unreadCount > 9 ? '9+' : unreadCount;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="notification-panel-wrapper" ref={panelRef}>
      <div className="notification-icon-container" onClick={() => setShowPanel(!showPanel)}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="notification-icon" viewBox="0 0 16 16">
          <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{displayCount}</span>
        )}
      </div>

      {showPanel && (
        <div className="notification-panel">
          <div className="notification-header">
            <h3>Thông báo</h3>
            {unreadCount > 0 && (
              <button className="clear-btn" onClick={() => {
                serverNotifications.forEach(n => handleDeleteNotification(n._id));
              }}>Xóa tất cả</button>
            )}
            <button className="clear-btn" onClick={handleMigrateUserId} title="Migrate userId format">
              🔄
            </button>
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="empty-state">Đang tải...</div>
            ) : serverNotifications.length === 0 ? (
              <div className="empty-state">Không có thông báo</div>
            ) : (
              serverNotifications.map(notif => (
                <div key={notif._id} className="notification-item">
                  <div className="notification-content">
                    <p className="notification-title">{notif.title}</p>
                    <p className="notification-body">{notif.body}</p>
                    {notif.createdAt && (
                      <p className="notification-time">
                        {new Date(notif.createdAt).toLocaleTimeString('vi-VN')}
                      </p>
                    )}
                  </div>
                  <button 
                    className="close-btn"
                    onClick={() => handleDeleteNotification(notif._id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
