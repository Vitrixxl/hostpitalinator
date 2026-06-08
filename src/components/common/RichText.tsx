import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Quote,
  Redo2,
  Strikethrough,
  Type,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import { FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";

import {
  normalizeRichText,
  richTextHasText,
  sanitizeRichText,
} from "@/app/rich-text";
import {
  RichTextDialogContext,
  useRichTextDialog,
  type RichTextDialogOptions,
} from "@/components/common/rich-text-dialog-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const TEXT_SIZES = [
  { label: "Normal", value: "normal" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "24", value: "24px" },
];

const TEXT_COLORS = [
  { label: "Noir", value: "#111827" },
  { label: "Gris", value: "#4b5563" },
  { label: "Bleu", value: "#1d4ed8" },
  { label: "Vert", value: "#047857" },
  { label: "Rouge", value: "#b91c1c" },
];

const DEFAULT_TOOLBAR_STATE = {
  block: "paragraph",
  size: "normal",
  canUndo: false,
  canRedo: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bulletList: false,
  orderedList: false,
  blockquote: false,
  alignLeft: false,
  alignCenter: false,
  alignRight: false,
  alignJustify: false,
  color: "",
};

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onSave?: () => void;
  placeholder?: string;
  required?: boolean;
};

type RichTextDialogState = {
  draftValue: string;
  initialValue: string;
  open: boolean;
  options: RichTextDialogOptions | null;
};

const CLOSED_DIALOG_STATE: RichTextDialogState = {
  draftValue: "",
  initialValue: "",
  open: false,
  options: null,
};

