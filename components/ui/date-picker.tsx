"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { fd } from "@/lib/format"

function parseISO(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return undefined
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? undefined : dt
}

function toISO(date: Date | undefined): string | undefined {
  if (!date) return undefined
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

interface DatePickerProps {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  align?: "start" | "center" | "end"
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISO(value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start gap-2 px-3 font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-4 opacity-70" aria-hidden />
        <span className="money">{selected ? fd(value!) : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            const iso = toISO(date as Date | undefined)
            if (iso) {
              onChange(iso)
              setOpen(false)
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
