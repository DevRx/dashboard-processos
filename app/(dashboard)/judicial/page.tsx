"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Layers, ListTree, Scale, Search } from "lucide-react"

import { Pagina } from "@/components/layout/pagina"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Segmentado } from "@/components/ui/segmentado"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import {
  QuadroJudicial,
  type AgrupamentoJudicial,
  type ItemJudicial,
} from "@/components/judicial/quadro-judicial"
import { AbasJudicial } from "@/components/judicial/abas-judicial"
import {
  REGIAO_LABEL,
  REGIOES_JUDICIAIS,
  faseDoStatus,
  regiaoDaUf,
  ufDoProcesso,
  type RegiaoJudicial,
} from "@/lib/domain/processo"

/**
 * Fila judicial.
 *
 * O par do Administrativo do outro lado da esfera: lá o requerimento
 * no INSS, aqui a ação depois do indeferimento. A consulta ao DataJud
 * (API pública do CNJ, a mesma já usada no cadastro de processos) fica
 * dentro de cada cartão — é onde a pergunta "andou?" aparece.
 */

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export default function JudicialPage() {
  const [itens, setItens] = useState<ItemJudicial[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")
  // O desenho do escritório lê o quadro por tipo de caso (BPC
  // deficiente, incapacidade…); a fase continua a um toque.
  const [agrupamento, setAgrupamento] = useState<AgrupamentoJudicial>("familia")

  const carregar = useCallback(() => {
    return fetch("/api/judicial")
      .then((r) => (r.ok ? r.json() : { itens: [] }))
      .then((d) => setItens(d.itens ?? []))
      .catch((err) => console.error("Erro ao carregar a fila judicial:", err))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const trocarStatus = useCallback(async (processoId: string, status: string) => {
    const r = await fetch(`/api/processos/${processoId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })

    if (!r.ok) return

    setItens((atuais) =>
      atuais.map((i) => (i.id === processoId ? { ...i, status } : i))
    )
  }, [])

  const registrarAndamento = useCallback(
    async (processoId: string, descricao: string, data?: string) => {
      const item = itens.find((i) => i.id === processoId)
      const quando = data?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

      const r = await fetch("/api/andamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processoId,
          data: quando,
          descricao,
          status: item?.status ?? "EM_ANALISE",
        }),
      })

      if (!r.ok) return

      setItens((atuais) =>
        atuais.map((i) =>
          i.id === processoId
            ? {
                ...i,
                ultimoAndamento: { data: quando, descricao },
                totalAndamentos: i.totalAndamentos + 1,
              }
            : i
        )
      )
    },
    [itens]
  )

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    if (!termo) return itens

    const digitos = termo.replace(/\D/g, "")

    return itens.filter((i) => {
      const numero = (i.numero ?? "").replace(/\D/g, "")
      const cpf = (i.cpf ?? "").replace(/\D/g, "")
      return (
        normalizar(i.cliente).includes(termo) ||
        normalizar(i.beneficio).includes(termo) ||
        (digitos.length > 0 &&
          (numero.includes(digitos) || cpf.includes(digitos)))
      )
    })
  }, [itens, busca])

  const semNumero = itens.filter((i) => !i.numero).length

  // A faixa do desenho: "processos ativos · DF · GO · Minas · SP ·
  // Nordeste". Ativo é o que ainda não encerrou; o estado vem da
  // comarca, da vara ou do tribunal.
  const ativos = useMemo(() => itens.filter((i) => faseDoStatus(i.status) !== "ENCERRADA"), [itens])
  const porRegiao = useMemo(() => {
    const conta = Object.fromEntries(REGIOES_JUDICIAIS.map((r) => [r, 0])) as Record<RegiaoJudicial, number>
    for (const i of ativos) conta[regiaoDaUf(ufDoProcesso(i))] += 1
    return conta
  }, [ativos])

  return (
    <Pagina titulo="Judicial" subtitulo="Ações em curso, por tipo de caso ou por fase, com consulta ao DataJud">
      <AbasJudicial />

      <section className="overflow-hidden rounded-xl bg-card shadow-card">
        <span
          aria-hidden
          className="block h-1 w-full bg-gradient-to-r from-slate-500 via-blue-600 to-violet-600"
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Scale size={24} strokeWidth={1.9} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg leading-tight font-semibold">
              Fila judicial
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Ações contra o INSS depois do indeferimento. Cada cartão
              consulta o DataJud pelo número CNJ e grava o movimento como
              andamento.
            </p>
          </div>

          <div className="flex shrink-0 items-stretch gap-2.5">
            <div className="flex items-center gap-2.5 rounded-lg bg-accent px-3.5 py-2 text-accent-foreground">
              <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                {itens.length}
              </span>
              <span className="text-xs leading-tight font-semibold tracking-wide uppercase">
                ações
              </span>
            </div>

            {semNumero > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg bg-amber-50 px-3.5 py-2 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900">
                <span className="font-heading text-xl leading-none font-semibold tabular-nums">
                  {semNumero}
                </span>
                <span className="text-xs leading-tight font-semibold tracking-wide uppercase">
                  sem
                  <br />
                  número CNJ
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        aria-label="Processos ativos por estado"
        className="flex flex-wrap items-stretch gap-2 rounded-xl bg-yellow-50/70 p-2.5 shadow-card dark:bg-yellow-950/20"
      >
        <div className="flex items-center gap-2.5 rounded-lg bg-yellow-400 px-3.5 py-2 text-yellow-950">
          <span className="font-heading text-xl leading-none font-semibold tabular-nums">{ativos.length}</span>
          <span className="text-xs leading-tight font-semibold tracking-wide uppercase">
            processos
            <br />
            ativos
          </span>
        </div>
        {REGIOES_JUDICIAIS.filter((r) => r !== "OUTROS" || porRegiao[r] > 0).map((r) => (
          <div
            key={r}
            className="flex items-center gap-2 rounded-lg bg-card px-3.5 py-2 shadow-card ring-1 ring-yellow-300/60 dark:ring-yellow-800"
          >
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{REGIAO_LABEL[r]}</span>
            <span className="font-heading text-lg leading-none font-semibold tabular-nums">{porRegiao[r]}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Segmentado<AgrupamentoJudicial>
          aria-label="Agrupar o quadro"
          valor={agrupamento}
          onChange={setAgrupamento}
          opcoes={[
            { valor: "familia", rotulo: "Por tipo de caso", icone: Layers },
            { valor: "fase", rotulo: "Por fase", icone: ListTree },
          ]}
        />
      <div className="relative w-full max-w-sm sm:w-auto sm:flex-1">
        <Search
          size={15}
          strokeWidth={1.9}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente, número ou CPF"
          aria-label="Buscar na fila judicial"
          className="pl-9 text-sm"
        />
      </div>
      </div>

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Scale}
              title="Nenhuma ação judicial"
              description="Processos com esfera judicial aparecem aqui. Um requerimento vira ação quando o INSS indefere."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <QuadroJudicial
            itens={filtrados}
            agrupamento={agrupamento}
            onTrocarStatus={trocarStatus}
            onRegistrarAndamento={registrarAndamento}
          />

          {busca.trim() && filtrados.length === 0 && (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Search}
                  title="Nada encontrado"
                  description={`Nenhuma ação corresponde a "${busca}".`}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Pagina>
  )
}
