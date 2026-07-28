export function shouldClearBlurredRichTextEditor({
  keyboardVisible,
  keyboardClosing,
}: {
  keyboardVisible: boolean;
  keyboardClosing: boolean;
}) {
  return !keyboardVisible || !keyboardClosing;
}
