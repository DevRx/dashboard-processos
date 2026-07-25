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
  Scale,
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
    <aside className="flex h-screen w-64 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground">
      <div className="mb-8 flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-600 to-red-600 shadow-lg shadow-pink-900/30">
          <Scale size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg leading-tight font-bold text-sidebar-foreground">
            Zeca Aposenta
          </h1>
          <p className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-red-400 bg-clip-text text-[11px] leading-tight font-extrabold tracking-widest text-transparent uppercase">
            O Terror do INSS
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-md shadow-pink-950/40"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
