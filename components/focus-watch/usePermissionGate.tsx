import { useCallback, useState, type ReactNode } from 'react';
import ScreenTimePermissionModal from './ScreenTimePermissionModal';
import { grantScreenTimePermission, hasScreenTimePermission } from './dayPlanStore';

// The one permission ritual for the whole Focus tab: call `request(action)`
// anywhere protection is being raised — it either runs the action straight
// away or shows the Screen Time modal first and runs it on consent.
// Render `gate` once near the end of the screen/sheet.
export function usePermissionGate(options?: { embedded?: boolean }) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const request = useCallback((action: () => void) => {
    if (hasScreenTimePermission()) {
      action();
      return;
    }
    setPendingAction(() => action);
  }, []);

  const gate: ReactNode = (
    <ScreenTimePermissionModal
      visible={pendingAction !== null}
      embedded={options?.embedded}
      onCancel={() => setPendingAction(null)}
      onConfirm={() => {
        const action = pendingAction;
        grantScreenTimePermission();
        setPendingAction(null);
        action?.();
      }}
    />
  );

  return { request, gate };
}
