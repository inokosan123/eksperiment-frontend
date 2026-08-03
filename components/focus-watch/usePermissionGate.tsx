import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';
import ScreenTimePermissionModal from './ScreenTimePermissionModal';
import {
  grantScreenTimePermission,
  markScreenTimePermissionDenied,
  useDayPlanSelector,
} from './dayPlanStore';
import { isNativeFocusAvailable, requestNativeAuthorization } from './focusNativeBridge';

// The one permission ritual for the whole Focus tab: call `request(action)`
// anywhere protection is being raised — it either runs the action straight
// away or shows the Screen Time modal first and runs it on consent.
// Render `gate` once near the end of the screen/sheet.
export function usePermissionGate(options?: { embedded?: boolean }) {
  const permission = useDayPlanSelector(state => state.permission);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!pendingAction || permission !== 'approved') return;
    const action = pendingAction;
    setPendingAction(null);
    action();
  }, [pendingAction, permission]);

  const request = useCallback((action: () => void) => {
    const previewIsValid = permission === 'preview' && !isNativeFocusAvailable();
    if (permission === 'approved' || previewIsValid) {
      action();
      return;
    }
    setPendingAction(() => action);
  }, [permission]);

  const gate: ReactNode = (
    <ScreenTimePermissionModal
      visible={pendingAction !== null}
      embedded={options?.embedded}
      denied={permission === 'denied'}
      onCancel={() => setPendingAction(null)}
      onConfirm={() => {
        if (permission === 'denied') {
          void Linking.openSettings();
          return;
        }
        const action = pendingAction;
        void requestNativeAuthorization().then(status => {
          if (status === 'approved') {
            setPendingAction(null);
            grantScreenTimePermission('approved');
            action?.();
          } else if (status === 'unavailable') {
            setPendingAction(null);
            grantScreenTimePermission('preview');
            action?.();
          } else {
            markScreenTimePermissionDenied();
            setPendingAction(null);
          }
        });
      }}
    />
  );

  return { request, gate };
}
