import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  cta?: React.ReactNode
  secondary?: React.ReactNode
  size?: "sm" | "md" | "lg"
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  secondary,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-size={size}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        size === "sm" && "px-4 py-8",
        size === "md" && "px-6 py-12",
        size === "lg" && "px-8 py-20",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "grid place-items-center rounded-full bg-surface-2 text-muted-foreground",
            size === "sm" && "size-10",
            size === "md" && "size-12",
            size === "lg" && "size-16",
          )}
        >
          <Icon
            className={cn(
              size === "sm" && "size-5",
              size === "md" && "size-6",
              size === "lg" && "size-8",
            )}
            aria-hidden
          />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3
          className={cn(
            "font-semibold",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-lg",
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {cta || secondary ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {cta}
          {secondary}
        </div>
      ) : null}
    </div>
  )
}
