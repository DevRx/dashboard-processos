import "server-only"
import { supabase } from "@/lib/supabase/server"

/**
 * O diagnóstico do sistema: variáveis, banco, migrations, funções e as
 * rotinas que precisam estar rodando. Usado por /api/saude (sem login,
 * para quando o login é o que quebrou) e pela ferramenta
 * `saude_do_sistema` do conector do Claude (a rotina que avisa o Zeca
 * pelo WhatsApp quando algo cai).
 *
 * Nada aqui diz um valor, um endereço ou a mensagem crua do banco: só
 * "configurada", "presente", "FALTANDO".
 */

/**
 * Colunas que o código lê e que uma migration precisa ter criado. Uma
 * coluna por tela, escolhida entre as que a migration trouxe: se ela
 * existe, a migration passou por ali.
 */
const EXIGIDAS = [
  { tabela: "clientes", coluna: "observacoes", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "clientes", coluna: "senha_meu_inss", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "clientes", coluna: "latitude", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "processos", coluna: "situacao_pericia", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "tarefas", coluna: "setor", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "tarefas", coluna: "responsavel_id", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "comunicacoes_djen", coluna: "djen_id", migration: "20260830210000_schema_alcanca_o_codigo" },
  { tabela: "tarefas", coluna: "tipo", migration: "20260830180000_duvidas_e_historico" },
  { tabela: "eventos_tarefa", coluna: "id", migration: "20260830180000_duvidas_e_historico" },
  { tabela: "tarefas", coluna: "pasta", migration: "20260925120000_tarefas_pasta_e_origem" },
  { tabela: "tarefas", coluna: "origem_id", migration: "20260925120000_tarefas_pasta_e_origem" },
  { tabela: "tarefa_atribuicoes", coluna: "fim_motivo", migration: "20261013200000_fluxo_atribuicoes" },
  { tabela: "chaves_api", coluna: "hash", migration: "20261014110000_chaves_api" },
  { tabela: "comunicacoes_djen", coluna: "ia_evento_data", migration: "20261014220000_intimacao_evento_aviso" },
  { tabela: "configuracoes", coluna: "chave", migration: "20261014220000_intimacao_evento_aviso" },
  { tabela: "tentativas_login", coluna: "email", migration: "20261015030000_tela_em_uma_ida" },
] as const

/** Funções do banco que o caminho rápido usa; sem elas vale o caminho antigo, mais lento. */
const FUNCOES = [
  { funcao: "fluxo_tela", args: { p_usuarios: [] as string[], p_limite: 1 }, migration: "20261015030000_tela_em_uma_ida" },
  { funcao: "painel_resumo", args: { p_usuarios: [] as string[], p_hoje: "2026-01-01" }, migration: "20261015030000_tela_em_uma_ida" },
] as const

export type Achado = { nome: string; ok: boolean; detalhe: string }
export type Diagnostico = { saudavel: boolean; resumo: string; achados: Achado[] }

/** Dias úteis entre duas datas (segunda a sexta), para saber se a rotina do DJEN pulou algum. */
function diasUteisDesde(data: Date, ate = new Date()) {
  let n = 0
  const d = new Date(data)
  d.setUTCHours(12, 0, 0, 0)
  while (d < ate) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && d < ate) n++
  }
  return n
}

export async function diagnosticar(): Promise<Diagnostico> {
  const achados: Achado[] = []

  // As três obrigatórias. Hoje a build quebra sem elas, então aqui é
  // confirmação, não descoberta — mas confirmação vale quando o resto
  // está estranho.
  for (const nome of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SESSION_SECRET"]) {
    achados.push({ nome, ok: Boolean(process.env[nome]), detalhe: process.env[nome] ? "configurada" : "FALTANDO" })
  }

  // Opcionais: sem elas o sistema roda, com pedaços desligados.
  for (const [nome, oQueDesliga] of [
    ["SENHA_INSS_KEY", "cofre usa SESSION_SECRET como chave"],
    ["ANTHROPIC_API_KEY", "leitura de laudo e triagem por IA desligadas"],
    ["DJEN_CRON_SECRET", "rotina automática do DJEN não roda"],
  ] as const) {
    achados.push({ nome, ok: true, detalhe: process.env[nome] ? "configurada" : `ausente — ${oQueDesliga}` })
  }

  // O banco responde? Uma consulta barata, que não lê dado de cliente.
  let bancoOk = false
  try {
    // `.limit(1)` e não `head: true`: com `head` o supabase-js engole o
    // 404 de tabela inexistente e devolve 204 com `error` nulo.
    const { error } = await supabase.from("users").select("id").limit(1)
    bancoOk = !error
    achados.push({ nome: "conexão com o Supabase", ok: bancoOk, detalhe: bancoOk ? "responde" : "NÃO RESPONDE — ver o log do deploy" })
    if (error) console.error("Saúde — Supabase:", error.message)
  } catch (erro) {
    achados.push({ nome: "conexão com o Supabase", ok: false, detalhe: "NÃO RESPONDE — ver o log do deploy" })
    console.error("Saúde — Supabase:", erro)
  }

  if (!bancoOk) return fechar(achados)

  // O schema está em dia? Migration aplicada à mão é fácil de esquecer.
  for (const { tabela, coluna, migration } of EXIGIDAS) {
    const { error } = await supabase.from(tabela).select(coluna).limit(1)
    achados.push({ nome: `${tabela}.${coluna}`, ok: !error, detalhe: error ? `FALTANDO — aplique ${migration}.sql` : "presente" })
  }

  for (const { funcao, args, migration } of FUNCOES) {
    const { error } = await supabase.rpc(funcao, args)
    achados.push({
      nome: `função ${funcao}()`,
      ok: !error,
      detalhe: error ? `FALTANDO — aplique ${migration}.sql (a tela segue pelo caminho lento)` : "presente",
    })
  }

  // Valor novo de enum não é coluna: a única forma de saber se o banco
  // conhece o rosa é perguntar por ele.
  const { error: semRosa } = await supabase.from("tarefas").select("id").eq("setor", "ROSA").limit(1)
  achados.push({ nome: "time rosa (tarefas.setor)", ok: !semRosa, detalhe: semRosa ? "FALTANDO — aplique 20261013090000_time_rosa.sql" : "presente" })

  // A rotina do DJEN passou hoje? Ela roda duas vezes por dia útil
  // (vercel.json). Um dia útil inteiro sem passar é rotina parada —
  // e automação silenciosa que parou é pior que não ter automação.
  if (process.env.DJEN_CRON_SECRET) {
    const { data: ultima } = await supabase
      .from("auditorias")
      .select("created_at")
      .eq("acao", "DJEN_SINCRONIZACAO_AUTOMATICA")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const quando = ultima?.created_at ? new Date(ultima.created_at) : null
    const pulados = quando ? diasUteisDesde(quando) : null
    const ok = quando !== null && (pulados ?? 0) < 1
    achados.push({
      nome: "rotina do DJEN",
      ok,
      detalhe: !quando
        ? "NUNCA RODOU — conferir DJEN_CRON_SECRET e os crons do vercel.json"
        : ok
          ? `passou em ${quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
          : `PARADA — última passada em ${quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (${pulados} dia(s) útil(eis) sem rodar)`,
    })
  }

  return fechar(achados)
}

function fechar(achados: Achado[]): Diagnostico {
  const saudavel = achados.every((a) => a.ok)
  return {
    saudavel,
    resumo: saudavel ? "Tudo que o sistema precisa está no lugar." : "Há pendências — veja o que está FALTANDO.",
    achados,
  }
}
