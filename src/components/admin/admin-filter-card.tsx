"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const EMPTY_SELECT_VALUE = "__empty__"

interface FilterOption {
  value: string
  label: string
}

interface FilterGroup {
  label: string
  items: FilterOption[]
}

interface AdminFilterCardProps {
  title: string
  description: string
  badge?: ReactNode
  activeBadges?: string[]
  emptyText?: string
  children: ReactNode
  defaultOpen?: boolean
}

export function AdminFilterCard({
  title,
  description,
  badge,
  activeBadges = [],
  emptyText = "当前使用默认筛选条件。",
  children,
  defaultOpen = false,
}: AdminFilterCardProps) {
  const [open, setOpen] = useState(() => defaultOpen || activeBadges.length > 0)
  const showFooter = open || activeBadges.length > 0

  useEffect(() => {
    if (activeBadges.length > 0) {
      const timer = window.setTimeout(() => {
        setOpen(true)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [activeBadges.length])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              {badge}
              <CollapsibleTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 text-xs"
                  />
                }
              >
                {open ? "收起筛选" : "展开筛选"}
                {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
            </div>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="py-3">{children}</CardContent>
        </CollapsibleContent>
        {showFooter ? (
          <CardFooter className="flex flex-wrap items-center gap-1.5 py-3">
            {activeBadges.length > 0 ? (
              activeBadges.map((item) => (
                <Badge key={item} variant="outline" className="rounded-full bg-background/80 px-2 py-0.5 text-[10px]">
                  {item}
                </Badge>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">{emptyText}</span>
            )}
          </CardFooter>
        ) : null}
      </Card>
    </Collapsible>
  )
}

export function AdminFilterSearchField({
  label,
  name,
  value,
  placeholder,
  onChange,
  className,
}: {
  label: string
  name: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 rounded-full bg-background pl-8 text-xs"
        />
      </div>
    </label>
  )
}

export function AdminFilterSelectField({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  className,
}: {
  label: string
  value: string
  options: FilterOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const normalizedValue = value === "" ? EMPTY_SELECT_VALUE : value

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <Select
        value={normalizedValue}
        onValueChange={(nextValue) =>
          onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)
        }
        disabled={disabled}
      >
        <SelectTrigger className="h-9 rounded-full bg-background px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value || EMPTY_SELECT_VALUE}
              value={option.value || EMPTY_SELECT_VALUE}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function AdminFilterGroupedSelectField({
  label,
  value,
  groups,
  onValueChange,
  allLabel = "全部",
  disabled = false,
  className,
}: {
  label: string
  value: string
  groups: FilterGroup[]
  onValueChange: (value: string) => void
  allLabel?: string
  disabled?: boolean
  className?: string
}) {
  const normalizedValue = value === "" ? EMPTY_SELECT_VALUE : value

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <Select
        value={normalizedValue}
        onValueChange={(nextValue) =>
          onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)
        }
        disabled={disabled}
      >
        <SelectTrigger className="h-9 rounded-full bg-background px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>{allLabel}</SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function AdminFilterActions({
  submitLabel,
  resetHref,
  className,
  submitIcon,
}: {
  submitLabel: string
  resetHref: string
  className?: string
  submitIcon?: ReactNode
}) {
  return (
    <div className={cn("flex items-end gap-2 sm:justify-end", className)}>
      <Button type="submit" className="h-9 rounded-full px-3 text-xs">
        {submitIcon}
        {submitLabel}
      </Button>
      <Link
        href={resetHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "default" }),
          "h-9 rounded-full px-3 text-xs"
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        重置
      </Link>
    </div>
  )
}
