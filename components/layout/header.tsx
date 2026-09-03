"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { ChevronDown, LogOut, Moon, Search, Settings, Sun } from "lucide-react"

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
 * em si ainda não existe, apenas o lugar dela na barra.
 */
function CampoBusca() {
  return (
    <button
      type="button"
      disabled
      title="Busca global — em breve"
      className="hidden h-9 w-56 shrink-0 cursor-not-allowed items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 text-left text-[13px] text-muted-foreground/70 md:flex lg:w-72"
    >
      <Search size={15} strokeWidth={1.9} className="shrink-0" />
      <span className="flex-1 truncate">Buscar em tudo</span>
      <kbd className="hidden shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/80 lg:inline-block">
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
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <Sun size={17} strokeWidth={1.9} className="dark:hidden" />
      <Moon size={17} strokeWidth={1.9} className="hidden dark:block" />
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
          "flex h-10 items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
          aberto && "bg-muted"
        )}
      >
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(219,39,119,0.6)]">
          {usuario ? iniciais(nome) : ""}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-1 ring-white/30 ring-inset"
          />
        </span>

        <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
          <span className="max-w-[10rem] truncate text-[12.5px] font-semibold">
            {nome || "—"}
          </span>
          <span className="max-w-[10rem] truncate text-[10.5px] text-muted-foreground">
            {papel}
          </span>
        </span>

        <ChevronDown
          size={15}
          strokeWidth={1.9}
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
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-float duration-150"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[12px] font-bold text-white">
              {usuario ? iniciais(nome) : ""}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{nome || "—"}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {usuario?.email ?? ""}
              </p>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            href="/configuracoes"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] text-foreground/85 transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted"
          >
            <Settings size={16} strokeWidth={1.9} className="shrink-0" />
            Configurações
          </Link>

          <LogoutButton
            icone={<LogOut size={16} strokeWidth={1.9} className="shrink-0" />}
            className="h-9 justify-start gap-2.5 rounded-lg px-3 text-[13px] text-foreground/85 hover:bg-muted hover:text-foreground"
          />
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
    <header className="glass sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-border/80 px-4 text-card-foreground md:px-7">
      <div className="min-w-0 flex-1">
        <h1 className="font-heading truncate text-[17px] leading-tight font-bold tracking-[-0.015em]">
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
