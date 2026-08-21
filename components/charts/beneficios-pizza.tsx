"use client"

import { useId } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import {
  CATEGORIA_LABEL,
  type CategoriaAdministrativo,
} from "@/lib/domain/beneficio"
import { COR_CATEGORIA } from "@/components/administrativo/paleta"

export type FatiaBeneficio = {
  categoria: CategoriaAdministrativo
  total: number
}

/**
 * Distribuição dos processos por família de benefício.
 *
 * A cor vem da mesma fonte dos cartões do Administrativo, para que a
 * fatia e o cartão sejam reconhecíveis como a mesma coisa.
 *
 * A legenda não é enfeite nem repetição: com sete famílias na tela, a
 * cor sozinha não separa todas elas — no modo escuro o melhor par
 * possível ainda fica abaixo do piso de legibilidade. Então quem lê o
 * gráfico encontra nome e contagem escritos ao lado, e a fatia colorida
 * serve para localizar, não para identificar. Por isso ela é sempre
 * exibida, e não atrás de um hover.
 *
 * A ordem das fatias é a que chega, do catálogo — não a da contagem.
 * Ordenar por tamanho parece melhor e é pior: além de mudar a família
 * de lugar entre as duas pizzas, encostava Pensão em Outros, que são o
 * par de verdes mais difícil de separar. No catálogo eles nascem
 * afastados, e essa distância é o que segura a leitura quando a cor
 * não dá conta.
 */
export function BeneficiosPizza({
  titulo,
  descricao,
  fatias,
  vazio,
}: {
  titulo: string
  descricao: string
  fatias: FatiaBeneficio[]
  vazio: string
}) {
  const tituloId = useId()

  const dados = fatias
    .filter((f) => f.total > 0)
    .map((f) => ({
      ...f,
      label: CATEGORIA_LABEL[f.categoria],
      cor: COR_CATEGORIA[f.categoria],
    }))

  const total = dados.reduce((soma, f) => soma + f.total, 0)
  const parte = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return (
    <section
      aria-labelledby={tituloId}
      className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <h3
        id={tituloId}
        className="font-heading text-[14px] leading-tight font-semibold"
      >
        {titulo}
      </h3>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {total === 0
          ? descricao
          : `${descricao} · ${total === 1 ? "1 processo" : `${total} processos`}`}
      </p>

      {dados.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-[13px] text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="h-[180px] w-full shrink-0 sm:w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius="92%"
                  // A borda na cor da superfície é o respiro entre fatias:
                  // sem ela, duas cores próximas encostam e viram uma só.
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {dados.map((f) => (
                    <Cell key={f.categoria} fill={f.cor} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(valor, nome) => {
                    const n = Number(valor) || 0
                    return [`${n} (${parte(n)}%)`, String(nome ?? "")]
                  }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
            {dados.map((f) => (
              <li key={f.categoria} className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 translate-y-px rounded-[3px]"
                  style={{ background: f.cor }}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">
                  {f.label}
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">
                  {f.total}
                </span>
                <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                  {parte(f.total)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
