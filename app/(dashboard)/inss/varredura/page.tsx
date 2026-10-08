"use client"

import { useMemo, useState } from "react"
import { Pagina } from "@/components/layout/pagina"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Segmentado } from "@/components/ui/segmentado"
import { URL_GERID, URL_MEU_INSS } from "@/lib/domain/protocolo"
import {
  Landmark,
  ShieldCheck,
  ShieldAlert,
  Users,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
} from "lucide-react"

/**
 * Central do INSS — varredura (protótipo visual, sem banco).
 *
 * Esta tela MOSTRA o monitor de requerimentos; ela não executa login
 * nem baixa nada. Os dados abaixo são de exemplo, em memória. Quando
 * houver backend, a lista vem da fila de varredura e o "Varrer agora"
 * dispara o serviço — que roda fora daqui, como o motor DJEN.
 *
 * O desenho segue a filosofia do resto da integração INSS do sistema
 * (ver components/integracoes/painel-inss.tsx e lib/domain/protocolo):
 *
 *  - Três formas de acesso, nesta ordem de preferência: PROCURAÇÃO
 *    eletrônica (um login do advogado representa todos os clientes),
 *    COFRE de senha do titular (plano B, cifrado) e GERID (quando o
 *    acesso do escritório voltar).
 *  - A varredura só LÊ e anota. O que exige mexer no processo (enviar
 *    prorrogação, emenda, protocolo) é preparado e PARA numa fila de
 *    revisão — o envio é um ato do advogado, não da máquina.
 *  - Quando o gov.br pede captcha/código, o cliente fica "acesso
 *    pendente" em vez de travar o lote inteiro.
 */

type Acesso = "PROCURACAO" | "COFRE" | "GERID"
type SituacaoAcesso = "OK" | "PENDENTE" | "BLOQUEADO"

type ItemVarredura = {
  id: string
  nome: string
  cpf: string // mascarado
  beneficio: string
  acesso: Acesso
  situacao: SituacaoAcesso
  ultimaLeitura: string | null // ISO
  mudanca: string | null
}

type Prorrogacao = {
  id: string
  nome: string
  beneficio: string
  dcb: string // ISO — cessação a vencer
  jaPedida: boolean
  pastaPronta: boolean
}

const ACESSO_LABEL: Record<Acesso, string> = {
  PROCURACAO: "Procuração",
  COFRE: "Cofre de senha",
  GERID: "GERID",
}

const HOJE = "2026-10-08"

// ── Dados de exemplo ──────────────────────────────────────
const FILA: ItemVarredura[] = [
  { id: "1", nome: "Maria das Graças Oliveira", cpf: "***.***.321-**", beneficio: "Auxílio-doença", acesso: "PROCURACAO", situacao: "OK", ultimaLeitura: "2026-10-08", mudanca: "Perícia marcada para 21/10 — APS Taguatinga" },
  { id: "2", nome: "João Batista de Souza", cpf: "***.***.104-**", beneficio: "BPC/LOAS", acesso: "PROCURACAO", situacao: "OK", ultimaLeitura: "2026-10-08", mudanca: "Exigência: juntar CadÚnico atualizado (prazo 22/10)" },
  { id: "3", nome: "Antônia Ferreira Lima", cpf: "***.***.772-**", beneficio: "Salário-maternidade", acesso: "COFRE", situacao: "PENDENTE", ultimaLeitura: "2026-10-06", mudanca: null },
  { id: "4", nome: "Edson Carvalho Pinto", cpf: "***.***.558-**", beneficio: "Aposentadoria por idade", acesso: "PROCURACAO", situacao: "OK", ultimaLeitura: "2026-10-08", mudanca: null },
  { id: "5", nome: "Marinez Rocha da Silva", cpf: "***.***.718-**", beneficio: "Auxílio-doença", acesso: "COFRE", situacao: "OK", ultimaLeitura: "2026-10-07", mudanca: "Benefício concedido — baixar carta e extrato" },
  { id: "6", nome: "Ildebrando Alves Nunes", cpf: "***.***.156-**", beneficio: "Aposentadoria especial", acesso: "GERID", situacao: "BLOQUEADO", ultimaLeitura: "2026-09-30", mudanca: null },
  { id: "7", nome: "Francisca Pereira Matos", cpf: "***.***.289-**", beneficio: "BPC/LOAS", acesso: "COFRE", situacao: "PENDENTE", ultimaLeitura: "2026-10-06", mudanca: null },
  { id: "8", nome: "Osmar Teixeira Barbosa", cpf: "***.***.690-**", beneficio: "Pensão por morte", acesso: "PROCURACAO", situacao: "OK", ultimaLeitura: "2026-10-08", mudanca: "Em análise — sem novidade desde 15/09" },
]

