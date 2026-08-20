"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { MapPin, MapPinOff, Users } from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import type { PontoCliente } from "@/components/mapa/mapa-atendimento"
import { MUNICIPIOS } from "@/lib/domain/localizacao"

/**
 * Mapa de atendimento: onde estão os clientes do escritório.
 *
 * O Leaflet mede o container no momento em que monta e toca em
 * `window` na importação, então o mapa entra sem SSR. O resto da
 * página é servida normalmente.
 */
const MapaAtendimento = dynamic(
  () => import("@/components/mapa/mapa-atendimento").then((m) => m.MapaAtendimento),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full lg:h-[540px]" />,
  }
)

type SemLocalizacao = {
  id: string
  nome: string
  endereco: string | null
  processos: number
  processosAbertos: number
}

export default function MapaPage() {
  const [clientes, setClientes] = useState<PontoCliente[]>([])
  const [semLocalizacao, setSemLocalizacao] = useState<SemLocalizacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    return fetch("/api/mapa")
      .then((r) => (r.ok ? r.json() : { clientes: [], semLocalizacao: [] }))
      .then((d) => {
        setClientes(d.clientes ?? [])
        setSemLocalizacao(d.semLocalizacao ?? [])
      })
      .catch((err) => console.error("Erro ao carregar o mapa:", err))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function apontar(clienteId: string, valor: string) {
    if (!valor) return
    const [nome, uf] = valor.split("|")

    setSalvando(clienteId)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/localizacao`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipio: nome, uf }),
      })

      if (r.ok) await carregar()
    } finally {
      setSalvando(null)
    }
  }

  const porMunicipio = useMemo(() => {
    const mapa = new Map<
      string,
      { municipio: string; uf: string; clientes: number; abertos: number }
    >()

    for (const c of clientes) {
      const chave = `${c.municipio}/${c.uf}`
      const atual = mapa.get(chave)

      if (atual) {
        atual.clientes += 1
        atual.abertos += c.processosAbertos
      } else {
        mapa.set(chave, {
          municipio: c.municipio,
          uf: c.uf,
          clientes: 1,
          abertos: c.processosAbertos,
        })
      }
    }

    return [...mapa.values()].sort((a, b) => b.clientes - a.clientes)
  }, [clientes])

  const totalAbertos = clientes.reduce((t, c) => t + c.processosAbertos, 0)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          title="Mapa"
          subtitle="Onde estão os clientes do escritório"
        />
        <main className="flex-1 space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <MapPin size={18} className="shrink-0 text-primary" />
              <div>
                <p className="font-heading text-xl leading-none font-semibold tabular-nums">
                  {porMunicipio.length}
                </p>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  cidades atendidas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <Users size={18} className="shrink-0 text-primary" />
              <div>
                <p className="font-heading text-xl leading-none font-semibold tabular-nums">
                  {clientes.length}
                </p>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  clientes no mapa · {totalAbertos} em aberto
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <MapPinOff size={18} className="shrink-0 text-muted-foreground" />
              <div>
                <p className="font-heading text-xl leading-none font-semibold tabular-nums">
                  {semLocalizacao.length}
                </p>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  sem localização
                </p>
              </div>
            </div>
          </div>

          {carregando ? (
            <Skeleton className="h-[420px] w-full lg:h-[540px]" />
          ) : clientes.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={MapPin}
                  title="Nenhum cliente no mapa"
                  description="O pin sai do município escrito no endereço do cliente. Cadastre o endereço, ou aponte a cidade na lista abaixo."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <MapaAtendimento clientes={clientes} />

              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h2 className="font-heading text-[14px] leading-tight font-semibold">
                  Onde estamos atendendo
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {porMunicipio.map((m) => (
                    <li
                      key={`${m.municipio}/${m.uf}`}
                      className="flex items-baseline gap-2 border-b border-border/60 pb-2 last:border-0"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {m.municipio}
                        {m.uf ? (
                          <span className="text-muted-foreground">/{m.uf}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                        {m.clientes}
                      </span>
                      {m.abertos > 0 && (
                        <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          {m.abertos} em aberto
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {semLocalizacao.length > 0 && (
            <section className="rounded-xl bg-muted/40 p-4 ring-1 ring-foreground/10 ring-inset">
              <h2 className="font-heading text-[14px] leading-tight font-semibold">
                Sem localização — {semLocalizacao.length} a apontar
              </h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                O endereço destes clientes não traz um município conhecido.
                Escolha a cidade para o pin aparecer no mapa.
              </p>

              <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {semLocalizacao.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1.5 rounded-lg bg-card p-2.5 ring-1 ring-foreground/10"
                  >
                    <Link
                      href={`/clientes/${c.id}`}
                      className="truncate text-[13px] font-semibold hover:underline"
                    >
                      {c.nome}
                    </Link>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.endereco || "sem endereço cadastrado"}
                    </p>

                    <select
                      defaultValue=""
                      disabled={salvando === c.id}
                      onChange={(e) => apontar(c.id, e.target.value)}
                      aria-label={`Cidade de ${c.nome}`}
                      className="h-8 w-full rounded-lg border border-input bg-card px-2 text-[12.5px] outline-none"
                    >
                      <option value="">Apontar cidade…</option>
                      {MUNICIPIOS.map((m) => (
                        <option key={`${m.nome}|${m.uf}`} value={`${m.nome}|${m.uf}`}>
                          {m.nome}/{m.uf}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
