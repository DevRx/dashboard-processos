"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Baby,
  LayoutDashboard,
  ShieldCheck,
  Users,
  UsersRound,
  FileText,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Gavel,
  Landmark,
  ListChecks,
  MapPin,
  Radar,
  RefreshCw,
  Sparkles,
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
  /** Recortes do item — as esferas de um processo, as visões das tarefas. */
  filhos?: MenuItem[]
  /**
   * O item não leva a lugar nenhum sozinho: apertar abre as escolhas
   * de baixo, e quem decide para onde ir é a pessoa. É o caso das
   * Tarefas — times ou pré-processual.
   */
  soAbre?: boolean
  /** Ativo só no endereço exato, não nas subpáginas dele. */
  exato?: boolean
  /** Bolinha de cor no lugar do ícone — a cor da esfera ou do time. */
  cor?: string
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
      { name: "Assistente", icon: Sparkles, href: "/assistente" },
      { name: "Aprovações", icon: ShieldCheck, href: "/aprovacoes" },
      { name: "Clientes", icon: Users, href: "/clientes" },
      {
        name: "Tarefas",
        icon: ListChecks,
        href: "/tarefas",
        soAbre: true,
        filhos: [
          { name: "Times", icon: UsersRound, href: "/tarefas", exato: true },
          {
            name: "Pré-processual",
            icon: ClipboardList,
            href: "/tarefas/pre-processual",
            soAbre: true,
            // Mesmas cores dos times: amarelo é o ADM, vermelho o judicial.
            filhos: [
              {
                name: "Administrativo",
                icon: Landmark,
                href: "/tarefas/pre-processual/administrativo",
                cor: "bg-amber-400",
              },
              {
                name: "Judicial",
                icon: Gavel,
                href: "/tarefas/pre-processual/judicial",
                cor: "bg-red-600",
              },
            ],
          },
        ],
      },
      {
        name: "Processos",
        icon: FileText,
        href: "/processos",
        filhos: [
          { name: "Administrativo", icon: Landmark, href: "/inss" },
          { name: "Varredura INSS", icon: Radar, href: "/inss/varredura" },
          { name: "Salário-maternidade", icon: Baby, href: "/inss/maternidade" },
          { name: "Judicial", icon: Gavel, href: "/judicial" },
        ],
      },
      { name: "Agenda", icon: CalendarDays, href: "/agenda" },
      { name: "Automações", icon: RefreshCw, href: "/automacoes" },
      { name: "Mapa", icon: MapPin, href: "/mapa" },
    ],
  },
  {
    label: "Escritório",
    items: [
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
        "flex h-[68px] items-center gap-3",
        trilho ? "justify-center px-2 lg:justify-start lg:px-5" : "px-5"
      )}
    >
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-[0_6px_16px_-6px_rgba(219,39,119,0.7)]">
        <Scale size={18} strokeWidth={2.1} className="text-white" />
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl ring-1 ring-white/25 ring-inset"
        />
      </div>
      <div className={cn("min-w-0", trilho && "hidden lg:block")}>
        <p className="font-heading truncate text-[14px] leading-tight font-bold tracking-[-0.01em] text-sidebar-foreground">
          Zeca Aposenta
        </p>
        <p className="truncate text-[9.5px] leading-tight font-semibold tracking-[0.18em] text-sidebar-foreground/40 uppercase">
          O Terror do INSS
        </p>
      </div>
    </div>
  )
}

/**
 * Um item do menu e, quando existirem, as esferas abaixo dele.
 *
 * O filho é recuado e ganha um traço à esquerda em vez de ícone
 * próprio: ele não é um destino paralelo, é um recorte do pai. Em
 * trilho (tablet) os filhos somem — sobra largura para um ícone só, e
 * o pai leva à mesma área.
 */
