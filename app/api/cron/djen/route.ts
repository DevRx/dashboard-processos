import { NextRequest, NextResponse } from "next/server"
import { rodarRotinaDjen } from "@/lib/intimacoes/rotina"

/**
 * Rotina automática: busca o DJEN e abre as tarefas dos prazos, sem
 * ninguém clicar.
 *
 * Acionada por agendador externo (Vercel Cron em produção, launchd ou
 * cron na máquina do escritório) com o header `x-cron-secret` — o
 * mesmo padrão do expurgo da LGPD. Sem `DJEN_CRON_SECRET` configurada
 * a rota fica indisponível em vez de liberar acesso: falha fechada.
 *
 * Rodar mais de uma vez no dia não faz mal — a trava é o `djen_id`
 * único por usuário, e tarefa só nasce de intimação que ainda não tem
 * uma. Isso também é o que permite agendar com folga: se a máquina
 * estava desligada às 8h, a passada das 13h faz o mesmo serviço.
 *
 * O trabalho em si mora em lib/intimacoes/rotina.ts — o conector do
 * Claude (ferramenta `sincronizar_djen`) chama o mesmo quando a rotina
 * de saúde vê que o cron não passou no dia.
 */
async function executar(request: NextRequest) {
  const segredoConfigurado = process.env.DJEN_CRON_SECRET
  const segredoRecebido = request.headers.get("x-cron-secret")

  if (!segredoConfigurado || segredoRecebido !== segredoConfigurado) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const resultado = await rodarRotinaDjen("cron")
  if (!resultado.ok) {
    const status = /DJEN_CRON_USER_EMAIL/.test(resultado.motivo) ? 500 : 502
    return NextResponse.json({ error: resultado.motivo }, { status })
  }

  console.log(`[cron djen] ${resultado.novas} nova(s), ${resultado.tarefasCriadas} tarefa(s)`)
  return NextResponse.json(resultado, { status: 200 })
}

/** GET porque é o método que os agendadores mandam por padrão. */
export async function GET(request: NextRequest) {
  return executar(request)
}

export async function POST(request: NextRequest) {
  return executar(request)
}
