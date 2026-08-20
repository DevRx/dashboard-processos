"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import {
  CartaoCategoria,
  type ChipEtiqueta,
} from "@/components/administrativo/cartao-categoria"
import { TOM_PERICIA, TOM_STATUS } from "@/components/administrativo/paleta"
import { ListaClientes } from "@/components/administrativo/lista-clientes"
import { useFilaAdministrativa } from "@/components/administrativo/usar-fila"
import type { ItemFila } from "@/components/administrativo/tipos"
import {
  CATEGORIAS_ADMINISTRATIVO,
  categorizarBeneficio,
  type CategoriaAdministrativo,
} from "@/lib/domain/beneficio"
import {
  PERICIA_LABEL,
  SITUACOES_PERICIA,
  getProcessoStatusLabel,
  isSituacaoPericia,
  periciaSugerida,
} from "@/lib/domain/processo"
import { Landmark, Search, Stethoscope, Users } from "lucide-react"

/**
 * Tela do administrativo.
 *
 * Duas camadas: a marca e o quadro de famílias de benefício, em que
 * cada cartão leva à sua própria página. As tarefas do escritório
 * moram em /tarefas — elas atravessam o escritório todo e não são
 * assunto do requerimento no INSS.
 */

type ClienteIntegracao = {
  id: string
  nome: string
  baseLegal: string | null
  fontes: string[]
  retencaoAte: string | null
  retencaoVencida: boolean
  retencaoVencendo: boolean
  importadas: number
  pendentesAplicacao: number
  ultimaImportacao: string | null
}

const BASE_LEGAL_CURTO: Record<string, string> = {
  EXERCICIO_DIREITOS: "Procuração",
  CONSENTIMENTO: "Consentimento",
  OBRIGACAO_LEGAL: "Obrigação legal",
}

