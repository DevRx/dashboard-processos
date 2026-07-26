"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  Landmark,
  Wallet,
  Settings,
  Scale,
  Menu,
  X,
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
      { name: "INSS", icon: Landmark, href: "/inss" },
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

/**
 * `trilho` recolhe a navegação em tablet (md) e volta a expandir em desktop
 * (lg). O Drawer usa `false`: lá o rótulo é sempre visível.
 */
type Modo = { trilho: boolean; onNavegar?: () => void }

function Marca({ trilho }: { trilho: boolean }) {
  return (
    <div
      className={cn(
        "flex h-16 items-center gap-2.5",
        trilho ? "justify-center px-2 lg:justify-start lg:px-5" : "px-5"
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand">
        <Scale size={17} strokeWidth={2} className="text-white" />
      </div>
      <div className={cn("min-w-0", trilho && "hidden lg:block")}>
        <p className="font-heading truncate text-[13.5px] leading-tight font-semibold tracking-[-0.01em] text-sidebar-foreground">
          Zeca Aposenta
        </p>
        <p className="truncate text-[9.5px] leading-tight font-medium tracking-[0.16em] text-sidebar-foreground/35 uppercase">
          O Terror do INSS
        </p>
      </div>
    </div>
  )
}

function Navegacao({ trilho, onNavegar }: Modo) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "flex flex-1 flex-col gap-6 overflow-y-auto py-2",
        trilho ? "px-2 lg:px-3" : "px-3"
      )}
    >
      {menuGroups.map((grupo, i) => (
        <div key={grupo.label} className="flex flex-col gap-0.5">
          {/* Em trilho o rótulo do grupo vira um traço: a separação
              permanece, o ruído não. */}
          <p
            className={cn(
              "px-3 pb-2 text-[10px] leading-none font-semibold tracking-[0.14em] text-sidebar-foreground/30 uppercase",
              trilho && "hidden lg:block"
            )}
          >
            {grupo.label}
          </p>
          {trilho && i > 0 && (
            <div
              aria-hidden
              className="mx-auto mb-2 h-px w-5 bg-sidebar-border lg:hidden"
            />
          )}

          {grupo.items.map((item) => {
            const Icon = item.icon
            const ativo = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavegar}
                aria-current={ativo ? "page" : undefined}
                title={trilho ? item.name : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-lg text-[13px] tracking-[-0.005em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-0",
                  trilho ? "justify-center px-0 lg:justify-start lg:px-3" : "px-3",
                  ativo
                    ? "bg-sidebar-accent font-medium text-sidebar-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.06] ring-inset"
                    : "font-normal text-sidebar-foreground/55 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground/90"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={1.75}
                  className={cn(
                    "shrink-0 transition-colors duration-150",
                    ativo
                      ? "text-sidebar-foreground"
                      : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/75"
                  )}
                />
                <span className={cn("truncate", trilho && "hidden lg:inline")}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  const [drawerAberto, setDrawerAberto] = useState(false)

  // Esc fecha o Drawer e o corpo não rola por trás dele.
  useEffect(() => {
    if (!drawerAberto) return

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerAberto(false)
    }

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", aoTeclar)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener("keydown", aoTeclar)
    }
  }, [drawerAberto])

  return (
    <>
      {/* Tablet: trilho de 64px. Desktop: 256px. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:flex lg:w-64">
        <Marca trilho />
        <Navegacao trilho />
        <div className="border-t border-sidebar-border p-2 lg:p-3">
          <LogoutButton
            className="justify-center px-0 lg:justify-start lg:px-3"
            labelClassName="hidden lg:inline"
          />
        </div>
      </aside>

      {/* Mobile: gatilho flutuante. Fica fora do fluxo do Header, que
          pertence a outra sprint. */}
      <button
        type="button"
        onClick={() => setDrawerAberto(true)}
        aria-label="Abrir menu de navegação"
        aria-expanded={drawerAberto}
        aria-controls="sidebar-drawer"
        className="fixed bottom-5 left-5 z-40 flex size-11 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg transition-transform duration-150 outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-sidebar-ring md:hidden"
      >
        <Menu size={19} strokeWidth={1.75} />
      </button>

      {drawerAberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            role="presentation"
            onClick={() => setDrawerAberto(false)}
            className="animate-in fade-in absolute inset-0 bg-black/60 backdrop-blur-[2px] duration-200"
          />

          <div
            id="sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className="animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-[264px] max-w-[82vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground duration-200 ease-out"
          >
            <div className="flex items-center justify-between pr-2">
              <Marca trilho={false} />
              <button
                type="button"
                autoFocus
                onClick={() => setDrawerAberto(false)}
                aria-label="Fechar menu de navegação"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <Navegacao trilho={false} onNavegar={() => setDrawerAberto(false)} />

            <div className="border-t border-sidebar-border p-3">
              <LogoutButton className="px-3" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
