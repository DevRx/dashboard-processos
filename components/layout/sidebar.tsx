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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand">
          <Scale size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-base leading-tight font-semibold text-sidebar-foreground">
            Zeca Aposenta
          </h1>
          <p className="text-[10.5px] leading-tight font-medium tracking-widest text-sidebar-foreground/45 uppercase">
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
                "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors duration-120",
                isActive
                  ? "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-foreground"
                  : "border-transparent font-normal text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
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