function formatarData(iso?: string | null) {
  if (!iso) return "—"
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export default function AdministrativoPage() {
  const { ativos, carregando, salvarFicha, trocarPericia } =
    useFilaAdministrativa()
  const [clientes, setClientes] = useState<ClienteIntegracao[]>([])
  const [busca, setBusca] = useState("")

  const carregarPainel = useCallback(() => {
    return fetch("/api/integracoes/painel")
      .then((r) => (r.ok ? r.json() : { clientes: [] }))
      .then((data) => setClientes(data.clientes ?? []))
      .catch((err) => console.error("Erro ao carregar integração:", err))
  }, [])

  useEffect(() => {
    carregarPainel()
  }, [carregarPainel])

  const porCategoria = useMemo(() => {
    const mapa = Object.fromEntries(
      CATEGORIAS_ADMINISTRATIVO.map((c) => [c, [] as ItemFila[]])
    ) as Record<CategoriaAdministrativo, ItemFila[]>

    for (const item of ativos) {
      mapa[categorizarBeneficio(item.beneficio)].push(item)
    }

    return mapa
  }, [ativos])

  // Perícia a marcar é a única pendência da tela com hora certa: vale
  // um número no topo e uma chamada no cartão da família.
  const aMarcarPericia = useMemo(
    () =>
      porCategoria.AUXILIO_DOENCA.filter((i) => {
        const etiqueta = isSituacaoPericia(i.situacaoPericia)
          ? i.situacaoPericia
          : periciaSugerida(i.status ?? "")
        return etiqueta === "MARCAR_PERICIA"
      }).length,
    [porCategoria]
  )

  /**
   * As etiquetas do cartão. No auxílio-doença são as de perícia — as
   * únicas que a equipe troca à mão. Nas outras famílias, o estado do
   * processo cumpre o mesmo papel: dizer o que há dentro da fila sem
   * precisar entrar nela.
   */
  const etiquetasPorCategoria = useMemo(() => {
    const mapa = {} as Record<CategoriaAdministrativo, ChipEtiqueta[]>

    for (const categoria of CATEGORIAS_ADMINISTRATIVO) {
      const itens = porCategoria[categoria]

      if (categoria === "AUXILIO_DOENCA") {
        const contagem = new Map(SITUACOES_PERICIA.map((s) => [s, 0]))

        for (const i of itens) {
          const etiqueta = isSituacaoPericia(i.situacaoPericia)
            ? i.situacaoPericia
            : periciaSugerida(i.status ?? "")
          contagem.set(etiqueta, (contagem.get(etiqueta) ?? 0) + 1)
        }

        mapa[categoria] = SITUACOES_PERICIA.filter(
          (s) => (contagem.get(s) ?? 0) > 0
        ).map((s) => ({
          rotulo: PERICIA_LABEL[s],
          total: contagem.get(s) ?? 0,
          tom: TOM_PERICIA[s],
        }))
        continue
      }

      const contagem = new Map<string, number>()
      for (const i of itens) {
        const chave = i.status ?? "SEM_PROCESSO"
        contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
      }

      mapa[categoria] = [...contagem.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([status, total]) => ({
          rotulo:
            status === "SEM_PROCESSO"
              ? "sem processo"
              : getProcessoStatusLabel(status),
          total,
          tom: TOM_STATUS[status] ?? TOM_STATUS.SEM_PROCESSO,
        }))
    }

    return mapa
  }, [porCategoria])

  const buscando = busca.trim().length > 0

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return []

    const digitos = termo.replace(/\D/g, "")

    return ativos
      .filter((i) => {
        const cpf = (i.cliente.cpf ?? "").replace(/\D/g, "")
        return (
          normalizar(i.cliente.nome).includes(termo) ||
          (digitos.length > 0 && cpf.includes(digitos)) ||
          normalizar(i.beneficio).includes(termo)
        )
      })
      .sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome))
  }, [ativos, busca])

  const ordenados = [...clientes].sort((a, b) => {
    if (b.pendentesAplicacao !== a.pendentesAplicacao) {
      return b.pendentesAplicacao - a.pendentesAplicacao
    }
    if (Boolean(a.baseLegal) !== Boolean(b.baseLegal)) {
      return a.baseLegal ? 1 : -1
    }
    return a.nome.localeCompare(b.nome)
  })

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title="Administrativo"
          subtitle="Requerimentos no INSS por família de benefício"
        />
        <main className="flex-1 space-y-5 p-6">
          {/* A logo mora numa placa clara própria: no tema escuro ela
              continua legível sem precisar de uma segunda arte. */}
          <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <span
              aria-hidden
              className="block h-1 w-full bg-gradient-to-r from-[#1351B4] via-[#FFCD07] to-[#168821]"
            />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
              <div className="flex shrink-0 items-center rounded-lg bg-white px-3.5 py-2.5 ring-1 ring-black/5">
                <Image
                  src="/inss-logo.svg"
                  alt="INSS — Instituto Nacional do Seguro Social"
                  width={380}
                  height={110}
                  priority
                  unoptimized
                  className="h-14 w-auto"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-heading text-[17px] leading-tight font-semibold">
                  Painel Administrativo
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                  Requerimentos em curso no INSS. Abra uma família de benefício
                  para trabalhar a fila dela.
                </p>
              </div>

              <div className="flex shrink-0 items-stretch gap-2.5">
                <div className="flex items-center gap-2.5 rounded-lg bg-accent px-3.5 py-2 text-accent-foreground">
                  <Users size={17} strokeWidth={1.9} />
                  <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                    {ativos.length}
                  </span>
                  <span className="text-[10px] leading-tight font-semibold tracking-wide uppercase">
                    na fila
                  </span>
                </div>

                <div
                  className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2 ${
                    aMarcarPericia > 0
                      ? "bg-red-50 text-red-800 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Stethoscope size={17} strokeWidth={1.9} />
                  <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                    {aMarcarPericia}
                  </span>
                  <span className="text-[10px] leading-tight font-semibold tracking-wide uppercase">
                    perícias
                    <br />a marcar
                  </span>
                </div>
              </div>
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
              placeholder="Buscar por nome, CPF ou benefício"
              aria-label="Buscar na fila administrativa"
              className="pl-9 text-sm"
            />
          </div>

          {/* Buscando, o quadro sai da frente: quem digitou um nome
              quer o cliente, não a contagem por família. */}
          {buscando ? (
            resultados.length === 0 ? (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={Search}
                    title="Nada encontrado"
                    description={`Nenhum cliente na fila administrativa corresponde a "${busca}".`}
                  />
                </CardContent>
              </Card>
            ) : (
              <ListaClientes
                itens={resultados}
                mostrarCategoria
                onSalvarFicha={salvarFicha}
                onTrocarPericia={trocarPericia}
              />
            )
          ) : carregando ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {CATEGORIAS_ADMINISTRATIVO.map((categoria) => (
                <CartaoCategoria
                  key={categoria}
                  categoria={categoria}
                  total={porCategoria[categoria].length}
                  etiquetas={etiquetasPorCategoria[categoria]}
                  alerta={
                    categoria === "AUXILIO_DOENCA" && aMarcarPericia > 0
                      ? `${aMarcarPericia} ${
                          aMarcarPericia === 1
                            ? "perícia a marcar"
                            : "perícias a marcar"
                        }`
                      : null
                  }
                />
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">
                Integração INSS — Meu INSS e GERID
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ordenados.length === 0 ? (
                <EmptyState icon={Landmark} title="Nenhum cliente cadastrado" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                        <th className="py-2 pr-3 font-medium">Cliente</th>
                        <th className="py-2 pr-3 font-medium">Base legal</th>
                        <th className="py-2 pr-3 font-medium">Documentos</th>
                        <th className="py-2 pr-3 font-medium">Retenção</th>
                        <th className="py-2 font-medium">Última importação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordenados.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="py-2.5 pr-3">
                            <Link
                              href={`/clientes/${c.id}`}
                              className="font-medium text-primary hover:underline dark:text-blue-400"
                            >
                              {c.nome}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3">
                            {c.baseLegal ? (
                              <Badge variant="secondary">
                                {BASE_LEGAL_CURTO[c.baseLegal] ?? c.baseLegal}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">ausente</Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            {c.importadas === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                {c.importadas}
                                {c.pendentesAplicacao > 0 && (
                                  <Badge variant="default">
                                    {c.pendentesAplicacao} a aplicar
                                  </Badge>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            {!c.retencaoAte ? (
                              <span className="text-muted-foreground">
                                sem prazo
                              </span>
                            ) : c.retencaoVencida ? (
                              <Badge variant="destructive">
                                vencida em {formatarData(c.retencaoAte)}
                              </Badge>
                            ) : c.retencaoVencendo ? (
                              <Badge variant="outline">
                                vence {formatarData(c.retencaoAte)}
                              </Badge>
                            ) : (
                              formatarData(c.retencaoAte)
                            )}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {formatarData(c.ultimaImportacao)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