function ItemNavegacao({
  item,
  trilho,
  pathname,
  onNavegar,
  nivel = 0,
}: {
  item: MenuItem
  trilho: boolean
  pathname: string
  onNavegar?: () => void
  /** 0 no topo; 1 para a escolha de baixo; 2 para a escolha da escolha. */
  nivel?: number
}) {
  const Icon = item.icon
  const filho = nivel > 0

  const casa = (m: MenuItem) =>
    m.href === "/" || m.exato
      ? pathname === m.href
      : pathname === m.href || pathname.startsWith(`${m.href}/`)

  // Item que só abre as escolhas nunca é "a página atual": quem está
  // aceso é a escolha feita embaixo dele.
  const ativo = !item.soAbre && casa(item)

  const filhoAtivo = Boolean(item.filhos?.some(casa))

  const [aberto, setAberto] = useState(filhoAtivo || ativo)

  const temFilhos = Boolean(item.filhos?.length)

  const idGaveta = `submenu-${item.href.replace(/\W/g, "") || "raiz"}`

  const classe = cn(
    "group relative flex h-9.5 flex-1 items-center gap-2.5 rounded-lg text-[13px] tracking-[-0.005em] transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-0",
    trilho ? "justify-center px-0 lg:justify-start lg:px-3" : "px-3",
    filho && !trilho && "h-8 pl-2.5",
    filho && trilho && "ml-0 h-8 lg:pl-2.5",
    nivel === 1 && (trilho ? "lg:ml-3" : "ml-3"),
    nivel >= 2 && (trilho ? "lg:ml-7" : "ml-7"),
    ativo
      ? "bg-sidebar-accent font-semibold text-sidebar-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)]"
      : filhoAtivo
        ? "font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/70"
        : "font-medium text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground/95"
  )

  const conteudo = (
    <>
      {/* Indicador de página ativa: um traço luminoso na borda. */}
      {ativo && !filho && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_12px_2px_rgba(124,159,240,0.55)]",
            trilho && "hidden lg:block"
          )}
        />
      )}

      {filho && (
        <span
          aria-hidden
          className={cn(
            "h-4 w-px shrink-0 bg-sidebar-foreground/15",
            ativo && "bg-sidebar-primary",
            trilho && "hidden lg:block"
          )}
        />
      )}

      {item.cor ? (
        <span
          aria-hidden
          className={cn("mx-[3px] size-2.5 shrink-0 rounded-full ring-2 ring-white/10", item.cor)}
        />
      ) : (
        <Icon
          size={filho ? 15 : 17}
          strokeWidth={ativo ? 2.1 : 1.75}
          className={cn(
            "shrink-0 transition-colors duration-150",
            ativo
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/85"
          )}
        />
      )}
      <span
        className={cn(
          "truncate",
          trilho && "hidden lg:inline",
          filho && "text-[12.5px]"
        )}
      >
        {item.name}
      </span>
    </>
  )

  const link = item.soAbre ? (
    <button
      type="button"
      onClick={() => setAberto((v) => !v)}
      aria-expanded={aberto}
      aria-controls={idGaveta}
      title={trilho ? item.name : undefined}
      className={cn(classe, "text-left")}
    >
      {conteudo}
    </button>
  ) : (
    <Link
      href={item.href}
      onClick={() => {
        if (temFilhos) setAberto(true)
        onNavegar?.()
      }}
      aria-current={ativo ? "page" : undefined}
      title={trilho ? item.name : undefined}
      className={classe}
    >
      {conteudo}
    </Link>
  )

  if (!temFilhos) return link

  return (
    <>
      <div className="flex items-center gap-0.5">
        {link}

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls={idGaveta}
          aria-label={`${aberto ? "Ocultar" : "Mostrar"} as opções de ${item.name}`}
          title={`${aberto ? "Ocultar" : "Mostrar"} as opções de ${item.name}`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
            trilho && "hidden lg:flex"
          )}
        >
          <ChevronRight
            size={15}
            strokeWidth={2}
            className={cn(
              "transition-transform duration-200",
              aberto && "rotate-90"
            )}
          />
        </button>
      </div>

      {aberto && (
        <div
          id={idGaveta}
          className="animate-in fade-in slide-in-from-top-1 flex flex-col gap-0.5 duration-150"
        >
          {item.filhos?.map((sub) => (
            <ItemNavegacao
              key={sub.name}
              item={sub}
              trilho={trilho}
              pathname={pathname}
              onNavegar={onNavegar}
              nivel={nivel + 1}
            />
          ))}
        </div>
      )}
    </>
  )
}

function Navegacao({ trilho, onNavegar }: Modo) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "flex flex-1 flex-col gap-6 overflow-y-auto py-3",
        trilho ? "px-2 lg:px-3" : "px-3"
      )}
    >
      {menuGroups.map((grupo, i) => (
        <div key={grupo.label} className="flex flex-col gap-1">
          <p
            className={cn(
              "px-3 pb-2 text-[10px] leading-none font-bold tracking-[0.16em] text-sidebar-foreground/30 uppercase",
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

          {grupo.items.map((item) => (
            <ItemNavegacao
              key={item.name}
              item={item}
              trilho={trilho}
              pathname={pathname}
              onNavegar={onNavegar}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

/** Fundo do painel: azul-noite com uma luz suave no topo. */
const FUNDO_SIDEBAR =
  "bg-sidebar bg-[radial-gradient(600px_300px_at_0%_0%,rgba(124,159,240,0.16),transparent_60%),radial-gradient(400px_260px_at_100%_100%,rgba(219,39,119,0.10),transparent_60%)]"

export function Sidebar() {
  const [drawerAberto, setDrawerAberto] = useState(false)

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
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-200 ease-out md:flex lg:w-64",
          FUNDO_SIDEBAR
        )}
      >
        <Marca trilho />
        <Navegacao trilho />
        <div className="border-t border-sidebar-border p-2 lg:p-3">
          <LogoutButton
            className="justify-center px-0 lg:justify-start lg:px-3"
            labelClassName="hidden lg:inline"
          />
        </div>
      </aside>

      {/* Mobile: gatilho flutuante. */}
      <button
        type="button"
        onClick={() => setDrawerAberto(true)}
        aria-label="Abrir menu de navegação"
        aria-expanded={drawerAberto}
        aria-controls="sidebar-drawer"
        className="fixed bottom-5 left-5 z-40 flex size-12 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground shadow-float ring-1 ring-white/10 transition-transform duration-150 outline-none active:scale-95 focus-visible:ring-2 focus-visible:ring-sidebar-ring md:hidden"
      >
        <Menu size={20} strokeWidth={1.9} />
      </button>

      {drawerAberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            role="presentation"
            onClick={() => setDrawerAberto(false)}
            className="animate-in fade-in absolute inset-0 bg-[#0b1220]/60 backdrop-blur-[3px] duration-200"
          />

          <div
            id="sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
            className={cn(
              "animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-[272px] max-w-[84vw] flex-col border-r border-sidebar-border text-sidebar-foreground shadow-float duration-200 ease-out",
              FUNDO_SIDEBAR
            )}
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
