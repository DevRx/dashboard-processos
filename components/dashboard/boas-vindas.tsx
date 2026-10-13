"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import {
  Bell,
  CalendarDays,
  ListChecks,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { formatarDataLonga, primeiroNome, saudacao } from "@/lib/formatar"

const ATALHOS: { rotulo: string; href: string; icone: LucideIcon; dica: string }[] = [
  { rotulo: "Novo cliente", href: "/clientes?novo=1", icone: UserPlus, dica: "Cadastrar uma pessoa" },
  { rotulo: "Nova tarefa", href: "/tarefas", icone: ListChecks, dica: "Passar algo para um time" },
  { rotulo: "Agenda", href: "/agenda", icone: CalendarDays, dica: "Compromissos e prazos" },
  { rotulo: "Intimações", href: "/judicial/intimacoes", icone: Bell, dica: "O que o diário publicou" },
]

const semAssinatura = () => () => {}

/**
 * "Bom dia, Iuri" e os quatro atalhos de todo dia.
 *
 * A hora do cumprimento é a do relógio de quem abriu a tela, não a do
 * servidor — que fica em outro fuso. No servidor sai um "Olá" neutro e
 * o navegador corrige assim que monta, sem discordar do HTML recebido.
 */
export function BoasVindas({ nome }: { nome: string }) {
  const cumprimento = useSyncExternalStore(
    semAssinatura,
    () => saudacao(),
    () => "Olá"
  )
  const hoje = useSyncExternalStore(
    semAssinatura,
    () => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      return formatarDataLonga(iso)
    },
    () => ""
  )

  // Faixa, não cartão: o cumprimento abre a tela sem ocupar o lugar dos
  // números. Os atalhos ficam à direita, do tamanho de um botão.
  return (
    <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h2 className="font-heading text-[22px] leading-tight font-semibold tracking-[-0.01em]">
          {cumprimento}, {primeiroNome(nome) || "bem-vindo"}!
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground first-letter:uppercase">
          {hoje || "\u00a0"}
        </p>
      </div>

      <nav aria-label="Atalhos" className="grid shrink-0 grid-cols-4 gap-2 md:flex">
        {ATALHOS.map((a) => {
          const Icone = a.icone
          return (
            <Link
              key={a.href}
              href={a.href}
              title={a.dica}
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl bg-card px-2 py-1.5 text-[11px] font-semibold text-foreground/85 shadow-card transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:min-h-0 md:flex-row md:gap-2 md:px-3 md:text-[12.5px]"
            >
              <Icone size={15} strokeWidth={2} className="text-primary dark:text-accent-foreground" />
              <span className="truncate">{a.rotulo}</span>
            </Link>
          )
        })}
      </nav>
    </section>
  )
}
