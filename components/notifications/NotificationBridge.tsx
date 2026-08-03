import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import {
  NOTIFICATION_ACTION_COMPLETE,
  NOTIFICATION_ACTION_SNOOZE,
  cancelNotificationsForInstance,
  configureNotificationRuntime,
  getManagedNotificationData,
  reconcileTaskNotifications,
  snoozeTaskNotification,
} from '@/components/notifications/notificationService';
import { getBigEventNotificationData } from '@/components/journal/bigEventNotifications';
import { notificationTapTarget } from '@/components/notifications/notification-navigation';

export default function NotificationBridge() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { settings } = useAppSettings();
  const { ready, tasks, instances, completeInstance } = useTasks();
  const settingsRef = useRef(settings);
  const handledInitialResponseRef = useRef(false);
  const navigationReadyRef = useRef(!!rootNavigationState?.key);
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const handledResponseKeysRef = useRef<Set<string>>(new Set());
  navigationReadyRef.current = !!rootNavigationState?.key;

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const handleResponse = useCallback(async (response: Notifications.NotificationResponse) => {
    const data = getManagedNotificationData(response);
    const bigEventData = data ? null : getBigEventNotificationData(response);
    const destination = notificationTapTarget(data ? 'task' : bigEventData ? 'big-event' : null);
    if (!destination) return;

    // Navigate first so every notification tap feels immediate. Task actions
    // continue below while Home is already visible and TaskProvider will
    // deliver their optimistic state/reward updates there.
    router.replace(destination);
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

  }, [completeInstance, router]);

  const dispatchResponse = useCallback((response: Notifications.NotificationResponse) => {
    if (!navigationReadyRef.current) {
      pendingResponseRef.current = response;
      return;
    }

    const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponseKeysRef.current.has(responseKey)) return;
    handledResponseKeysRef.current.add(responseKey);

    void handleResponse(response)
      .catch(error => {
        console.warn('Notification response failed:', error);
      })
      .finally(() => {
        Notifications.clearLastNotificationResponse();
      });
  }, [handleResponse]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    void configureNotificationRuntime().catch(error => {
      console.warn('Notification runtime setup failed:', error);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      dispatchResponse(response);
    });

    return () => subscription.remove();
  }, [dispatchResponse]);

  useEffect(() => {
    if (Platform.OS === 'web' || !rootNavigationState?.key || handledInitialResponseRef.current) return;
    handledInitialResponseRef.current = true;
    const initialResponse = pendingResponseRef.current ?? Notifications.getLastNotificationResponse();
    pendingResponseRef.current = null;
    if (initialResponse) dispatchResponse(initialResponse);
  }, [dispatchResponse, rootNavigationState?.key]);

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
