"use client"

import { Bell, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function Header() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setDarkMode(isDark)
  }, [])

  function toggleDarkMode() {
    const html = document.documentElement
    if (html.classList.contains("dark")) {
      html.classList.remove("dark")
      setDarkMode(false)
    } else {
      html.classList.add("dark")
      setDarkMode(true)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 dark:bg-zinc-900">
      <div>
        <h2 className="text-lg font-semibold">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Visão geral do escritório
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          aria-label="Alternar tema"
        >
          {darkMode ? <Moon size={20} /> : <Sun size={20} />}
        </Button>

        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell size={20} />
        </Button>
      </div>
    </header>
  )
}
