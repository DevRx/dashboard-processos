"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function LogoutButton({
  className,
  labelClassName,
}: {
  className?: string
  /** Permite ocultar o rótulo quando a Sidebar está recolhida em trilho. */
  labelClassName?: string
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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={loading}
      title="Sair"
      className={cn(
        "h-9 w-full justify-start gap-2.5 rounded-lg text-[13px] font-normal text-sidebar-foreground/55 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        className
      )}
    >
      <LogOut size={17} strokeWidth={1.75} className="shrink-0" />
      <span className={cn("truncate", labelClassName)}>
        {loading ? "Saindo..." : "Sair"}
      </span>
    </Button>
  )
}
