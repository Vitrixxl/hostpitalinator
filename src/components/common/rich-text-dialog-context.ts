import { createContext, useContext } from "react";

export type RichTextDialogOptions = {
  value: string;
  onChange: (value: string) => void | Promise<void>;
  ariaLabel?: string;
  className?: string;
  dialogDescription?: string;
  disabled?: boolean;
  editorClassName?: string;
  placeholder?: string;
  required?: boolean;
  title: string;
};

export const RichTextDialogContext = createContext<
  ((options: RichTextDialogOptions) => void) | null
>(null);

export function useRichTextDialog() {
  const openDialog = useContext(RichTextDialogContext);

  if (!openDialog) {
    throw new Error("RichTextDialogProvider is missing");
  }

  return openDialog;
}
