import { isNativeRichTextEditorEnabled } from '@/components/shared/rich-text/native-rich-text-feature';

type KeyboardControllerModule = typeof import('react-native-keyboard-controller');

let keyboardControllerModule: KeyboardControllerModule | null = null;

/**
 * Keeps Keyboard Controller out of Expo Go's module-evaluation path. Metro may
 * bundle the dependency, but its native bindings are evaluated only inside a
 * custom build where the pilot feature is explicitly enabled.
 */
export function getNativeRichTextKeyboardController() {
  if (!isNativeRichTextEditorEnabled()) {
    throw new Error('Native rich-text keyboard runtime is unavailable in Expo Go');
  }

  if (!keyboardControllerModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy native-module boundary
    keyboardControllerModule = require('react-native-keyboard-controller') as KeyboardControllerModule;
  }
  return keyboardControllerModule;
}
