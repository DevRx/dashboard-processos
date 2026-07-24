"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Wallet,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"

const menuItems = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    name: "Clientes",
    icon: Users,
    href: "/clientes",
  },
  {
    name: "Processos",
    icon: FileText,
    href: "/processos",
  },
  {
    name: "Agenda",
    icon: CalendarDays,
    href: "/agenda",
  },
  {
    name: "Financeiro",
    icon: Wallet,
    href: "/financeiro",
  },
  {
    name: "Configurações",
    icon: Settings,
    href: "/configuracoes",
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white px-4 py-6">
      <div className="mb-8">
        <h1 className="text-xl font-bold">
          Advocacia
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestão de Processos
        </p>
      </div>

      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-zinc-100"
              )}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4">
        <LogoutButton />
      </div>
    </aside>
  )
}
