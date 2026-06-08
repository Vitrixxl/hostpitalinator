import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent } from "react"

import { searchAddressSuggestions, type AddressSuggestion } from "@/api"
import { ADDRESS_QUERY_MIN_LENGTH } from "@/app/constants"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function AddressAutocomplete({
  "aria-invalid": ariaInvalid,
  id,
  required,
  value,
  onChange,
}: {
  "aria-invalid"?: boolean
  id: string
  required?: boolean
  value: string
  onChange: (value: string) => void
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const inputFocusedRef = useRef(false)
  const selectedValueRef = useRef("")
  const suggestionListId = `${id}-suggestions`
  const activeSuggestion = suggestions[activeIndex]

  useEffect(() => {
    const query = value.trim()

    if (
      query.length < ADDRESS_QUERY_MIN_LENGTH ||
      query === selectedValueRef.current
    ) {
      setSuggestions([])
      setOpen(false)
      setStatus("idle")
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setStatus("loading")

      searchAddressSuggestions(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) {
            return
          }

          setSuggestions(results)
          setActiveIndex(-1)
          setStatus("idle")
          setOpen(inputFocusedRef.current && results.length > 0)
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }

          setSuggestions([])
          setActiveIndex(-1)
          setStatus("error")
          setOpen(inputFocusedRef.current)
        })
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectedValueRef.current = ""
    onChange(event.target.value)
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    selectedValueRef.current = suggestion.label
    onChange(suggestion.label)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    setStatus("idle")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (suggestions.length === 0) {
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex(
        (current) => (current <= 0 ? suggestions.length : current) - 1
      )
      return
    }

    if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault()
      selectSuggestion(activeSuggestion)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          required={required}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={suggestionListId}
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-activedescendant={
            activeSuggestion ? `${suggestionListId}-${activeIndex}` : undefined
          }
          value={value}
          onBlur={() => {
            inputFocusedRef.current = false
            setOpen(false)
            setActiveIndex(-1)
          }}
          onChange={handleChange}
          onFocus={() => {
            inputFocusedRef.current = true
            setOpen(suggestions.length > 0 || status === "error")
          }}
          onKeyDown={handleKeyDown}
        />
      </PopoverAnchor>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popper-anchor-width)] max-w-[calc(100vw-2rem)] p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <ScrollArea
          id={suggestionListId}
          role="listbox"
          className="max-h-64 [&_[data-slot=scroll-area-viewport]]:overscroll-contain"
        >
          {suggestions.map((suggestion, index) => (
            <button
              id={`${suggestionListId}-${index}`}
              key={`${suggestion.id}-${suggestion.label}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                "grid w-full gap-0.5 rounded-sm px-2.5 py-2 text-left text-sm outline-none transition-colors",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                selectSuggestion(suggestion)
              }}
            >
              <span className="truncate font-medium">{suggestion.label}</span>
              {(suggestion.city || suggestion.context) && (
                <span className="truncate text-xs text-muted-foreground">
                  {[suggestion.city, suggestion.context]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </button>
          ))}

          {status === "loading" && suggestions.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-muted-foreground">
              Recherche...
            </div>
          )}

          {status === "error" && suggestions.length === 0 && (
            <div className="px-2.5 py-2 text-sm text-destructive">
              Suggestions indisponibles
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}
