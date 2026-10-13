"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Baby,
  LayoutDashboard,
  LayoutGrid,
  ShieldCheck,
  Users,
  FileText,
  CalendarDays,
  ChevronRight,
  Ellipsis,
  Gavel,
  Landmark,
  MapPin,
  Radar,
  RefreshCw,
  Sparkles,
  Settings,
  Scale,
  Menu,
  X,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LogoutButton } from "@/components/auth/logout-button"
import { MENU_TIME } from "@/components/tarefas/cores-time"
import {
  ESFERAS_AMARELO,
  ESFERA_AMARELO_LABEL,
  ETAPAS,
  ETAPAS_DO_TIME,
  SLUG_ESFERA,
  TIMES_TAREFA,
  TIME_LABEL,
  enderecoDaEtapa,
  enderecoDoTime,
  etapasDaEsfera,
  type TimeTarefa,
} from "@/lib/domain/tarefa"

/**
 * O menu lateral.
 *
 * Logo abaixo do Dashboard vêm os quatro times — vermelho, azul,
 * amarelo e rosa, nesta ordem —, cada um com as etapas do fluxo
 * desenhado pelo Zeca (lib/domain/tarefa/fluxo.ts). A cor do time
 * acompanha o menu dele inteiro: o quadradinho ao lado do nome, o fundo
 * da linha quando se está dentro do time e o traço que liga as etapas
 * ao time, para que dê para achar o time pela cor antes de ler.
 *
 * Itens com 44px de altura e letra de 15px: o menu é usado o dia todo,
 * no monitor do escritório e no celular.
 */

type MenuItem = {
  name: string
  href: string
  icon?: LucideIcon
  /** Recortes do item — as etapas de um time, as esferas de um processo. */
  filhos?: MenuItem[]
  /** O item só abre as escolhas de baixo; não leva a lugar nenhum. */
  soAbre?: boolean
  /** Ativo só no endereço exato, não nas subpáginas dele. */
  exato?: boolean
  /** Item de time: a cor manda no desenho da linha. */
  time?: TimeTarefa
}

type MenuGroup = {
  label?: string
  items: MenuItem[]
}

/** Um time e as etapas dele; o amarelo tem um nível a mais (ADM e Judicial). */
function itemDoTime(time: TimeTarefa): MenuItem {
  const etapa = (id: (typeof ETAPAS_DO_TIME)[TimeTarefa][number]): MenuItem => ({
    name: ETAPAS[id].nome,
    href: enderecoDaEtapa(id),
    exato: true,
  })

  const filhos: MenuItem[] =
    time === "AMARELO"
      ? ESFERAS_AMARELO.map((esfera) => ({
          name: ESFERA_AMARELO_LABEL[esfera],
          href: `/times/amarelo/${SLUG_ESFERA[esfera]}`,
          icon: esfera === "JUDICIAL" ? Gavel : Landmark,
          filhos: etapasDaEsfera(esfera).map(etapa),
        }))
      : ETAPAS_DO_TIME[time].map(etapa)

  return {
    name: TIME_LABEL[time],
    href: enderecoDoTime(time),
    time,
    exato: true,
    filhos: filhos.length ? filhos : undefined,
  }
}

