"use client"

import * as React from "react"
import { animate, useMotionValue, useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = "neutral" | "success" | "warning" | "danger" | "info"

interface KpiCardProps {
  label: string
  value: string | number
  format?: (n: number) => string
  delta?: { value: number; format?: (n: number) => string; suffix?: string }
  footnote?: string
  icon?: LucideIcon
  tone?: Tone
  sparkline?: React.ReactNode
  className?: string
}

function toneText(tone: Tone): string {
  switch (tone) {
    case "success":
      return "text-success-700"
    case "warning":
      return "text-warning-700"
    case "danger":
      return "text-danger-700"
    case "info":
      return "text-info-700"
    case "neutral":
    default:
      return "text-foreground"
  }
}

function CountUp({
  to,
  format,
}: {
  to: number
  format: (n: number) => string
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = React.useState(() => format(to))
  const mv = useMotionValue(to)
  React.useEffect(() => {
    if (reduce) return
    const controls = animate(mv, to, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(format(latest)),
    })
    return () => controls.stop()
  }, [to, format, mv, reduce])
  if (reduce) return <span>{format(to)}</span>
  return <span>{display}</span>
}

export function KpiCard({
  label,
  value,
  format,
  delta,
  footnote,
  icon: Icon,
  tone = "neutral",
  sparkline,
  className,
}: KpiCardProps) {
  const isNumeric = typeof value === "number"
  const fmt = format ?? ((n: number) => String(n))
  const deltaFmt = delta?.format ?? ((n: number) => `${n > 0 ? "+" : ""}${n}`)
  const deltaIcon =
    delta && delta.value > 0 ? ArrowUp : delta && delta.value < 0 ? ArrowDown : Minus
  const deltaTone =
    delta && delta.value > 0
      ? "text-success-700 bg-success-50"
      : delta && delta.value < 0
      ? "text-danger-700 bg-danger-50"
      : "text-muted-foreground bg-muted"

  return (
    <div
      data-slot="kpi-card"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border-subtle bg-card p-4 shadow-[var(--shadow-sm)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon
            className="size-4 text-muted-foreground"
            strokeWidth={1.6}
            aria-hidden
          />
        ) : null}
      </div>
      <div className={cn("text-2xl font-semibold tracking-tight money", toneText(tone))}>
        {isNumeric ? <CountUp to={value as number} format={fmt} /> : value}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium money",
                deltaTone,
              )}
            >
              {React.createElement(deltaIcon, { className: "size-3" })}
              {deltaFmt(Math.abs(delta.value))}
              {delta.suffix ? <span className="ml-0.5">{delta.suffix}</span> : null}
            </span>
          ) : null}
          {footnote ? (
            <span className="text-[11px] text-muted-foreground">{footnote}</span>
          ) : null}
        </div>
        {sparkline ? <div className="h-8 w-20 shrink-0">{sparkline}</div> : null}
      </div>
    </div>
  )
}