const PRORROGACOES: Prorrogacao[] = [
  { id: "5", nome: "Marinez Rocha da Silva", beneficio: "Auxílio-doença", dcb: "2026-10-18", jaPedida: false, pastaPronta: true },
  { id: "1", nome: "Maria das Graças Oliveira", beneficio: "Auxílio-doença", dcb: "2026-10-20", jaPedida: false, pastaPronta: true },
  { id: "9", nome: "Reginaldo Gomes da Costa", beneficio: "Auxílio-doença", dcb: "2026-10-23", jaPedida: true, pastaPronta: true },
  { id: "10", nome: "Cleuza Martins de Araújo", beneficio: "Auxílio por incapacidade", dcb: "2026-10-24", jaPedida: false, pastaPronta: false },
]

function dataBr(iso: string | null) {
  if (!iso) return "—"
  return iso.slice(0, 10).split("-").reverse().join("/")
}

function diasAte(iso: string) {
  const alvo = new Date(`${iso}T12:00:00Z`).getTime()
  const base = new Date(`${HOJE}T12:00:00Z`).getTime()
  return Math.round((alvo - base) / 86_400_000)
}

function SeloAcesso({ acesso }: { acesso: Acesso }) {
  const Icone = acesso === "GERID" ? Landmark : ShieldCheck
  return (
    <Badge variant={acesso === "GERID" ? "muted" : "secondary"}>
      <Icone /> {ACESSO_LABEL[acesso]}
    </Badge>
  )
}

function SeloSituacao({ situacao }: { situacao: SituacaoAcesso }) {
  if (situacao === "OK")
    return (
      <Badge variant="success">
        <CheckCircle2 /> acesso ok
      </Badge>
    )
  if (situacao === "PENDENTE")
    return (
      <Badge variant="warning">
        <ShieldAlert /> acesso pendente
      </Badge>
    )
  return (
    <Badge variant="danger">
      <AlertTriangle /> GERID bloqueado
    </Badge>
  )
}

