import Link from "next/link"
import {
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  Gavel,
  Landmark,
  ListChecks,
  MapPin,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ROTULO_POR_PAPEL } from "@/lib/papeis"
import { EscolhaAparencia } from "@/components/configuracoes/aparencia"
import { Equipe } from "@/components/configuracoes/equipe"
import { getSession } from "@/lib/session"

const AREAS: { href: string; icone: LucideIcon; nome: string; oQue: string }[] = [
  { href: "/clientes", icone: Users, nome: "Clientes", oQue: "As pessoas atendidas. Cada uma tem uma ficha com dados, documentos e casos." },
  { href: "/tarefas", icone: ListChecks, nome: "Tarefas", oQue: "O que cada time precisa fazer. Arraste o cartão para passar a outro time." },
  { href: "/processos", icone: FileText, nome: "Processos", oQue: "Todos os casos, no INSS e na Justiça, num quadro ou numa lista." },
  { href: "/inss", icone: Landmark, nome: "Administrativo", oQue: "Os requerimentos no INSS, separados por família de benefício." },
  { href: "/judicial", icone: Gavel, nome: "Judicial", oQue: "As ações na Justiça, por fase, com consulta ao DataJud." },
  { href: "/judicial/intimacoes", icone: Bell, nome: "Intimações", oQue: "O que o diário oficial publicou sobre os processos, já triado." },
  { href: "/agenda", icone: CalendarDays, nome: "Agenda", oQue: "Compromissos e prazos: atrasados, de hoje e dos próximos dias." },
  { href: "/mapa", icone: MapPin, nome: "Mapa", oQue: "Onde moram os clientes, cidade por cidade." },
  { href: "/financeiro", icone: Wallet, nome: "Financeiro", oQue: "O que entrou e o que saiu do caixa." },
]

export default async function ConfiguracoesPage() {
  const session = await getSession()

  return (
    <Pagina titulo="Configurações" subtitulo="Seu perfil, a aparência do sistema e a equipe">
      <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
        <span aria-hidden className="block h-1 w-full bg-gradient-to-r from-primary via-brand to-primary" />
        <div className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar nome={session?.name} tamanho="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="font-heading truncate text-[20px] leading-tight font-semibold">
              {session?.name ?? "—"}
            </h2>
            <p className="truncate text-[13px] text-muted-foreground">{session?.email ?? ""}</p>
            {session && (
              <Badge variant="secondary" className="mt-2">
                {ROTULO_POR_PAPEL[session.role] ?? session.role}
              </Badge>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <h2 className="font-heading text-[15px] font-semibold">Aparência</h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Vale só para este navegador. O botão de sol e lua no alto faz a mesma troca.
            </p>
            <EscolhaAparencia />
          </section>

          <Equipe />
        </div>

        <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-heading text-[15px] font-semibold">Como o sistema se organiza</h2>
            <p className="text-[12px] text-muted-foreground">
              Um resumo de cada área do menu, para quem está começando
            </p>
          </div>
          <ul className="divide-y divide-border">
            {AREAS.map((a) => {
              const Icone = a.icone
              return (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icone size={17} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold">{a.nome}</span>
                      <span className="block text-[12px] leading-snug text-muted-foreground">{a.oQue}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Pagina>
  )
}
