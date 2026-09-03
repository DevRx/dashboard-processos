"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function LogoutButton({
  className,
  labelClassName,
  icone,
}: {
  className?: string
  /** Permite ocultar o rótulo quando a Sidebar está recolhida em trilho. */
  labelClassName?: string
  /** Ícone alternativo — o menu do cabeçalho usa um menor. */
  icone?: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      title="Sair"
      className={cn(
        "flex h-9.5 w-full items-center justify-start gap-2.5 rounded-lg text-[13px] font-medium text-sidebar-foreground/55 transition-colors duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 disabled:opacity-50",
        className
      )}
    >
      {icone ?? <LogOut size={17} strokeWidth={1.75} className="shrink-0" />}
      <span className={cn("truncate", labelClassName)}>
        {loading ? "Saindo..." : "Sair"}
      </span>
    </button>
  )
}
