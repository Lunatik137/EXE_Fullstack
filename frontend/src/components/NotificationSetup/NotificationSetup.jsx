import { useEffect, useContext } from 'react';
import { StoreContext } from '../../context/StoreContext';
import NotificationService from '../../services/notificationService';

const NotificationSetup = () => {
  const { url, token } = useContext(StoreContext);

  useEffect(() => {
    const setupNotifications = async () => {
      if (!token) return;

      const initialized = await NotificationService.init();

      if (initialized && NotificationService.registration) {
        try {
          const subscription = await NotificationService.registration.pushManager.getSubscription();
          
          if (!subscription) {
            // Request permission if not already granted
            const hasPermission = await NotificationService.requestPermission();
            if (hasPermission) {
              await NotificationService.subscribe(token);
            }
          }
        } catch (error) {
          console.error('Notification setup error:', error);
        }
      }
    };

    setupNotifications();
  }, [token]);

  return null;
};

export default NotificationSetup;
