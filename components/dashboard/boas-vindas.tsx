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

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-card">
      <span
        aria-hidden
        className="block h-1 w-full bg-gradient-to-r from-primary via-brand to-primary"
      />
      <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-[22px] leading-tight font-semibold tracking-[-0.01em]">
            {cumprimento}, {primeiroNome(nome) || "bem-vindo"}!
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground first-letter:uppercase">
            {hoje ? `${hoje} · ` : ""}Este é o resumo do escritório. Comece por um atalho ou role para ver os números.
          </p>
        </div>

        <nav aria-label="Atalhos" className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          {ATALHOS.map((a) => {
            const Icone = a.icone
            return (
              <Link
                key={a.href}
                href={a.href}
                title={a.dica}
                className="group flex items-center gap-2.5 rounded-xl bg-accent/70 px-3 py-2.5 text-accent-foreground ring-1 ring-inset ring-foreground/5 transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:flex-col sm:items-start sm:gap-2 sm:px-3.5 sm:py-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-card dark:text-accent-foreground">
                  <Icone size={16} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-tight font-semibold">
                    {a.rotulo}
                  </span>
                  <span className="hidden truncate text-[11px] leading-tight text-muted-foreground sm:block">
                    {a.dica}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </section>
  )
}
