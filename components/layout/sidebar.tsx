"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarDays,
  ChevronRight,
  Gavel,
  Landmark,
  ListChecks,
  MapPin,
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
  /** Esferas de um processo — hoje só o administrativo. */
  filhos?: MenuItem[]
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
      { name: "Tarefas", icon: ListChecks, href: "/tarefas" },
      {
        name: "Processos",
        icon: FileText,
        href: "/processos",
        filhos: [
          { name: "Administrativo", icon: Landmark, href: "/inss" },
          { name: "Judicial", icon: Gavel, href: "/judicial" },
        ],
      },
      { name: "Agenda", icon: CalendarDays, href: "/agenda" },
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

/**
 * Um item do menu e, quando existirem, as esferas abaixo dele.
 *
 * O filho é recuado e ganha um traço à esquerda em vez de ícone
 * próprio: ele não é um destino paralelo, é um recorte do pai. Em
 * trilho (tablet) os filhos somem — sobra largura para um ícone só, e
 * o pai leva à mesma área.
 *
 * As esferas ficam recolhidas: o menu do dia a dia é curto, e quem
 * precisa de uma delas abre pela seta. O nome do pai continua sendo
 * link — clicar em "Processos" leva a Processos, não abre a gaveta.
 */
function ItemNavegacao({
  item,
  trilho,
  pathname,
  onNavegar,
  filho = false,
}: {
  item: MenuItem
  trilho: boolean
  pathname: string
  onNavegar?: () => void
  filho?: boolean
}) {
  const Icon = item.icon

  // Subpáginas contam como o mesmo item: em /inss/pensao o menu
  // precisa continuar dizendo "você está no Administrativo". "/" é
  // exceção — prefixo de tudo.
  const ativo =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  // O pai não acende junto com o filho: /inss não é /processos. O que
  // ele ganha é um tom mais claro que o de repouso, para a seção
  // inteira não parecer desligada.
  const filhoAtivo = Boolean(
    item.filhos?.some(
      (f) => pathname === f.href || pathname.startsWith(`${f.href}/`)
    )
  )

  // A gaveta já nasce aberta quando você está na seção — dentro de uma
  // esfera ou na própria página do pai. Um menu que esconde a página em
  // que você está não diz onde você está; e em /processos as duas
  // esferas são justamente o que se foi buscar ali.
  const [aberto, setAberto] = useState(filhoAtivo || ativo)

  const temFilhos = Boolean(item.filhos?.length)

  const link = (
    <Link
      href={item.href}
      onClick={() => {
        // Clicar em "Processos" abre as esferas, além de levar à
        // página. Antes só a seta abria, e mirar uma seta de 15px para
        // chegar em "Administrativo" é trabalho que o menu não devia
        // dar. A seta continua existindo — é ela que fecha.
        if (temFilhos) setAberto(true)
        onNavegar?.()
      }}
      aria-current={ativo ? "page" : undefined}
      title={trilho ? item.name : undefined}
      className={cn(
        "group relative flex h-9 flex-1 items-center gap-2.5 rounded-lg text-[13px] tracking-[-0.005em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70 focus-visible:ring-offset-0",
        trilho ? "justify-center px-0 lg:justify-start lg:px-3" : "px-3",
        filho && !trilho && "ml-3 h-8 pl-2.5",
        filho && trilho && "ml-0 h-8 lg:ml-3 lg:pl-2.5",
        ativo
          ? "bg-sidebar-accent font-medium text-sidebar-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.06] ring-inset"
          : filhoAtivo
            ? "font-normal text-sidebar-foreground/75 hover:bg-sidebar-accent/55"
            : "font-normal text-sidebar-foreground/55 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground/90"
      )}
    >
      {filho && (
        <span
          aria-hidden
          className={cn(
            "h-4 w-px shrink-0 bg-sidebar-border",
            trilho && "hidden lg:block"
          )}
        />
      )}

      <Icon
        size={filho ? 15 : 17}
        strokeWidth={1.75}
        className={cn(
          "shrink-0 transition-colors duration-150",
          ativo
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/75"
        )}
      />
      <span
        className={cn(
          "truncate",
          trilho && "hidden lg:inline",
          filho && "text-[12.5px]"
        )}
      >
        {item.name}
      </span>
    </Link>
  )

  if (!temFilhos) return link

  const idGaveta = `submenu-${item.href.replace(/\W/g, "") || "raiz"}`

  return (
    <>
      {/* A seta é um botão à parte, e não dentro do link: um dentro do
          outro é HTML inválido, e são duas ações diferentes. */}
      <div className="flex items-center gap-0.5">
        {link}

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls={idGaveta}
          aria-label={`${aberto ? "Ocultar" : "Mostrar"} esferas de ${item.name}`}
          title={`${aberto ? "Ocultar" : "Mostrar"} esferas de ${item.name}`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
            // Em trilho não há espaço nem gaveta: o pai leva à área.
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
              filho
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
