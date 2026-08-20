"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { ArrowLeft, Search } from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { ListaClientes } from "@/components/administrativo/lista-clientes"
import { TINTA } from "@/components/administrativo/paleta"
import { useFilaAdministrativa } from "@/components/administrativo/usar-fila"
import {
  CATEGORIA_DESCRICAO,
  CATEGORIA_LABEL,
  categoriaPorSlug,
  categorizarBeneficio,
} from "@/lib/domain/beneficio"
import { isSituacaoPericia, periciaSugerida } from "@/lib/domain/processo"
import { cn } from "@/lib/utils"

/**
 * Fila de uma família de benefício, em página própria.
 *
 * O quadro do Administrativo responde "quanto tem em cada fila"; aqui
 * se trabalha uma fila. Separar as duas coisas em páginas diferentes é
 * o que evita a tela virar sete listas abertas ao mesmo tempo.
 */

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export default function FilaCategoriaPage() {
  const params = useParams<{ categoria: string }>()
  const categoria = categoriaPorSlug(params.categoria)

  const { ativos, carregando, salvarFicha, trocarPericia } =
    useFilaAdministrativa()
  const [busca, setBusca] = useState("")

  const itens = useMemo(() => {
    if (!categoria) return []

    const daFamilia = ativos.filter(
      (i) => categorizarBeneficio(i.beneficio) === categoria
    )
    const termo = normalizar(busca.trim())
    const digitos = termo.replace(/\D/g, "")

    const filtrados = !termo
      ? daFamilia
      : daFamilia.filter((i) => {
          const cpf = (i.cliente.cpf ?? "").replace(/\D/g, "")
          return (
            normalizar(i.cliente.nome).includes(termo) ||
            (digitos.length > 0 && cpf.includes(digitos)) ||
            normalizar(i.beneficio).includes(termo)
          )
        })

    return [...filtrados].sort((a, b) =>
      a.cliente.nome.localeCompare(b.cliente.nome)
    )
  }, [ativos, busca, categoria])

  const aMarcarPericia = useMemo(() => {
    if (categoria !== "AUXILIO_DOENCA") return 0
    return itens.filter((i) => {
      const etiqueta = isSituacaoPericia(i.situacaoPericia)
        ? i.situacaoPericia
        : periciaSugerida(i.status ?? "")
      return etiqueta === "MARCAR_PERICIA"
    }).length
  }, [itens, categoria])

  if (!categoria) notFound()

  const tinta = TINTA[categoria]
  const Icone = tinta.icone

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title={CATEGORIA_LABEL[categoria]}
          subtitle={CATEGORIA_DESCRICAO[categoria]}
        />
        <main className="flex-1 space-y-5 p-6">
          <Link
            href="/inss"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            Voltar ao Administrativo
          </Link>

          <section
            className={cn(
              "flex flex-col rounded-xl bg-card ring-1 ring-inset",
              tinta.contorno
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-full shrink-0 rounded-t-xl", tinta.barra)}
            />
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl",
                  tinta.selo
                )}
              >
                <Icone size={24} strokeWidth={1.9} />
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg leading-tight font-semibold">
                  {CATEGORIA_LABEL[categoria]}
                </h2>
                <p className="text-[13px] leading-snug text-muted-foreground">
                  {CATEGORIA_DESCRICAO[categoria]}
                </p>
              </div>

              {aMarcarPericia > 0 && (
                <span className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900">
                  {aMarcarPericia}{" "}
                  {aMarcarPericia === 1 ? "perícia a marcar" : "perícias a marcar"}
                </span>
              )}

              <span className="flex shrink-0 flex-col items-end">
                <span className="font-heading text-3xl leading-none font-semibold tabular-nums">
                  {itens.length}
                </span>
                <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  {itens.length === 1 ? "cliente" : "clientes"}
                </span>
              </span>
            </div>
          </section>

          <div className="relative max-w-sm">
            <Search
              size={15}
              strokeWidth={1.9}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nesta fila"
              aria-label={`Buscar em ${CATEGORIA_LABEL[categoria]}`}
              className="pl-9 text-sm"
            />
          </div>

          {carregando ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : itens.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Icone}
                  title={
                    busca.trim()
                      ? "Nada encontrado"
                      : "Nenhum cliente nesta fila"
                  }
                  description={
                    busca.trim()
                      ? `Nenhum cliente desta família corresponde a "${busca}".`
                      : "Quando houver requerimento desta família, ele aparece aqui."
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <ListaClientes
              itens={itens}
              destacarPericia={categoria === "AUXILIO_DOENCA"}
              onSalvarFicha={salvarFicha}
              onTrocarPericia={trocarPericia}
            />
          )}
        </main>
      </div>
    </div>
  )
}
