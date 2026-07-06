import ConfirmModal from '@/components/shared/ConfirmModal';
import { Shield } from '@/components/icons/Icons';
import { C } from '@/constants/tokens';

export default function ScreenTimePermissionModal({
  visible,
  onCancel,
  onConfirm,
  embedded = false,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  embedded?: boolean;
}) {
  return (
    <ConfirmModal
      visible={visible}
      icon={<Shield s={22} c={C.goldDark} w={2.2} />}
      iconBg={C.goldLight}
      title="Enable Protection"
      body="Anasta needs Screen Time access to block selected apps and websites on this device."
      cancelLabel="NOT NOW"
      confirmLabel="CONTINUE"
      confirmColor={C.gold}
      onCancel={onCancel}
      onConfirm={onConfirm}
      embedded={embedded}
    />
  );
}
