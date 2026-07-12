import ConfirmModal from '@/components/shared/ConfirmModal';
import { Shield } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';
import { isNativeFocusAvailable } from './focusNativeBridge';

export default function ScreenTimePermissionModal({
  visible,
  onCancel,
  onConfirm,
  embedded = false,
  denied = false,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  embedded?: boolean;
  denied?: boolean;
}) {
  const nativeAvailable = isNativeFocusAvailable();
  return (
    <ConfirmModal
      visible={visible}
      icon={<Shield s={22} c={C.goldDark} w={2.2} />}
      iconBg={C.goldLight}
      title={nativeAvailable ? denied ? 'Restore Protection Access' : 'Enable Protection' : 'Preview Protection'}
      body={nativeAvailable
        ? denied
          ? 'Screen Time access was turned off. Open iPhone Settings, allow Anasta access again, then return here.'
          : 'Anasta needs Screen Time access to apply selected app and website protection on this device.'
        : 'Expo Go cannot load the Family Controls native module. You can test the complete interface now; real shields require the Anasta development build.'}
      cancelLabel="NOT NOW"
      confirmLabel={nativeAvailable ? denied ? 'OPEN SETTINGS' : 'CONTINUE' : 'CONTINUE IN PREVIEW'}
      confirmColor={C.gold}
      onCancel={onCancel}
      onConfirm={onConfirm}
      embedded={embedded}
    />
  );
}
