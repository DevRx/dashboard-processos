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
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"

type MenuItem = {
  name: string
  icon: LucideIcon
  href: string
}

type MenuGroup = {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: "Operação",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/" },
      { name: "Clientes", icon: Users, href: "/clientes" },
      { name: "Processos", icon: FileText, href: "/processos" },
      { name: "Agenda", icon: CalendarDays, href: "/agenda" },
    ],
  },
  {
    label: "Escritório",
    items: [
      { name: "Financeiro", icon: Wallet, href: "/financeiro" },
      { name: "Configurações", icon: Settings, href: "/configuracoes" },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand">
          <Scale size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-heading truncate text-base leading-tight font-semibold text-sidebar-foreground">
            Zeca Aposenta
          </p>
          <p className="truncate text-[10.5px] leading-tight font-medium tracking-widest text-sidebar-foreground/45 uppercase">
            O Terror do INSS
          </p>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5"
      >
        {menuGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold tracking-[0.12em] text-sidebar-foreground/35 uppercase">
              {group.label}
            </p>

            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                      : "font-normal text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full transition-colors duration-120",
                      isActive ? "bg-sidebar-primary" : "bg-transparent"
                    )}
                  />
                  <Icon
                    size={18}
                    className={cn(
                      "shrink-0 transition-colors duration-120",
                      isActive
                        ? "text-sidebar-primary"
                        : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <LogoutButton />
      </div>
    </aside>
  )
}
