"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { StatusBadge } from "@/components/dashboard/status-badge"
import { cn } from "@/lib/utils"
import {
  CATEGORIA_LABEL,
  categorizarBeneficio,
} from "@/lib/domain/beneficio"
import type { SituacaoPericia } from "@/lib/domain/processo"

import { EtiquetaPericia } from "./etiqueta-pericia"
import { FichaClienteAdministrativa } from "./ficha-cliente"
import { formatarCpf, formatarData, type ItemFila } from "./tipos"

export type AcoesFila = {
  onSalvarFicha: (
    clienteId: string,
    patch: { observacoes?: string; senhaMeuInss?: string }
  ) => Promise<void>
  onTrocarPericia: (processoId: string, situacao: SituacaoPericia) => Promise<void>
}

function LinhaCliente({
  item,
  destacarPericia,
  mostrarCategoria,
  aberto,
  onAlternar,
  onSalvarFicha,
  onTrocarPericia,
}: {
  item: ItemFila
  destacarPericia: boolean
  mostrarCategoria: boolean
  aberto: boolean
  onAlternar: () => void
  onSalvarFicha: (patch: {
    observacoes?: string
    senhaMeuInss?: string
  }) => Promise<void>
  onTrocarPericia: (situacao: SituacaoPericia) => Promise<void>
}) {
  const cpf = formatarCpf(item.cliente.cpf)
  const entrada = formatarData(item.dataEntrada)

  const detalhe = [
    mostrarCategoria ? CATEGORIA_LABEL[categorizarBeneficio(item.beneficio)] : null,
    item.beneficio,
    item.protocoloInss ? `protocolo ${item.protocoloInss}` : null,
    entrada ? `entrada ${entrada}` : null,
    item.processoId ? null : "sem requerimento aberto",
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      className={cn(
        // Sem `overflow-hidden`: o menu da etiqueta de perícia escapa
        // da linha e seria recortado por ele. E a linha cujo menu está
        // aberto sobe de camada — senão as etiquetas das linhas
        // seguintes, empatadas no mesmo nível, pintam por cima dele.
        "relative rounded-lg bg-card ring-1 ring-foreground/10 transition-shadow has-[[aria-haspopup=menu][aria-expanded=true]]:z-30",
        aberto && "shadow-sm ring-foreground/20"
      )}
    >
      {/* A etiqueta de perícia é ela própria um controle, e um botão
          não pode morar dentro de outro. Então quem abre a ficha é uma
          camada de clique por baixo da linha, e a etiqueta fica acima
          dela. */}
      <div className="relative flex items-center gap-3 px-3.5 py-2.5">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          aria-label={`${aberto ? "Fechar" : "Abrir"} ficha de ${item.cliente.nome}`}
          className="absolute inset-0 z-0 rounded-lg transition-colors outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        />

        <div className="pointer-events-none relative z-10 min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className="truncate text-[13.5px] leading-tight font-semibold">
              {item.cliente.nome}
            </span>
            <span className="shrink-0 font-mono text-[11.5px] leading-tight text-muted-foreground">
              {cpf ?? "CPF não informado"}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11.5px] leading-tight text-muted-foreground">
            {detalhe}
          </p>
        </div>

        {destacarPericia ? (
          <div className="relative z-10">
            <EtiquetaPericia
              valor={item.situacaoPericia}
              status={item.status}
              editavel={Boolean(item.processoId)}
              onTrocar={onTrocarPericia}
            />
          </div>
        ) : item.status ? (
          <StatusBadge
            status={item.status}
            className="pointer-events-none relative z-10 shrink-0"
          />
        ) : (
          <span className="pointer-events-none relative z-10 shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            sem processo
          </span>
        )}

        <ChevronDown
          size={16}
          strokeWidth={2}
          className={cn(
            "pointer-events-none relative z-10 shrink-0 text-muted-foreground transition-transform duration-200",
            aberto && "rotate-180"
          )}
        />
      </div>

      {aberto && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          <FichaClienteAdministrativa
            cliente={item.cliente}
            onSalvarFicha={onSalvarFicha}
          />
        </div>
      )}
    </div>
  )
}

/**
 * A fila de clientes, usada na página de uma família e no resultado de
 * busca. Um cliente aberto por vez: dois abertos empurram o terceiro
 * para fora da tela e a lista deixa de ser lista.
 */
export function ListaClientes({
  itens,
  destacarPericia = false,
  mostrarCategoria = false,
  onSalvarFicha,
  onTrocarPericia,
}: {
  itens: ItemFila[]
  destacarPericia?: boolean
  mostrarCategoria?: boolean
} & AcoesFila) {
  const [aberto, setAberto] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {itens.map((item) => (
        <LinhaCliente
          key={item.id}
          item={item}
          destacarPericia={destacarPericia}
          mostrarCategoria={mostrarCategoria}
          aberto={aberto === item.id}
          onAlternar={() => setAberto((a) => (a === item.id ? null : item.id))}
          onSalvarFicha={(patch) => onSalvarFicha(item.cliente.id, patch)}
          onTrocarPericia={(situacao) =>
            item.processoId
              ? onTrocarPericia(item.processoId, situacao)
              : Promise.resolve()
          }
        />
      ))}
    </div>
  )
}
