"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CircleDashed, Inbox } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/dashboard/status-badge"
import type { SituacaoPericia } from "@/lib/domain/processo"
import { cn } from "@/lib/utils"
import {
  CATEGORIAS_ADMINISTRATIVO,
  CATEGORIA_DESCRICAO,
  CATEGORIA_LABEL,
  CATEGORIA_SLUG,
  categorizarBeneficio,
  precisaClassificar,
  type CategoriaAdministrativo,
} from "@/lib/domain/beneficio"

import { EtiquetaPericia } from "./etiqueta-pericia"
import { FichaClienteAdministrativa } from "./ficha-cliente"
import { TINTA } from "./paleta"
import { formatarCpf, formatarData, type ItemFila } from "./tipos"

/**
 * O quadro do administrativo, uma coluna por família de benefício.
 *
 * Duas escolhas que parecem detalhe e não são:
 *
 * **As sete colunas aparecem sempre**, mesmo vazias. Um kanban que
 * esconde a coluna sem cartão responde "quantos casos temos?" mas não
 * responde "o que este escritório atende?" — e a segunda pergunta é a
 * que alguém novo faz. Coluna vazia também é informação: não há
 * nenhuma pensão por morte na mesa hoje.
 *
 * **Não se arrasta cartão.** A coluna é o benefício requerido, não uma
 * etapa: arrastar alguém de "Aposentadoria" para "Pensão" não é mover
 * trabalho de fase, é dizer que o cliente pediu outra coisa — e isso
 * se corrige no processo, com o benefício certo, não com o polegar.
 * Pelo mesmo motivo o quadro judicial não arrasta (ver
 * components/judicial/quadro-judicial.tsx), e lá a razão é gêmea.
 *
 * O que o cartão faz é abrir a ficha do titular: nome, CPF, senha do
 * Meu INSS, cadastro e comentários da equipe, todos editáveis ali
 * mesmo. É o que se consulta antes de ligar para o cliente ou entrar
 * no gov.br, e é por isso que ele existe.
 */

