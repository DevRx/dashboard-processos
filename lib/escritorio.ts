import "server-only"
import { cache } from "react"
import { equipe } from "@/lib/equipe"

/**
 * O dono do dado é o escritório, não quem digitou.
 *
 * Cada linha guarda em `user_id` quem a cadastrou, e isso continua
 * valendo — é registro de autoria, e é o que responde "quem lançou
 * isso?". O que mudou foi a leitura: antes cada pessoa só encontrava as
 * próprias linhas, e duas pessoas do mesmo escritório trabalhando no
 * mesmo caso viam dois sistemas diferentes.
 *
 * Não existe tabela de escritório porque não existe segundo escritório:
 * esta instalação é de um só. Então o escritório é o conjunto de quem
 * tem conta aqui — e é justamente por isso que criar conta deixou de
 * ser público (ver app/api/auth/register/route.ts). Se um dia houver
 * mais de um escritório no mesmo banco, esta função é o único lugar a
 * mudar.
 *
 * A lista vem do cache da equipe (lib/equipe.ts), lido do banco uma
 * vez por minuto por instância — antes era uma consulta por pedido.
 */
export const idsDoEscritorio = cache(async (): Promise<string[]> => {
  try {
    return (await equipe()).map((u) => u.id)
  } catch (e) {
    // Lista vazia é o lado seguro do erro: a consulta não acha nada,
    // em vez de deixar de filtrar e achar tudo.
    console.error("Escopo do escritório:", (e as Error).message)
    return []
  }
})