export function RichTextDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<RichTextDialogState>(CLOSED_DIALOG_STATE);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const openDialog = useCallback((options: RichTextDialogOptions) => {
    const initialValue = normalizeRichText(options.value);

    setCancelConfirmationOpen(false);
    setSaveError("");
    setSaving(false);
    setDialog({
      draftValue: initialValue,
      initialValue,
      open: true,
      options,
    });
  }, []);

  const hasUnsavedChanges =
    Boolean(dialog.options) &&
    normalizeRichText(dialog.draftValue) !== dialog.initialValue;

  const closeDialog = useCallback(() => {
    setCancelConfirmationOpen(false);
    setSaveError("");
    setSaving(false);
    setDialog(CLOSED_DIALOG_STATE);
  }, []);

  const requestCancel = useCallback(() => {
    if (saving) {
      return;
    }

    if (hasUnsavedChanges) {
      setCancelConfirmationOpen(true);
      return;
    }

    closeDialog();
  }, [closeDialog, hasUnsavedChanges, saving]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setDialog((current) => ({ ...current, open: true }));
        return;
      }

      if (saving) {
        return;
      }

      requestCancel();
    },
    [requestCancel, saving],
  );

  const handleChange = useCallback((value: string) => {
    setSaveError("");
    setDialog((current) => {
      if (!current.options) {
        return current;
      }

      return {
        ...current,
        draftValue: value,
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!dialog.options) {
      return;
    }

    const nextValue = normalizeRichText(dialog.draftValue);

    if (dialog.options.required && !richTextHasText(nextValue)) {
      setSaveError("Ce champ est obligatoire");
      return;
    }

    try {
      setSaveError("");
      setSaving(true);

      if (nextValue !== dialog.initialValue) {
        await dialog.options.onChange(nextValue);
      }

      closeDialog();
    } catch (error) {
      setSaving(false);
      setSaveError(richTextDialogErrorMessage(error));
    }
  }, [closeDialog, dialog]);

  const handleConfirmCancel = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const options = dialog.options;

  return (
    <RichTextDialogContext.Provider value={openDialog}>
      {children}
      <Dialog open={dialog.open} onOpenChange={handleOpenChange}>
        <DialogContent className="grid h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-7xl">
          {options && (
            <>
              <DialogHeader>
                <DialogTitle>{options.title}</DialogTitle>
                <DialogDescription>
                  {options.dialogDescription ??
                    "Modifiez le contenu puis enregistrez."}
                </DialogDescription>
              </DialogHeader>
              <RichTextEditor
                ariaLabel={options.ariaLabel ?? options.title}
                className={cn("h-full min-h-0", options.editorClassName)}
                disabled={options.disabled || saving}
                placeholder={options.placeholder}
                required={options.required}
                value={dialog.draftValue}
                onChange={handleChange}
                onSave={handleSave}
              />
              {saveError && (
                <p className="text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={requestCancel}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  disabled={options.disabled || saving}
                  onClick={handleSave}
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={cancelConfirmationOpen}
        onOpenChange={setCancelConfirmationOpen}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler les modifications ?</DialogTitle>
            <DialogDescription>
              Les changements non enregistrés seront perdus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelConfirmationOpen(false)}
            >
              Continuer l'édition
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
            >
              Annuler les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RichTextDialogContext.Provider>
  );
}

function richTextDialogErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Enregistrement impossible";
}

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  onSave,
  placeholder = "Saisir une note...",
  required = false,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const disabledRef = useRef(disabled);
  const editorClassName = cn(
    "rich-text-editor-content min-h-32 w-full px-3 py-2 text-sm leading-relaxed outline-none",
    className,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor(
    {
      content: editorContentFromValue(value),
      editable: !disabled,
      editorProps: {
        attributes: editorAttributes({
          ariaLabel,
          className: editorClassName,
          placeholder,
          required,
        }),
        handleKeyDown: (_view, event) => {
          if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
            return false;
          }

          const save = onSaveRef.current;

          if (!save) {
            return false;
          }

          event.preventDefault();

          if (!disabledRef.current) {
            save();
          }

          return true;
        },
      },
      extensions,
      onUpdate: ({ editor }) => {
        onChangeRef.current(
          editor.isEmpty ? "" : sanitizeRichText(editor.getHTML()),
        );
      },
      shouldRerenderOnTransaction: true,
    },
    [extensions],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextContent = editorContentFromValue(value);
    const currentContent = editor.isEmpty
      ? ""
      : normalizeRichText(editor.getHTML());

    if (currentContent !== normalizeRichText(value)) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div
      className={cn(
        "rich-text-editor grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        disabled && "opacity-60",
      )}
    >
      <RichTextToolbar editor={editor} disabled={disabled} />
      <ScrollArea className="h-full min-h-0">
        <EditorContent className="h-full" editor={editor} />
      </ScrollArea>
    </div>
  );
}

export function RichTextDisplay({
  value,
  fallback,
  className,
}: {
  value?: string | null;
  fallback?: string;
  className?: string;
}) {
  const html = normalizeRichText(value);

  if (!richTextHasText(html)) {
    return fallback ? (
      <p className={cn("text-muted-foreground", className)}>{fallback}</p>
    ) : null;
  }

  return (
    <div
      className={cn("rich-text-content break-words", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function RichTextNoteField({
  value,
  onChange,
  title,
  ariaLabel,
  className,
  dialogDescription,
  disabled = false,
  editorClassName,
  emptyLabel,
  placeholder = "Saisir une note...",
  previewClassName,
  required = false,
}: RichTextEditorProps & {
  title: string;
  dialogDescription?: string;
  editorClassName?: string;
  emptyLabel?: string;
  previewClassName?: string;
}) {
  const openDialog = useRichTextDialog();
  const hasText = richTextHasText(value);

  return (
    <button
      type="button"
      className={cn(
        "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-[color,box-shadow] hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30",
        className,
        "min-h-10",
      )}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      onClick={() =>
        openDialog({
          ariaLabel,
          dialogDescription,
          disabled,
          editorClassName,
          placeholder,
          required,
          title,
          value,
          onChange,
        })
      }
    >
      {hasText ? (
        <RichTextDisplay
          className={cn("min-w-0 max-h-28 overflow-hidden", previewClassName)}
          value={value}
        />
      ) : (
        <span className="min-w-0 self-center leading-5 text-muted-foreground">
          {emptyLabel ?? placeholder}
        </span>
      )}
      <span className="mt-0.5 inline-flex shrink-0 items-center text-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Pencil className="size-3.5" />
        <span className="sr-only">Modifier</span>
      </span>
    </button>
  );
}

function RichTextToolbar({
  editor,
  disabled,
}: {
  editor: Editor | null;
  disabled: boolean;
}) {
  const toolbarState =
    useEditorState({
      editor,
      selector: ({ editor }) => {
        if (!editor) {
          return DEFAULT_TOOLBAR_STATE;
        }

        const size = editor.getAttributes("textStyle").fontSize ?? "normal";

        return {
          block: blockValue(editor),
          size: TEXT_SIZES.some((textSize) => textSize.value === size)
            ? size
            : "normal",
          canUndo: editor.can().undo(),
          canRedo: editor.can().redo(),
          bold: editor.isActive("bold"),
          italic: editor.isActive("italic"),
          underline: editor.isActive("underline"),
          strike: editor.isActive("strike"),
          bulletList: editor.isActive("bulletList"),
          orderedList: editor.isActive("orderedList"),
          blockquote: editor.isActive("blockquote"),
          alignLeft: editor.isActive({ textAlign: "left" }),
          alignCenter: editor.isActive({ textAlign: "center" }),
          alignRight: editor.isActive({ textAlign: "right" }),
          alignJustify: editor.isActive({ textAlign: "justify" }),
          color: editor.getAttributes("textStyle").color ?? "",
        };
      },
    }) ?? DEFAULT_TOOLBAR_STATE;

  return (
    <ScrollArea className="border-b bg-muted/35">
      <div className="flex items-center gap-1 p-1.5">
      <ToolbarButton
        icon={Undo2}
        label="Annuler"
        disabled={disabled || !toolbarState.canUndo}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={Redo2}
        label="Rétablir"
        disabled={disabled || !toolbarState.canRedo}
        onClick={() => editor?.chain().focus().redo().run()}
      />
      <ToolbarSeparator />
      <Select
        value={toolbarState.block}
        disabled={disabled || !editor}
        onValueChange={(nextBlock) => setBlock(editor, nextBlock)}
      >
        <SelectTrigger className="h-8 w-32 shrink-0 bg-background" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph">Paragraphe</SelectItem>
          <SelectItem value="heading-1">Titre 1</SelectItem>
          <SelectItem value="heading-2">Titre 2</SelectItem>
          <SelectItem value="heading-3">Titre 3</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={toolbarState.size}
        disabled={disabled || !editor}
        onValueChange={(fontSize) => setFontSize(editor, fontSize)}
      >
        <SelectTrigger className="h-8 shrink-0 bg-background" size="sm">
          <Type className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_SIZES.map((size) => (
            <SelectItem key={size.value} value={size.value}>
              {size.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToolbarSeparator />
      <ToolbarButton
        active={toolbarState.bold}
        icon={Bold}
        label="Gras"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        active={toolbarState.italic}
        icon={Italic}
        label="Italique"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        active={toolbarState.underline}
        icon={UnderlineIcon}
        label="Souligné"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        active={toolbarState.strike}
        icon={Strikethrough}
        label="Barré"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      />
      <ToolbarSeparator />
      <ToolbarButton
        active={toolbarState.bulletList}
        icon={List}
        label="Liste à puces"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        active={toolbarState.orderedList}
        icon={ListOrdered}
        label="Liste numérotée"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        active={toolbarState.blockquote}
        icon={Quote}
        label="Citation"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarSeparator />
      <ToolbarButton
        active={toolbarState.alignLeft}
        icon={AlignLeft}
        label="Aligner à gauche"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
      />
      <ToolbarButton
        active={toolbarState.alignCenter}
        icon={AlignCenter}
        label="Centrer"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().setTextAlign("center").run()}
      />
      <ToolbarButton
        active={toolbarState.alignRight}
        icon={AlignRight}
        label="Aligner à droite"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().setTextAlign("right").run()}
      />
      <ToolbarButton
        active={toolbarState.alignJustify}
        icon={AlignJustify}
        label="Justifier"
        disabled={disabled || !editor}
        onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
      />
      <ToolbarSeparator />
      <ColorPopover
        activeColor={toolbarState.color}
        disabled={disabled || !editor}
        editor={editor}
      />
      <ToolbarSeparator />
      <ToolbarButton
        icon={Eraser}
        label="Effacer la mise en forme"
        disabled={disabled || !editor}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .unsetAllMarks()
            .unsetColor()
            .unsetFontSize()
            .unsetTextAlign()
            .clearNodes()
            .run()
        }
      />
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function ToolbarButton({
  active = false,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function ColorPopover({
  activeColor,
  disabled,
  editor,
}: {
  activeColor: string;
  disabled: boolean;
  editor: Editor | null;
}) {
  const normalizedActiveColor = activeColor.toLocaleLowerCase();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={activeColor ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Couleur du texte"
          aria-pressed={Boolean(activeColor)}
          className="relative"
          disabled={disabled}
          title="Couleur du texte"
          onMouseDown={(event) => event.preventDefault()}
        >
          <span
            className="size-4 rounded-sm border border-border"
            style={{ backgroundColor: activeColor || "#111827" }}
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {TEXT_COLORS.map((color) => {
            const selected =
              normalizedActiveColor === color.value.toLocaleLowerCase();

            return (
              <button
                key={color.value}
                type="button"
                className={cn(
                  "size-7 rounded-md border border-border shadow-xs outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                )}
                style={{ backgroundColor: color.value }}
                title={color.label}
                aria-label={`Couleur ${color.label}`}
                aria-pressed={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor?.chain().focus().setColor(color.value).run()}
              />
            );
          })}
          <button
            type="button"
            className="grid size-7 place-items-center rounded-md border border-border bg-background text-muted-foreground shadow-xs outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            title="Couleur automatique"
            aria-label="Couleur automatique"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().unsetColor().run()}
          >
            <Eraser className="size-4" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ToolbarSeparator() {
  return <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />;
}

function blockValue(editor: Editor | null) {
  if (editor?.isActive("heading", { level: 1 })) {
    return "heading-1";
  }

  if (editor?.isActive("heading", { level: 2 })) {
    return "heading-2";
  }

  if (editor?.isActive("heading", { level: 3 })) {
    return "heading-3";
  }

  return "paragraph";
}

function setBlock(editor: Editor | null, block: string) {
  if (!editor) {
    return;
  }

  if (block === "heading-1") {
    editor.chain().focus().setHeading({ level: 1 }).run();
  } else if (block === "heading-2") {
    editor.chain().focus().setHeading({ level: 2 }).run();
  } else if (block === "heading-3") {
    editor.chain().focus().setHeading({ level: 3 }).run();
  } else {
    editor.chain().focus().setParagraph().run();
  }
}

function setFontSize(editor: Editor | null, fontSize: string) {
  if (!editor) {
    return;
  }

  if (fontSize === "normal") {
    editor.chain().focus().unsetFontSize().run();
    return;
  }

  editor.chain().focus().setFontSize(fontSize).run();
}

function editorContentFromValue(value: string) {
  return normalizeRichText(value) || "<p></p>";
}

function editorAttributes({
  ariaLabel,
  className,
  placeholder,
  required,
}: {
  ariaLabel?: string;
  className: string;
  placeholder: string;
  required: boolean;
}) {
  const attributes: Record<string, string> = {
    "aria-label": ariaLabel ?? placeholder,
    "aria-multiline": "true",
    class: className,
    role: "textbox",
  };

  if (required) {
    attributes["aria-required"] = "true";
  }

  return attributes;
}
