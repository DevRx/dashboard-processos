import * as React from "react"

function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" }) {
  const variants: Record<string, string> = {
    default: "border-transparent bg-primary text-white",
    secondary: "border-transparent bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
    destructive: "border-transparent bg-red-600 text-white",
    outline: "border-slate-300 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
    ghost: "border-transparent bg-transparent text-slate-700 dark:text-zinc-200",
    link: "border-transparent bg-transparent p-0 text-blue-600 underline dark:text-blue-400",
  }

  return <span className={["inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", variants[variant], className].filter(Boolean).join(" ")} {...props} />
}

export { Badge }
