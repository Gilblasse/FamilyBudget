"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Table({
  className,
  maxHeight = "520px",
  ...props
}: React.ComponentProps<"table"> & { maxHeight?: string }) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-auto"
      style={{ maxHeight }}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ComponentProps<"thead"> & { sticky?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      data-sticky={sticky || undefined}
      className={cn(
        "[&_tr]:border-b",
        sticky &&
          "sticky top-0 z-20 bg-card [&>tr>th]:bg-card [&>tr>th]:shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border-subtle transition-colors hover:bg-surface-2 has-aria-expanded:bg-surface-2 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  sortable,
  direction,
  onSort,
  children,
  ...props
}: React.ComponentProps<"th"> & {
  sortable?: boolean
  direction?: "asc" | "desc" | "none"
  onSort?: () => void
}) {
  if (sortable) {
    const Icon =
      direction === "asc"
        ? ChevronUp
        : direction === "desc"
        ? ChevronDown
        : ChevronsUpDown
    return (
      <th
        data-slot="table-head"
        className={cn(
          "h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={onSort}
          className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
        >
          {children}
          <Icon
            className={cn(
              "size-3",
              direction === "none" ? "opacity-40" : "opacity-80"
            )}
          />
        </button>
      </th>
    )
  }
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function TableEmpty({
  className,
  colSpan,
  children,
}: {
  className?: string
  colSpan: number
  children: React.ReactNode
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("px-4 py-10 text-center", className)}>
        {children}
      </td>
    </tr>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableEmpty,
}
