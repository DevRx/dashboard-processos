import "server-only"
import { cache } from "react"
import { supabase } from "@/lib/supabase/server"

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
 * `cache` da React deduplica a consulta dentro da mesma requisição: a
 * página inicial sozinha faz seis consultas escopadas, e seria um
 * desperdício perguntar seis vezes quem trabalha aqui.
 */
export const idsDoEscritorio = cache(async (): Promise<string[]> => {
  const { data, error } = await supabase.from("users").select("id")

  if (error) {
    // Lista vazia é o lado seguro do erro: a consulta não acha nada,
    // em vez de deixar de filtrar e achar tudo.
    console.error("Escopo do escritório:", error.message)
    return []
  }

  return (data ?? []).map((u) => u.id as string)
})