function CartaoCliente({
  item,
  onAbrir,
  onTrocarPericia,
}: {
  item: ItemFila
  onAbrir: () => void
  onTrocarPericia: (situacao: SituacaoPericia) => Promise<void>
}) {
  const cpf = formatarCpf(item.cliente.cpf)
  const entrada = formatarData(item.dataEntrada)
  const pericia = categorizarBeneficio(item.beneficio) === "AUXILIO_DOENCA"

  return (
    <div
      className={cn(
        // Sem `overflow-hidden`: o menu da etiqueta de perícia escapa
        // do cartão e seria recortado. O cartão com menu aberto sobe de
        // camada para não ser pintado pelos vizinhos.
        "relative rounded-lg bg-card ring-1 ring-foreground/10 transition-shadow",
        "has-[[aria-haspopup=menu][aria-expanded=true]]:z-30 hover:shadow-sm"
      )}
    >
      <div className="relative flex flex-col gap-1.5 p-2.5">
        {/* O clique que abre a ficha é uma camada por baixo, e não um
            botão em volta de tudo: a etiqueta de perícia é ela própria
            um controle, e botão dentro de botão é HTML inválido. */}
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Abrir ficha de ${item.cliente.nome}`}
          className="absolute inset-0 z-0 rounded-lg transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        />

        <div className="pointer-events-none relative z-10 min-w-0">
          <p className="truncate text-[13px] leading-tight font-semibold">
            {item.cliente.nome}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-muted-foreground">
            {cpf ?? "CPF não informado"}
          </p>
        </div>

        <p
          className={cn(
            "pointer-events-none relative z-10 truncate text-[11px] leading-tight",
            item.beneficio ? "text-muted-foreground" : "text-muted-foreground/70 italic"
          )}
        >
          {item.beneficio || "benefício não informado"}
        </p>

        <div className="relative z-10 flex flex-wrap items-center gap-1.5">
          {pericia ? (
            <EtiquetaPericia
              valor={item.situacaoPericia}
              status={item.status}
              editavel={Boolean(item.processoId)}
              onTrocar={onTrocarPericia}
            />
          ) : item.status ? (
            <StatusBadge status={item.status} className="pointer-events-none" />
          ) : (
            <span className="pointer-events-none rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
              sem processo
            </span>
          )}

          {entrada ? (
            <span className="pointer-events-none ml-auto text-[10.5px] text-muted-foreground tabular-nums">
              {entrada}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function QuadroKanbanAdministrativo({
  itens,
  onSalvarFicha,
  onTrocarPericia,
}: {
  itens: ItemFila[]
  onSalvarFicha: (
    clienteId: string,
    patch: { observacoes?: string; senhaMeuInss?: string }
  ) => Promise<void>
  onTrocarPericia: (
    processoId: string,
    situacao: SituacaoPericia
  ) => Promise<void>
}) {
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const { mapa: porCategoria, aClassificar } = useMemo(() => {
    const mapa = Object.fromEntries(
      CATEGORIAS_ADMINISTRATIVO.map((c) => [c, [] as ItemFila[]])
    ) as Record<CategoriaAdministrativo, ItemFila[]>

    const aClassificar: ItemFila[] = []

    for (const item of itens) {
      // Sem benefício informado não cabe em nenhuma das sete famílias:
      // elas dizem que trabalho é aquele, e aqui ninguém disse ainda.
      if (precisaClassificar(item.beneficio)) aClassificar.push(item)
      else mapa[categorizarBeneficio(item.beneficio)].push(item)
    }

    aClassificar.sort((a, b) =>
      a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR")
    )

    for (const categoria of CATEGORIAS_ADMINISTRATIVO) {
      mapa[categoria].sort((a, b) =>
        a.cliente.nome.localeCompare(b.cliente.nome, "pt-BR")
      )
    }

    return { mapa, aClassificar }
  }, [itens])

  // A ficha é procurada na lista viva, não guardada no estado: assim o
  // que a caixa mostra depois de salvar é o que a fila já sabe, sem uma
  // segunda cópia para discordar da primeira.
  const aberto = abertoId
    ? (itens.find((i) => i.id === abertoId) ?? null)
    : null

  return (
    <>
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {CATEGORIAS_ADMINISTRATIVO.map((categoria) => {
          const tinta = TINTA[categoria]
          const Icone = tinta.icone
          const lista = porCategoria[categoria]

          return (
            <section
              key={categoria}
              aria-label={`${CATEGORIA_LABEL[categoria]} — ${lista.length} na fila`}
              className={cn(
                "flex flex-col rounded-xl ring-1 ring-foreground/10 ring-inset",
                tinta.fundo
              )}
            >
              <span
                aria-hidden
                className={cn("h-1.5 w-full shrink-0 rounded-t-xl", tinta.barra)}
              />

              <header className="px-3 py-2.5">
                {/* O nome da família quebra em duas linhas em vez de
                    truncar: com sete colunas na tela "Salário-Maternidade"
                    virava "SALÁRIO-MA…", e uma coluna que não diz qual
                    benefício é não serve para nada. O `min-h` mantém os
                    cabeçalhos alinhados entre colunas de uma linha e de
                    duas. */}
                <div className="flex min-h-[2.4rem] items-start gap-1.5">
                  <Icone
                    size={13}
                    strokeWidth={2}
                    className={cn("mt-px shrink-0", tinta.texto)}
                  />
                  <h3
                    className={cn(
                      "font-heading min-w-0 flex-1 text-[11.5px] leading-[1.25] font-bold tracking-[0.02em] uppercase",
                      tinta.texto
                    )}
                  >
                    {CATEGORIA_LABEL[categoria]}
                  </h3>
                  <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ring-1 ring-foreground/10">
                    {lista.length}
                  </span>
                </div>

                <p className="mt-1 text-[10.5px] leading-tight text-muted-foreground">
                  {CATEGORIA_DESCRICAO[categoria]}
                </p>

                {/* A fila da família continua tendo página própria: o
                    quadro mostra o todo, ela é onde se trabalha uma
                    coluna por vários minutos. */}
                <Link
                  href={`/inss/${CATEGORIA_SLUG[categoria]}`}
                  className="mt-1.5 inline-flex items-center gap-0.5 text-[10.5px] font-medium text-primary hover:underline dark:text-blue-400"
                >
                  abrir a fila
                  <ArrowUpRight size={11} />
                </Link>
              </header>

              <div className="flex flex-col gap-2 px-2.5 pb-2.5">
                {lista.map((item) => (
                  <CartaoCliente
                    key={item.id}
                    item={item}
                    onAbrir={() => setAbertoId(item.id)}
                    onTrocarPericia={(situacao) =>
                      item.processoId
                        ? onTrocarPericia(item.processoId, situacao)
                        : Promise.resolve()
                    }
                  />
                ))}

                {lista.length === 0 && (
                  <p className="flex flex-col items-center gap-1 py-5 text-center text-[10.5px] leading-tight text-muted-foreground">
                    <Inbox size={14} strokeWidth={1.75} />
                    Nenhum caso nesta família
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* Cadastrado e ainda sem dizer o que veio pedir.
          Faixa e não oitava coluna: as sete são famílias de benefício, e
          isto é a ausência de uma. Mesmo desenho que o quadro de tarefas
          usa para quem está sem time. */}
      {aClassificar.length > 0 && (
        <section
          aria-label={`A classificar — ${aClassificar.length} cliente(s)`}
          className="mt-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10 ring-inset"
        >
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            <CircleDashed size={13} strokeWidth={2} />
            A classificar — {aClassificar.length}{" "}
            {aClassificar.length === 1 ? "cliente" : "clientes"} sem benefício
            informado
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            {aClassificar.map((item) => (
              <CartaoCliente
                key={item.id}
                item={item}
                onAbrir={() => setAbertoId(item.id)}
                onTrocarPericia={() => Promise.resolve()}
              />
            ))}
          </div>
        </section>
      )}

      <Dialog
        open={aberto !== null}
        onOpenChange={(estaAberto) => {
          if (!estaAberto) setAbertoId(null)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {aberto ? (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.cliente.nome}</DialogTitle>
                <DialogDescription>
                  {[
                    CATEGORIA_LABEL[categorizarBeneficio(aberto.beneficio)],
                    aberto.beneficio,
                    aberto.protocoloInss
                      ? `protocolo ${aberto.protocoloInss}`
                      : null,
                    aberto.processoId ? null : "sem requerimento aberto",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </DialogHeader>

              <FichaClienteAdministrativa
                cliente={aberto.cliente}
                moldura="caixa"
                onSalvarFicha={(patch) =>
                  onSalvarFicha(aberto.cliente.id, patch)
                }
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
