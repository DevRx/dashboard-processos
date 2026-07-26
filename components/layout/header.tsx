"use client"

import { Bell, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

export function Header({
  title = "Dashboard",
  subtitle = "Visão geral do escritório",
}: {
  title?: string
  subtitle?: string
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 text-card-foreground">
      <div className="min-w-0">
        <h2 className="font-heading truncate text-lg leading-tight font-semibold">
          {title}
        </h2>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Alternar tema"
        >
          {isDark ? <Moon size={20} /> : <Sun size={20} />}
        </Button>

        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell size={20} />
        </Button>
      </div>
    </header>
  )
}