export default function VarreduraPage() {
  const [filtro, setFiltro] = useState<"TODOS" | Acesso>("TODOS")
  const [rodando, setRodando] = useState(false)
  const [fila, setFila] = useState(FILA)

  const lista = useMemo(
    () => (filtro === "TODOS" ? fila : fila.filter((i) => i.acesso === filtro)),
    [fila, filtro]
  )

  const pendentes = fila.filter((i) => i.situacao !== "OK").length
  const mudancas = fila.filter((i) => i.mudanca).length
  const prorrogacoesAVencer = PRORROGACOES.filter((p) => !p.jaPedida).length

  // Simula um lote: marca os clientes com acesso OK como lidos agora.
  // Sem rede, sem banco — só para a tela mostrar o ciclo.
  function varrerAgora() {
    if (rodando) return
    setRodando(true)
    setTimeout(() => {
      setFila((atual) =>
        atual.map((i) =>
          i.situacao === "OK" ? { ...i, ultimaLeitura: HOJE } : i
        )
      )
      setRodando(false)
    }, 1400)
  }

  return (
    <Pagina
      titulo="Central do INSS — varredura"
      subtitulo="Acompanha os requerimentos no INSS e anota o que mudou. Protótipo com dados de exemplo."
      voltar={{ href: "/inss", rotulo: "Administrativo" }}
    >
      {/* Aviso honesto: o que esta tela é e o que ainda não faz. */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <p>
          Protótipo visual, sem banco e sem acesso real ao INSS. A varredura
          só <strong>lê e anota</strong>; captcha ou código do gov.br deixa o
          cliente em <strong>acesso pendente</strong> em vez de travar o lote,
          e prorrogação/emenda são preparadas e <strong>param na fila de
          revisão</strong> — o envio é um ato do advogado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Na varredura"
          value={String(fila.length)}
          description="clientes acompanhados"
          icon={Users}
          tom="info"
        />
        <MetricCard
          title="Acesso pendente"
          value={String(pendentes)}
          description="captcha, código ou GERID bloqueado"
          icon={ShieldAlert}
          tom={pendentes > 0 ? "alerta" : "neutro"}
        />
        <MetricCard
          title="Mudanças novas"
          value={String(mudancas)}
          description="encontradas no último ciclo"
          icon={CheckCircle2}
          tom={mudancas > 0 ? "sucesso" : "neutro"}
        />
        <MetricCard
          title="Prorrogações a vencer"
          value={String(prorrogacoesAVencer)}
          description="DCB nos próximos 15 dias"
          icon={CalendarDays}
          tom={prorrogacoesAVencer > 0 ? "alerta" : "neutro"}
          href="#prorrogacoes"
          rotuloLink="Ver fila"
        />
      </div>

      {/* Próximo lote + ritmo */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              {rodando ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Landmark size={20} strokeWidth={1.9} />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold">
                {rodando ? "Lendo o lote atual…" : "Varredura em lotes"}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                ~10 clientes a cada 30–40 min, no horário de expediente. Próximo
                lote às 09:40.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={URL_MEU_INSS}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
            >
              <ExternalLink size={15} /> Meu INSS
            </a>
            <a
              href={URL_GERID}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
            >
              <ExternalLink size={15} /> GERID
            </a>
            <Button onClick={varrerAgora} disabled={rodando}>
              {rodando ? <Loader2 size={16} className="animate-spin" /> : null}
              Varrer agora
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fila de clientes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-[14px]">Clientes na varredura</CardTitle>
          <Segmentado
            aria-label="Filtrar por forma de acesso"
            valor={filtro}
            onChange={setFiltro}
            tamanho="sm"
            opcoes={[
              { valor: "TODOS", rotulo: "Todos" },
              { valor: "PROCURACAO", rotulo: "Procuração" },
              { valor: "COFRE", rotulo: "Cofre" },
              { valor: "GERID", rotulo: "GERID" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Benefício</th>
                  <th className="py-2 pr-3 font-medium">Acesso</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Última leitura</th>
                  <th className="py-2 font-medium">Mudança encontrada</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-border/60 last:border-0 align-top"
                  >
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{i.nome}</p>
                      <p className="text-[12px] text-muted-foreground tabular-nums">
                        {i.cpf}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {i.beneficio}
                    </td>
                    <td className="py-2.5 pr-3">
                      <SeloAcesso acesso={i.acesso} />
                    </td>
                    <td className="py-2.5 pr-3">
                      <SeloSituacao situacao={i.situacao} />
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground tabular-nums">
                      {dataBr(i.ultimaLeitura)}
                    </td>
                    <td className="py-2.5">
                      {i.mudanca ? (
                        <span className="text-foreground">{i.mudanca}</span>
                      ) : i.situacao === "PENDENTE" ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          aguardando liberar o acesso
                        </span>
                      ) : i.situacao === "BLOQUEADO" ? (
                        <span className="text-red-700 dark:text-red-400">
                          acesso do advogado bloqueado
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          sem novidade
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Fila de prorrogação — preparada, para na revisão */}
      <Card id="prorrogacoes">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-[14px]">
            Prorrogações a preparar (DCB nos próximos 15 dias)
          </CardTitle>
          <Badge variant="outline">
            {PRORROGACOES.filter((p) => p.pastaPronta && !p.jaPedida).length}{" "}
            prontas para revisar
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRORROGACOES.map((p) => {
            const dias = diasAte(p.dcb)
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {p.beneficio} · cessação {dataBr(p.dcb)}{" "}
                    <span
                      className={
                        dias <= 7
                          ? "font-semibold text-red-700 dark:text-red-400"
                          : "text-amber-700 dark:text-amber-400"
                      }
                    >
                      (em {dias} dias)
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.jaPedida ? (
                    <Badge variant="muted">prorrogação já pedida</Badge>
                  ) : p.pastaPronta ? (
                    <Badge variant="info">pedido montado</Badge>
                  ) : (
                    <Badge variant="warning">faltam documentos</Badge>
                  )}
                  <a
                    href={URL_MEU_INSS}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={p.jaPedida || !p.pastaPronta}
                    className={
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors " +
                      (p.jaPedida || !p.pastaPronta
                        ? "pointer-events-none border border-input bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:opacity-90")
                    }
                  >
                    Revisar e enviar <ChevronRight size={15} />
                  </a>
                </div>
              </div>
            )
          })}
          <p className="pt-1 text-[12px] text-muted-foreground">
            O sistema monta o pedido com a pasta do Drive e confere se a
            prorrogação já foi pedida. O envio abre o portal com tudo pronto —
            o disparo é do advogado, nunca automático.
          </p>
        </CardContent>
      </Card>
    </Pagina>
  )
}
