import * as React from "react"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition"
  const variants: Record<string, string> = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-[#be123c] dark:hover:bg-[#f472b6]",
    outline: "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
    secondary: "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
    ghost: "border-transparent bg-transparent text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
    destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
    link: "border-transparent bg-transparent p-0 text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
  }
  const sizes: Record<string, string> = {
    default: "h-9 px-3",
    sm: "h-8 px-2.5 text-xs",
    lg: "h-10 px-4",
    icon: "h-9 w-9 p-0",
  }

  return <button className={[base, variants[variant], sizes[size], className].filter(Boolean).join(" ")} {...props} />
}

export { Button }
