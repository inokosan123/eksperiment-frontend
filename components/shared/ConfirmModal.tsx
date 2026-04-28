import React from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { F } from '@/constants/tokens';

type Props = {
  visible: boolean;
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  body?: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmColor?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  visible,
  icon,
  iconBg = '#FEF2F2',
  title,
  body,
  cancelLabel = 'CANCEL',
  confirmLabel,
  confirmColor = '#EF4444',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.card}>
          <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
            {icon}
          </View>
          <Text style={s.title}>{title}</Text>
          {!!body && <Text style={s.body}>{body}</Text>}
          <View style={s.row}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.82} style={s.cancelBtn}>
              <Text style={s.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.82}
              style={[s.confirmBtn, { backgroundColor: confirmColor }]}
            >
              <Text style={s.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 21,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 23,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  confirmText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
