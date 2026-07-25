import * as React from "react"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={["h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-base shadow-sm outline-none transition dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100", className].filter(Boolean).join(" ")}
      {...props}
    />
  )
}

export { Input }
