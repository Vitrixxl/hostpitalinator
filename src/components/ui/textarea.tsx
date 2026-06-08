import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  onChange,
  onInput,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<"textarea">) {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const resize = React.useCallback(() => {
    const textarea = ref.current

    if (!textarea) {
      return
    }

    textarea.style.height = "auto"
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  React.useLayoutEffect(() => {
    resize()
  }, [defaultValue, resize, value])

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full resize-none overflow-hidden rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      value={value}
      defaultValue={defaultValue}
      onInput={(event) => {
        resize()
        onInput?.(event)
      }}
      onChange={(event) => {
        resize()
        onChange?.(event)
      }}
      {...props}
    />
  )
}

export { Textarea }