const menuGroups: MenuGroup[] = [
  {
    items: [{ name: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    label: "Times",
    items: TIMES_TAREFA.map(itemDoTime),
  },
  {
    label: "Escritório",
    items: [
      { name: "Agenda", icon: CalendarDays, href: "/agenda" },
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
      { name: "Clientes", icon: Users, href: "/clientes" },
      { name: "Assistente", icon: Sparkles, href: "/assistente" },
      {
        // O que se usa pouco fica guardado aqui, fechado.
        name: "Mais",
        icon: Ellipsis,
        href: "/mais",
        soAbre: true,
        filhos: [
          { name: "Todas as tarefas", icon: LayoutGrid, href: "/tarefas" },
          { name: "Aprovações", icon: ShieldCheck, href: "/aprovacoes" },
          { name: "Automações", icon: RefreshCw, href: "/automacoes" },
          { name: "Mapa", icon: MapPin, href: "/mapa" },
        ],
      },
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
        "flex h-[76px] shrink-0 items-center gap-3",
        trilho ? "justify-center px-2 lg:justify-start lg:px-6" : "px-6"
      )}
    >
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-[0_6px_16px_-6px_rgba(219,39,119,0.7)]">
        <Scale size={20} strokeWidth={2.1} className="text-white" />
        <span aria-hidden className="absolute inset-0 rounded-xl ring-1 ring-white/25 ring-inset" />
      </div>
      <div className={cn("min-w-0", trilho && "hidden lg:block")}>
        <p className="font-heading truncate text-[16px] leading-tight font-bold tracking-[-0.01em] text-sidebar-foreground">
          Zeca Aposenta
        </p>
        <p className="truncate text-[11px] leading-tight font-medium text-sidebar-foreground/45">
          O Terror do INSS
        </p>
      </div>
    </div>
  )
}

function casa(pathname: string, m: MenuItem) {
  if (m.href === "/") return pathname === "/"
  if (m.exato) return pathname === m.href
  return pathname === m.href || pathname.startsWith(`${m.href}/`)
}

/** O endereço está dentro do item ou de algum recorte dele. */
function dentroDe(pathname: string, m: MenuItem): boolean {
  if (m.soAbre) return Boolean(m.filhos?.some((f) => dentroDe(pathname, f)))
  if (m.href === "/") return pathname === "/"
  return pathname === m.href || pathname.startsWith(`${m.href}/`)
}

/** Botão que abre e fecha as escolhas de baixo. */
function Seta({
  aberto,
  nome,
  controla,
  onClick,
  trilho,
}: {
  aberto: boolean
  nome: string
  controla: string
  onClick: () => void
  trilho: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      aria-controls={controla}
      aria-label={`${aberto ? "Ocultar" : "Mostrar"} as opções de ${nome}`}
      title={`${aberto ? "Ocultar" : "Mostrar"} as opções de ${nome}`}
      className={cn(
        "mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/45 transition-colors duration-150 outline-none hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
        trilho && "hidden lg:flex"
      )}
    >
      <ChevronRight
        size={17}
        strokeWidth={2}
        className={cn("transition-transform duration-200 motion-reduce:transition-none", aberto && "rotate-90")}
      />
    </button>
  )
}

/**
 * Abre sozinho quando a pessoa entra no item por outro caminho (um link
 * do Dashboard, o botão de voltar) — e não fecha quando ela sai, para o
 * menu não ficar pulando.
 */
function useAberto(dentro: boolean, pathname: string) {
  const [aberto, setAberto] = useState(dentro)
  const [visto, setVisto] = useState(pathname)
  if (visto !== pathname) {
    setVisto(pathname)
    if (dentro && !aberto) setAberto(true)
  }
  return [aberto, setAberto] as const
}

// ── Time: linha colorida e as etapas penduradas nela ──────

function ItemTime({ item, trilho, pathname, onNavegar }: { item: MenuItem; trilho: boolean; pathname: string; onNavegar?: () => void }) {
  const time = item.time as TimeTarefa
  const cor = MENU_TIME[time]
  const atual = casa(pathname, item)
  const dentro = dentroDe(pathname, item)
  const [aberto, setAberto] = useAberto(dentro, pathname)
  const temFilhos = Boolean(item.filhos?.length)
  const idGaveta = `submenu-time-${time.toLowerCase()}`

  return (
    <div>
      <div
        className={cn(
          "relative flex items-center rounded-xl transition-colors duration-150",
          dentro ? cor.tinta : "hover:bg-white/[0.06]"
        )}
      >
        {dentro ? (
          <span aria-hidden className={cn("absolute top-2 bottom-2 left-0 w-1 rounded-r-full", cor.barra, trilho && "hidden lg:block")} />
        ) : null}
        <Link
          href={item.href}
          onClick={() => {
            if (temFilhos) setAberto(true)
            onNavegar?.()
          }}
          aria-current={atual ? "page" : undefined}
          title={trilho ? `Time ${item.name}` : undefined}
          className={cn(
            "flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-[15.5px] tracking-[-0.005em] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
            trilho ? "justify-center px-0 lg:justify-start lg:px-4" : "px-4",
            dentro ? "font-bold text-white" : "font-semibold text-sidebar-foreground/80 hover:text-white"
          )}
        >
          <span aria-hidden className={cn("size-4 shrink-0 rounded-[5px] ring-1 ring-white/20 ring-inset", cor.amostra)} />
          <span className={cn("truncate", trilho && "hidden lg:inline")}>{item.name}</span>
        </Link>
        {temFilhos ? (
          <Seta aberto={aberto} nome={`time ${item.name}`} controla={idGaveta} onClick={() => setAberto((v) => !v)} trilho={trilho} />
        ) : null}
      </div>

      {temFilhos && aberto ? (
        <ul
          id={idGaveta}
          className={cn(
            "animate-in fade-in slide-in-from-top-1 mt-1 mb-2 ml-[25px] flex flex-col gap-0.5 border-l-2 pl-2.5 duration-150 motion-reduce:animate-none",
            cor.trilho,
            trilho && "hidden lg:flex"
          )}
        >
          {item.filhos!.map((sub) => (
            <EtapaDoMenu
              key={sub.href}
              item={sub}
              time={time}
              pathname={pathname}
              onNavegar={onNavegar}
              abrirJunto={dentro}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function EtapaDoMenu({
  item,
  time,
  pathname,
  onNavegar,
  abrirJunto = false,
}: {
  item: MenuItem
  time: TimeTarefa
  pathname: string
  onNavegar?: () => void
  /**
   * Os dois lados do amarelo (ADM e Judicial) abrem junto com o time:
   * as etapas é que são o destino, e abrir dois níveis toda vez cansa.
   */
  abrirJunto?: boolean
}) {
  const cor = MENU_TIME[time]
  const atual = casa(pathname, item)
  const dentro = dentroDe(pathname, item)
  const [aberto, setAberto] = useAberto(dentro || abrirJunto, pathname)
  const Icone = item.icon
  const idGaveta = `submenu-${item.href.replace(/\W/g, "")}`

  const link = (
    <Link
      href={item.href}
      onClick={() => {
        if (item.filhos) setAberto(true)
        onNavegar?.()
      }}
      aria-current={atual ? "page" : undefined}
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 text-[14.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
        atual
          ? "bg-white/[0.11] font-semibold text-white"
          : dentro
            ? "font-semibold text-sidebar-foreground/90 hover:bg-white/[0.06]"
            : "font-medium text-sidebar-foreground/65 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {Icone ? (
        <Icone size={16} strokeWidth={1.9} aria-hidden className={cn("shrink-0", atual || dentro ? "text-white" : "text-sidebar-foreground/45")} />
      ) : (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full transition-colors", atual ? cor.barra : "bg-sidebar-foreground/25")}
        />
      )}
      <span className="truncate">{item.name}</span>
    </Link>
  )

  if (!item.filhos?.length) return <li>{link}</li>

  return (
    <li>
      <div className="flex items-center">
        {link}
        <Seta aberto={aberto} nome={item.name} controla={idGaveta} onClick={() => setAberto((v) => !v)} trilho={false} />
      </div>
      {aberto ? (
        <ul id={idGaveta} className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-2.5">
          {item.filhos.map((sub) => (
            <EtapaDoMenu key={sub.href} item={sub} time={time} pathname={pathname} onNavegar={onNavegar} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

// ── Item comum (Dashboard, Agenda, Processos…) ────────────

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
  const Icon = item.icon ?? LayoutGrid
  const ativo = !item.soAbre && casa(pathname, item)
  const dentro = dentroDe(pathname, item)
  const [aberto, setAberto] = useAberto(dentro, pathname)
  const temFilhos = Boolean(item.filhos?.length)
  const idGaveta = `submenu-${item.href.replace(/\W/g, "") || "raiz"}`

  const classe = cn(
    "group relative flex min-w-0 items-center gap-3 rounded-xl",
    // Na linha com a seta, o link divide a largura; sozinho, ocupa a
    // linha inteira — com flex-1 numa coluna ele encolhia de altura.
    temFilhos ? "flex-1" : "w-full shrink-0",
    "tracking-[-0.005em] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/70",
    filho ? "h-10 px-3 text-[14.5px]" : "h-11 text-[15.5px]",
    !filho && (trilho ? "justify-center px-0 lg:justify-start lg:px-4" : "px-4"),
    ativo
      ? "bg-sidebar-accent font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.3)]"
      : dentro
        ? "font-semibold text-sidebar-foreground/90 hover:bg-white/[0.06]"
        : "font-medium text-sidebar-foreground/70 hover:bg-white/[0.06] hover:text-white"
  )

  const conteudo = (
    <>
      {ativo && !filho ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_12px_2px_rgba(124,159,240,0.55)]",
            trilho && "hidden lg:block"
          )}
        />
      ) : null}
      <Icon
        size={filho ? 17 : 19}
        strokeWidth={ativo ? 2.1 : 1.8}
        aria-hidden
        className={cn(
          "shrink-0 transition-colors duration-150",
          ativo ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/90"
        )}
      />
      <span className={cn("truncate", trilho && !filho && "hidden lg:inline")}>{item.name}</span>
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
    <div>
      <div className="flex items-center">
        {link}
        <Seta aberto={aberto} nome={item.name} controla={idGaveta} onClick={() => setAberto((v) => !v)} trilho={trilho} />
      </div>
      {aberto ? (
        <div
          id={idGaveta}
          className={cn(
            "animate-in fade-in slide-in-from-top-1 mt-1 mb-2 ml-[25px] flex flex-col gap-0.5 border-l-2 border-white/10 pl-2.5 duration-150 motion-reduce:animate-none",
            trilho && "hidden lg:flex"
          )}
        >
          {item.filhos!.map((sub) => (
            <ItemNavegacao key={sub.href} item={sub} trilho={false} pathname={pathname} onNavegar={onNavegar} filho />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Navegacao({ trilho, onNavegar }: Modo) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex flex-1 flex-col gap-7 overflow-y-auto pt-2 pb-5", trilho ? "px-2 lg:px-4" : "px-4")}
    >
      {menuGroups.map((grupo, i) => (
        <div key={grupo.label ?? i} className="flex flex-col gap-1">
          {grupo.label ? (
            <p
              className={cn(
                "flex items-center gap-2 px-4 pb-2 text-[12.5px] leading-none font-semibold text-sidebar-foreground/40",
                trilho && "hidden lg:flex"
              )}
            >
              {grupo.label === "Times" ? <UsersRound size={13} aria-hidden /> : null}
              {grupo.label}
            </p>
          ) : null}
          {trilho && i > 0 ? <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-sidebar-border lg:hidden" /> : null}

          {grupo.items.map((item) =>
            item.time ? (
              <ItemTime key={item.href} item={item} trilho={trilho} pathname={pathname} onNavegar={onNavegar} />
            ) : (
              <ItemNavegacao key={item.href} item={item} trilho={trilho} pathname={pathname} onNavegar={onNavegar} />
            )
          )}
        </div>
      ))}
    </nav>
  )
}

const ATALHOS_CELULAR: { name: string; icon: LucideIcon; href: string; exato?: boolean }[] = [
  { name: "Início", icon: LayoutDashboard, href: "/", exato: true },
  { name: "Times", icon: UsersRound, href: "/times" },
  { name: "Agenda", icon: CalendarDays, href: "/agenda" },
]

/**
 * A barra do celular: Dashboard, os times, a agenda e o menu inteiro.
 * Cada botão tem pelo menos 48px de altura, e a barra respeita a faixa
 * do gesto de voltar do iPhone.
 */
function BarraInferior({ onAbrirMenu, menuAberto }: { onAbrirMenu: () => void; menuAberto: boolean }) {
  const pathname = usePathname()
  const ativoEm = (href: string, exato?: boolean) =>
    exato ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const classe = (ativo: boolean) =>
    cn(
      "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
      ativo ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/60 active:bg-sidebar-accent/60"
    )

  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-sidebar-border bg-sidebar px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {ATALHOS_CELULAR.map((a) => {
        const Icone = a.icon
        const ativo = ativoEm(a.href, a.exato)
        return (
          <Link key={a.href} href={a.href} aria-current={ativo ? "page" : undefined} className={classe(ativo)}>
            <Icone size={20} strokeWidth={ativo ? 2.1 : 1.8} className={ativo ? "text-sidebar-primary" : undefined} />
            {a.name}
          </Link>
        )
      })}
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menu de navegação"
        aria-expanded={menuAberto}
        aria-controls="sidebar-drawer"
        className={classe(false)}
      >
        <Menu size={20} strokeWidth={1.8} />
        Menu
      </button>
    </nav>
  )
}

/** Fundo do painel: azul-noite com uma luz suave no topo. */
const FUNDO_SIDEBAR =
  "bg-sidebar bg-[radial-gradient(640px_320px_at_0%_0%,rgba(124,159,240,0.16),transparent_60%),radial-gradient(420px_280px_at_100%_100%,rgba(219,39,119,0.10),transparent_60%)]"

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
      {/* Tablet: trilho de 76px. Desktop: 300px. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col border-r border-sidebar-border text-sidebar-foreground transition-[width] duration-200 ease-out md:flex lg:w-[300px]",
          FUNDO_SIDEBAR
        )}
      >
        <Marca trilho />
        <Navegacao trilho />
        <div className="border-t border-sidebar-border p-2 lg:px-4 lg:py-3">
          <LogoutButton
            className="h-11 justify-center px-0 text-[15px] lg:justify-start lg:px-4"
            labelClassName="hidden lg:inline"
          />
        </div>
      </aside>

      {/* Celular: barra fixa embaixo; o último botão abre o menu inteiro. */}
      <BarraInferior onAbrirMenu={() => setDrawerAberto(true)} menuAberto={drawerAberto} />

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
              "animate-in slide-in-from-left absolute inset-y-0 left-0 flex w-[300px] max-w-[86vw] flex-col border-r border-sidebar-border text-sidebar-foreground shadow-float duration-200 ease-out",
              FUNDO_SIDEBAR
            )}
          >
            <div className="flex items-center justify-between pr-3">
              <Marca trilho={false} />
              <button
                type="button"
                autoFocus
                onClick={() => setDrawerAberto(false)}
                aria-label="Fechar menu de navegação"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors duration-150 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <Navegacao trilho={false} onNavegar={() => setDrawerAberto(false)} />

            <div className="border-t border-sidebar-border px-4 py-3">
              <LogoutButton className="h-11 px-4 text-[15px]" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
