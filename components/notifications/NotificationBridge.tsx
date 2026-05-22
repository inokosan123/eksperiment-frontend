import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import {
  NOTIFICATION_ACTION_COMPLETE,
  NOTIFICATION_ACTION_SNOOZE,
  cancelNotificationsForInstance,
  configureNotificationRuntime,
  getManagedNotificationData,
  notificationRouteParams,
  reconcileTaskNotifications,
  snoozeTaskNotification,
} from '@/components/notifications/notificationService';

export default function NotificationBridge() {
  const router = useRouter();
  const { settings } = useAppSettings();
  const { ready, tasks, instances, completeInstance } = useTasks();
  const settingsRef = useRef(settings);
  const handledInitialResponseRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const handleResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const data = getManagedNotificationData(response);
    if (!data) return;

    if (response.actionIdentifier === NOTIFICATION_ACTION_COMPLETE) {
      await completeInstance(data.instanceId, data.instanceDate);
      await cancelNotificationsForInstance(data.instanceId);
      return;
    }

    if (response.actionIdentifier === NOTIFICATION_ACTION_SNOOZE) {
      await snoozeTaskNotification(data, settingsRef.current);
      return;
    }

    const pathname = data.route && data.route.startsWith('/') ? data.route : '/';
    router.push({
      pathname: pathname as never,
      params: notificationRouteParams(data),
    } as never);
  }, [completeInstance, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    void configureNotificationRuntime().catch(error => {
      console.warn('Notification runtime setup failed:', error);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      void handleResponse(response).catch(error => {
        console.warn('Notification response failed:', error);
      });
    });

    if (!handledInitialResponseRef.current) {
      handledInitialResponseRef.current = true;
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) {
        void handleResponse(lastResponse).finally(() => {
          Notifications.clearLastNotificationResponse();
        });
      }
    }

    return () => subscription.remove();
  }, [handleResponse]);

  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return undefined;

    const timer = setTimeout(() => {
      void reconcileTaskNotifications(settings).catch(error => {
        console.warn('Notification reconcile failed:', error);
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [instances, ready, settings, tasks]);

  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return undefined;

    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      void reconcileTaskNotifications(settingsRef.current).catch(error => {
        console.warn('Notification foreground reconcile failed:', error);
      });
    });

    return () => subscription.remove();
  }, [ready]);

  return null;
}
