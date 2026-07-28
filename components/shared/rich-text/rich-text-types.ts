export type RichTextFormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bulletList: boolean;
  orderedList: boolean;
};

export const EMPTY_RICH_TEXT_FORMAT_STATE: RichTextFormatState = {
  bold: false,
  italic: false,
  underline: false,
  bulletList: false,
  orderedList: false,
};

export type NativeRichTextEditorRef = {
  bold: () => void;
  italic: () => void;
  underline: () => void;
  bulletList: () => void;
  orderedList: () => void;
  focus: () => void;
  blur: () => void;
  setHTML: (html: string, notifyDirty?: boolean) => void;
  getHTML: () => Promise<string>;
  flush: () => Promise<string>;
};
