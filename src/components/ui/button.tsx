import type { ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost"
  size?: "default" | "lg" | "icon"
}

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "outline" && "border border-border bg-card hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" && "bg-transparent hover:bg-accent hover:text-accent-foreground",
        size === "default" && "h-10 px-5 py-2",
        size === "lg" && "h-11 px-6 text-base",
        size === "icon" && "h-10 w-10",
        className,
      )}
      {...props}
    />
  )
}
