import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, FocusEvent } from "react"
import { fr } from "date-fns/locale/fr"
import { CalendarDays } from "lucide-react"

import {
  DATE_TEXT_INPUT_TITLE,
  DATE_TIME_TEXT_INPUT_TITLE,
  dateFromIsoValue,
  formatDateTextDraftValue,
  formatDateTextInputValue,
  formatDateTimeTextDraftValue,
  formatDateTimeTextInputValue,
  isoDateFromDate,
  parseDateTextInputValue,
  parseDateTimeTextInputValue,
  timeFromIsoDateTime,
} from "@/app/date-utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function DateTextInput({
  className,
  disabled,
  required,
  value,
  onValueChange,
}: {
  className?: string
  disabled?: boolean
  required?: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    value,
    displayValue: formatDateTextInputValue(value),
  }))
  const displayValue =
    draft.value === value ? draft.displayValue : formatDateTextInputValue(value)
  const selectedDate = dateFromIsoValue(value)

  useEffect(() => {
    inputRef.current?.setCustomValidity("")
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = formatDateTextDraftValue(event.target.value)
    const parsedValue = parseDateTextInputValue(nextValue)

    setDraft({
      value: parsedValue ?? (nextValue.trim() === "" ? "" : value),
      displayValue: nextValue,
    })
    event.target.setCustomValidity(
      nextValue.trim() && parsedValue === null ? DATE_TEXT_INPUT_TITLE : ""
    )

    if (parsedValue !== null || nextValue.trim() === "") {
      onValueChange(parsedValue ?? "")
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseDateTextInputValue(event.target.value)

    if (parsedValue !== null) {
      setDraft({
        value: parsedValue,
        displayValue: formatDateTextInputValue(parsedValue),
      })
      event.target.setCustomValidity("")
    } else if (event.target.value.trim() === "") {
      setDraft({ value: "", displayValue: "" })
      event.target.setCustomValidity("")
    } else {
      event.target.setCustomValidity(DATE_TEXT_INPUT_TITLE)
    }
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      return
    }

    const nextValue = isoDateFromDate(date)
    setDraft({
      value: nextValue,
      displayValue: formatDateTextInputValue(nextValue),
    })
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex w-full min-w-0 gap-2", className)}>
        <Input
          ref={inputRef}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          placeholder="jj-mm-aaaa"
          title={DATE_TEXT_INPUT_TITLE}
          value={displayValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="size-9 shrink-0 px-0"
            disabled={disabled}
            aria-label="Ouvrir le calendrier"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={selectedDate ?? undefined}
          defaultMonth={selectedDate ?? undefined}
          onSelect={selectDate}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DateTimeTextInput({
  className,
  disabled,
  required,
  value,
  onValueChange,
}: {
  className?: string
  disabled?: boolean
  required?: boolean
  value: string
  onValueChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => ({
    value,
    displayValue: formatDateTimeTextInputValue(value),
  }))
  const displayValue =
    draft.value === value
      ? draft.displayValue
      : formatDateTimeTextInputValue(value)
  const selectedDate = dateFromIsoValue(value)

  useEffect(() => {
    inputRef.current?.setCustomValidity("")
  }, [value])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = formatDateTimeTextDraftValue(event.target.value)
    const parsedValue = parseDateTimeTextInputValue(nextValue)

    setDraft({
      value: parsedValue ?? (nextValue.trim() === "" ? "" : value),
      displayValue: nextValue,
    })
    event.target.setCustomValidity(
      nextValue.trim() && parsedValue === null ? DATE_TIME_TEXT_INPUT_TITLE : ""
    )

    if (parsedValue !== null || nextValue.trim() === "") {
      onValueChange(parsedValue ?? "")
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const parsedValue = parseDateTimeTextInputValue(event.target.value)

    if (parsedValue !== null) {
      setDraft({
        value: parsedValue,
        displayValue: formatDateTimeTextInputValue(parsedValue),
      })
      event.target.setCustomValidity("")
    } else if (event.target.value.trim() === "") {
      setDraft({ value: "", displayValue: "" })
      event.target.setCustomValidity("")
    } else {
      event.target.setCustomValidity(DATE_TIME_TEXT_INPUT_TITLE)
    }
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      return
    }

    const nextValue = `${isoDateFromDate(date)}T${timeFromIsoDateTime(value)}`
    setDraft({
      value: nextValue,
      displayValue: formatDateTimeTextInputValue(nextValue),
    })
    onValueChange(nextValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex w-full min-w-0 gap-2", className)}>
        <Input
          ref={inputRef}
          required={required}
          disabled={disabled}
          inputMode="numeric"
          placeholder="jj-mm-aaaa HH:mm"
          title={DATE_TIME_TEXT_INPUT_TITLE}
          value={displayValue}
          onBlur={handleBlur}
          onChange={handleChange}
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="size-9 shrink-0 px-0"
            disabled={disabled}
            aria-label="Ouvrir le calendrier"
          >
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={selectedDate ?? undefined}
          defaultMonth={selectedDate ?? undefined}
          onSelect={selectDate}
        />
      </PopoverContent>
    </Popover>
  )
}
