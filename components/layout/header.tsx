"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { ChevronDown, Moon, Search, Settings, Sun } from "lucide-react"

import { LogoutButton } from "@/components/auth/logout-button"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/data"

type Usuario = {
  id: string
  name: string
  email: string
  role: UserRole
}

const ROTULO_POR_PAPEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  ADVOGADO: "Advogado",
  ASSISTENTE: "Assistente",
  USER: "Usuário",
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * Estrutura da busca global. Renderiza desabilitada de propósito: a busca
 * em si não pertence a esta sprint, apenas o lugar dela na barra.
 */
function CampoBusca() {
  return (
    <button
      type="button"
      disabled
      title="Busca global — em breve"
      className="hidden h-9 w-56 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg border border-input/70 bg-muted/40 px-3 text-left text-[13px] text-muted-foreground/70 md:flex lg:w-72"
    >
      <Search size={15} strokeWidth={1.75} className="shrink-0" />
      <span className="flex-1 truncate">Buscar</span>
      <kbd className="hidden shrink-0 rounded border border-input/70 bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/70 lg:inline-block">
        ⌘K
      </kbd>
    </button>
  )
}

function BotaoTema() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema"
      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {/* Os dois ícones existem no HTML e o CSS escolhe qual aparece.
          Evita o estado `mounted` que causava um flash na hidratação. */}
      <Sun size={17} strokeWidth={1.75} className="dark:hidden" />
      <Moon size={17} strokeWidth={1.75} className="hidden dark:block" />
    </button>
  )
}

function MenuUsuario() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ativo = true

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (ativo && data?.user) setUsuario(data.user as Usuario)
      })
      .catch(() => {})

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!aberto) return

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false)
    }
    const aoClicar = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false)
    }

    document.addEventListener("keydown", aoTeclar)
    document.addEventListener("mousedown", aoClicar)

    return () => {
      document.removeEventListener("keydown", aoTeclar)
      document.removeEventListener("mousedown", aoClicar)
    }
  }, [aberto])

  const nome = usuario?.name ?? ""
  const papel = usuario ? ROTULO_POR_PAPEL[usuario.role] : ""

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Menu do usuário"
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg pr-1.5 pl-1.5 transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
          aberto && "bg-accent"
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {usuario ? iniciais(nome) : ""}
        </span>

        <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
          <span className="max-w-[10rem] truncate text-[12.5px] font-medium">
            {nome || "—"}
          </span>
          <span className="max-w-[10rem] truncate text-[10.5px] text-muted-foreground">
            {papel}
          </span>
        </span>

        <ChevronDown
          size={15}
          strokeWidth={1.75}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150",
            aberto && "rotate-180"
          )}
        />
      </button>

      {aberto && (
        <div
          role="menu"
          aria-label="Conta"
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[13px] font-medium">{nome || "—"}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {usuario?.email ?? ""}
            </p>
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            href="/configuracoes"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] text-foreground/80 transition-colors duration-150 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
          >
            <Settings size={16} strokeWidth={1.75} className="shrink-0" />
            Configurações
          </Link>

          <LogoutButton className="h-9 justify-start gap-2.5 px-3 text-[13px] text-foreground/80 hover:bg-accent hover:text-accent-foreground" />
        </div>
      )}
    </div>
  )
}

export function Header({
  title = "Dashboard",
  subtitle = "Visão geral do escritório",
}: {
  title?: string
  subtitle?: string
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/85 px-4 text-card-foreground backdrop-blur-md md:px-6">
      <div className="min-w-0 flex-1">
        <h1 className="font-heading truncate text-[15px] leading-tight font-semibold tracking-[-0.01em]">
          {title}
        </h1>
        <p className="truncate text-[12.5px] leading-tight text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <CampoBusca />

      <div className="flex shrink-0 items-center gap-1">
        <BotaoTema />
        <MenuUsuario />
      </div>
    </header>
  )
}
