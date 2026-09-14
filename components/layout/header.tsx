"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { ArrowLeft, ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { LogoutButton } from "@/components/auth/logout-button"
import { ROTULO_POR_PAPEL, useUsuario } from "@/components/layout/usuario-context"
import { cn } from "@/lib/utils"

function BotaoTema() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema claro e escuro"
      title="Tema claro / escuro"
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
  const usuario = useUsuario()
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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
          "flex h-10 items-center gap-2 rounded-lg pr-1.5 pl-1 transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
          aberto && "bg-accent"
        )}
      >
        <Avatar nome={nome} tamanho="sm" />

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
          className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-float duration-150"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar nome={nome} tamanho="md" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{nome || "—"}</p>
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
            className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] text-foreground/80 transition-colors duration-150 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
          >
            <Settings size={16} strokeWidth={1.75} className="shrink-0" />
            Configurações
          </Link>

          <LogoutButton
            icone={<LogOut size={16} strokeWidth={1.75} className="shrink-0" />}
            className="h-9 justify-start gap-2.5 px-3 text-[13px] text-foreground/80 hover:bg-accent hover:text-accent-foreground"
          />
        </div>
      )}
    </div>
  )
}

export function Header({
  title = "Dashboard",
  subtitle,
  acoes,
  voltar,
}: {
  title?: string
  subtitle?: string
  /** Botões principais da tela. Só aparecem aqui a partir de `sm`. */
  acoes?: React.ReactNode
  voltar?: { href: string; rotulo: string }
}) {
  return (
    <header className="glass sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-border/80 px-4 text-card-foreground md:px-7">
      {voltar && (
        <Link
          href={voltar.href}
          aria-label={voltar.rotulo}
          title={voltar.rotulo}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft size={18} strokeWidth={1.9} />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="font-heading truncate text-[17px] leading-tight font-bold tracking-[-0.015em]">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-[12.5px] leading-tight text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {acoes && (
        <div className="hidden shrink-0 items-center gap-2 sm:flex">{acoes}</div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <BotaoTema />
        <MenuUsuario />
      </div>
    </header>
  )
}
