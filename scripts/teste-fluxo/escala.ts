/**
 * Teste em escala do fluxo novo das tarefas.
 *
 * Roda contra o sistema de verdade — as rotas do Next falando com um
 * Postgres que tem as migrations do repositório (inclusive a
 * 20261013200000_fluxo_atribuicoes) por trás de um PostgREST — e
 * confere, no banco, as regras que o Zeca pediu:
 *
 *   • a tarefa pode estar em mais de um lugar e pode voltar no fluxo;
 *   • com mais de um responsável, quem conclui a sua parte não tira a
 *     tarefa dos outros — ela só sai da etapa com a última parte, e só
 *     fecha de vez quando não sobra parte aberta em lugar nenhum;
 *   • o resumo da tarefa (time, responsável, status) nunca discorda das
 *     partes;
 *   • nenhuma tarefa com parte aberta some da tela dos times.
 *
 * O que é comum aos testes de carga mora em comum.ts.
 *
 * Uso (com o app rodando e o banco no ar):
 *
 *   BASE=http://localhost:3123 DATABASE_URL=postgres://… SESSION_SECRET=… \
 *     npx tsx scripts/teste-fluxo/escala.ts [tarefas] [operacoes] [simultaneas]
 *
 * As tarefas do teste levam origem_id "teste-escala:…" e são apagadas
 * no começo de cada rodada. NÃO rode contra o banco de produção.
 */
import {
  U,
  EQUIPE,
  db,
  chamar,
  acaso,
  sortear,
  amostra,
  confere,
  percentil,
  falhas,
  verificacoes,
  erros5xx,
  statusPorOp,
  tempos,
  TODAS_ETAPAS,
  lugarDe,
  semear,
  listaDaTela,
  invariantes,
  novaTarefa,
  acao,
  partesAbertas,
  statusDa,
  type Resposta,
  type TarefaApi,
} from "./comum"
import { TIMES_TAREFA, gruposDa, atribuicoesDa, type EtapaId } from "../../lib/domain/tarefa"

const N_TAREFAS = Number(process.argv[2] ?? 3000)
const N_OPERACOES = Number(process.argv[3] ?? 10000)
const SIMULTANEAS = Number(process.argv[4] ?? 24)

// ── Cenários do Zeca, um por um ───────────────────────────

async function cenarios() {
  // S1 — dois responsáveis: a Tay conclui, a tarefa continua para o Claude.
  const s1 = await novaTarefa("NOVA S1 dois responsáveis", "agendar-video")
  let p = await partesAbertas(s1.id)
  confere(p.length === 2 && p.some((x) => x.responsavel_id === U.tay.id) && p.some((x) => x.responsavel_id === U.claude.id),
    `S1: agendar vídeo deveria nascer com Claude e Tayane (veio ${JSON.stringify(p)})`)
  let r = await acao(U.tay, s1.id, { acao: "concluirMinhaParte" })
  confere(r.status === 200, `S1: Tay concluir a parte dela devolveu ${r.status}`)
  p = await partesAbertas(s1.id)
  confere(p.length === 1 && p[0].responsavel_id === U.claude.id, `S1: depois da Tay, só o Claude deveria seguir com a tarefa (${JSON.stringify(p)})`)
  confere((await statusDa(s1.id)).status === "PENDENTE", "S1: a tarefa não pode fechar quando só a Tay concluiu")
  const tela = await listaDaTela(U.claude)
  confere(tela.some((t) => t.id === s1.id), "S1: a tarefa sumiu da tela depois que a Tay concluiu")
  r = await acao(U.claude, s1.id, { acao: "concluirParte", em: lugarDe("agendar-video"), responsavelId: U.claude.id })
  confere(r.status === 200 && (await statusDa(s1.id)).status === "CONCLUIDA", "S1: com a última parte concluída, a tarefa deveria fechar")

  // S2 — no ADM e no Judicial ao mesmo tempo: concluir um lado não fecha o outro.
  const s2 = await novaTarefa("NOVA S2 ADM e Judicial", "adm-protocolo", [U.gui.id])
  r = await acao(U.zeca, s2.id, { acao: "adicionar", para: lugarDe("jud-pendente"), responsaveis: [U.zeca.id] })
  confere(r.status === 200, `S2: pôr também no Judicial devolveu ${r.status}`)
  r = await acao(U.gui, s2.id, { acao: "concluirMinhaParte" })
  p = await partesAbertas(s2.id)
  confere(p.length === 1 && p[0].etapa === "jud-pendente", `S2: só o Judicial deveria seguir aberto (${JSON.stringify(p)})`)
  confere((await statusDa(s2.id)).setor === "AMARELO" && (await statusDa(s2.id)).status === "PENDENTE", "S2: a tarefa deveria seguir aberta no amarelo")

  // S3 — volta do amarelo para o Acompanhamento do azul (laudo atualizado).
  r = await acao(U.zeca, s2.id, { acao: "mover", de: lugarDe("jud-pendente"), para: lugarDe("acompanhamento") })
  p = await partesAbertas(s2.id)
  confere(r.status === 200 && p.every((x) => x.setor === "AZUL" && x.etapa === "acompanhamento"), `S3: deveria voltar ao Acompanhamento (${JSON.stringify(p)})`)
  confere(p.length === 2 && p.some((x) => x.responsavel_id === U.tay.id) && p.some((x) => x.responsavel_id === U.claude.id),
    `S3: o Acompanhamento indica Claude e Tayane (${JSON.stringify(p)})`)
  const hist = (await db.query(`select fim_motivo from tarefa_atribuicoes where tarefa_id = $1 and fim_em is not null`, [s2.id])).rows.map((x) => x.fim_motivo)
  confere(hist.includes("MOVIDA") && hist.includes("CONCLUIDA"), `S3: o caminho da tarefa deveria ficar registrado (${hist})`)

  // S4 — dez pessoas movendo o mesmo cartão ao mesmo tempo: só uma leva.
  const s4 = await novaTarefa("NOVA S4 corrida", "analise", [U.claude.id])
  const corrida = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      acao(sortear(EQUIPE), s4.id, { acao: "mover", de: lugarDe("analise"), para: lugarDe(i % 2 ? "agendar-video" : "revisao-analise") }, "corrida mover")
    )
  )
  const ok = corrida.filter((x) => x.status === 200).length
  const conflito = corrida.filter((x) => x.status === 409).length
  p = await partesAbertas(s4.id)
  confere(ok === 1 && conflito === 9, `S4: exatamente um mover deveria valer (${ok} valeram, ${conflito} conflitos)`)
  confere(new Set(p.map((x: { setor: string; etapa: string }) => `${x.setor}|${x.etapa}`)).size === 1, `S4: o cartão deveria estar num lugar só (${JSON.stringify(p)})`)

  // S5 — os dois responsáveis concluindo no mesmo instante.
  for (let i = 0; i < 30; i++) {
    const s5 = await novaTarefa(`NOVA S5 simultâneo ${i}`, "aguardando-assinatura")
    await Promise.all([
      acao(U.tay, s5.id, { acao: "concluirMinhaParte" }, "simultâneo concluir"),
      acao(U.claude, s5.id, { acao: "concluirMinhaParte" }, "simultâneo concluir"),
    ])
    const st = await statusDa(s5.id)
    const feitas = (await db.query(`select responsavel_id, fim_por from tarefa_atribuicoes where tarefa_id = $1 and fim_motivo = 'CONCLUIDA'`, [s5.id])).rows
    confere(st.status === "CONCLUIDA" && feitas.length === 2 && feitas.every((f) => f.responsavel_id === f.fim_por),
      `S5[${i}]: com as duas partes concluídas juntas a tarefa deveria fechar e cada um fechar só a sua (${st.status}, ${JSON.stringify(feitas)})`)
  }

  // S6 — concluir pela agenda/quadro geral (status direto) fecha tudo; reabrir volta ao último lugar.
  const s6 = await novaTarefa("NOVA S6 fecha por fora", "videos")
  await chamar("PATCH status", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { status: "CONCLUIDA" })
  confere((await partesAbertas(s6.id)).length === 0, "S6: fechar a tarefa por fora deveria fechar as partes")
  await chamar("PATCH status", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { status: "PENDENTE" })
  p = await partesAbertas(s6.id)
  confere(p.length === 1 && p[0].etapa === "videos", `S6: reabrir deveria voltar a Vídeos (${JSON.stringify(p)})`)

  // S7 — arrastar no quadro geral para outro time leva as partes juntas.
  await chamar("PATCH setor", U.zeca, "PATCH", `/api/tarefas/${s6.id}`, { setor: "ROSA" })
  p = await partesAbertas(s6.id)
  confere(p.length === 1 && p[0].setor === "ROSA" && p[0].etapa === null, `S7: trocar o time por fora deveria levar a parte (${JSON.stringify(p)})`)

  // S8 — tarefa do TickTick entra no fluxo na primeira ação, mesmo com cliques simultâneos.
  const legado = (await db.query(`select id from tarefas t where origem_id like 'teste-escala:%' and status = 'PENDENTE' and setor = 'VERMELHO' and pasta = 'JUDICIAL › PROTOCOLO NOVO' and not exists (select 1 from tarefa_atribuicoes a where a.tarefa_id = t.id) limit 20`)).rows
  for (const { id } of legado) {
    await Promise.all([
      acao(U.zeca, id, { acao: "adicionar", para: lugarDe("adm-pendente"), responsaveis: [U.gui.id] }, "legado simultâneo"),
      acao(U.gui, id, { acao: "adicionar", para: lugarDe("adm-pendente"), responsaveis: [U.gui.id] }, "legado simultâneo"),
      acao(U.tay, id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [U.zeca.id, U.tay.id] }, "legado simultâneo"),
    ])
    p = await partesAbertas(id)
    const lugares = new Set(p.map((x) => `${x.setor}|${x.etapa}`))
    confere(lugares.has("AMARELO|jud-protocolo") && lugares.has("AMARELO|adm-pendente") && lugares.size === 2,
      `S8: a tarefa do TickTick deveria entrar em Judicial › Protocolo (pela pasta) e também em ADM › Pendente (${JSON.stringify(p)})`)
    confere(p.filter((x) => x.etapa === "adm-pendente").length === 1, `S8: ADM › Pendente duplicado (${JSON.stringify(p)})`)
  }

  // S9 — trocar responsáveis não fecha a etapa nem duplica ninguém.
  const s9 = await novaTarefa("NOVA S9 troca de responsáveis", "jud-protocolo")
  await acao(U.zeca, s9.id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [U.gui.id, U.ryan.id] })
  p = await partesAbertas(s9.id)
  confere(p.length === 2 && p.every((x) => [U.gui.id, U.ryan.id].includes(x.responsavel_id)), `S9: responsáveis trocados (${JSON.stringify(p)})`)
  await acao(U.zeca, s9.id, { acao: "responsaveis", em: lugarDe("jud-protocolo"), responsaveis: [] })
  p = await partesAbertas(s9.id)
  confere(p.length === 1 && p[0].responsavel_id === null && (await statusDa(s9.id)).status === "PENDENTE",
    `S9: sem responsáveis a etapa deveria ficar com uma vaga, ainda aberta (${JSON.stringify(p)})`)

  // S10 — quem não é responsável não fecha a tarefa de vários por engano.
  const s10 = await novaTarefa("NOVA S10 terceiro", "aguardando-assinatura")
  r = await acao(U.gui, s10.id, { acao: "concluirMinhaParte" })
  confere(r.status === 409 && (await partesAbertas(s10.id)).length === 2, `S10: o Guilherme não é responsável — devia receber 409 e nada fechar (${r.status})`)

  // S11 — entrega do rosa: nasce com Zeca e Ryan, e basta um entregar.
  const s11 = await novaTarefa("NOVA S11 entrega", "entrega-marcada")
  p = await partesAbertas(s11.id)
  confere(p.length === 2 && p.some((x) => x.responsavel_id === U.zeca.id) && p.some((x) => x.responsavel_id === U.ryan.id),
    `S11: Entrega marcada deveria nascer com Zeca e Ryan (veio ${JSON.stringify(p)})`)
  r = await acao(U.ryan, s11.id, { acao: "concluirMinhaParte" })
  confere(r.status === 200 && (await partesAbertas(s11.id)).length === 0 && (await statusDa(s11.id)).status === "CONCLUIDA",
    `S11: o Ryan entregou — a tarefa deveria fechar para os dois (${r.status}, ${JSON.stringify(await partesAbertas(s11.id))})`)

  // S12 — a entrega acaba, mas a outra frente da tarefa continua.
  const s12 = await novaTarefa("NOVA S12 entrega e andamento", "agendar-entrega")
  await acao(U.zeca, s12.id, { acao: "adicionar", para: lugarDe("andamentos"), responsaveis: [U.claude.id] })
  r = await acao(U.tay, s12.id, { acao: "concluirMinhaParte" })
  confere(r.status === 409, `S12: a Tay não é responsável e a tarefa está em dois lugares — devia receber 409 (${r.status})`)
  r = await acao(U.zeca, s12.id, { acao: "concluirMinhaParte" })
  p = await partesAbertas(s12.id)
  confere(r.status === 200 && p.length === 1 && p[0].etapa === "andamentos" && (await statusDa(s12.id)).status === "PENDENTE",
    `S12: concluída a entrega, só o andamento do Claude deveria seguir (${JSON.stringify(p)})`)

  // S13 — as etapas do desenho de 14/10 nascem com quem o desenho indica.
  const esperado: [EtapaId, string[]][] = [
    ["questoes-clientes", [U.claude.id, U.zeca.id]],
    ["adm-andamentos", [U.claude.id, U.gui.id]],
    ["jud-andamentos", [U.claude.id, U.zeca.id]],
  ]
  for (const [etapa, quem] of esperado) {
    const t = await novaTarefa(`NOVA S13 ${etapa}`, etapa)
    p = await partesAbertas(t.id)
    confere(
      p.length === quem.length && quem.every((q) => p.some((x) => x.responsavel_id === q && x.etapa === etapa)),
      `S13: ${etapa} deveria nascer com ${quem.length} responsáveis do desenho (veio ${JSON.stringify(p)})`
    )
  }
  // Exigência processual sai do vermelho para o amarelo e volta.
  const s13 = await novaTarefa("NOVA S13 exigência", "andamentos")
  r = await acao(U.zeca, s13.id, { acao: "mover", de: lugarDe("andamentos"), para: lugarDe("jud-andamentos") })
  p = await partesAbertas(s13.id)
  confere(r.status === 200 && p.every((x) => x.setor === "AMARELO" && x.etapa === "jud-andamentos") && p.length === 2,
    `S13: andamento do vermelho deveria ir a Judicial › Andamentos com Claude e Zeca (${JSON.stringify(p)})`)
  r = await acao(U.claude, s13.id, { acao: "mover", de: lugarDe("jud-andamentos"), para: lugarDe("andamentos") })
  p = await partesAbertas(s13.id)
  confere(r.status === 200 && p.every((x) => x.setor === "VERMELHO" && x.etapa === "andamentos"), `S13: e voltar ao vermelho (${JSON.stringify(p)})`)
  // Dúvida do cliente que virou pendência volta ao Acompanhamento do azul.
  const s13b = await novaTarefa("NOVA S13 questão", "questoes-clientes")
  r = await acao(U.claude, s13b.id, { acao: "mover", de: lugarDe("questoes-clientes"), para: lugarDe("acompanhamento") })
  p = await partesAbertas(s13b.id)
  confere(r.status === 200 && p.length === 2 && p.every((x) => x.etapa === "acompanhamento"), `S13: questão → Acompanhamento (${JSON.stringify(p)})`)
}

// ── Motor do DJEN: perícia vira duas tarefas, e o envio fica travado ──

async function djenEAviso() {
  const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows

  // Um cliente com WhatsApp e um processo dele, para o aviso ter número.
  const clienteId = crypto.randomUUID()
  const processoId = crypto.randomUUID()
  await db.query(`delete from clientes where cpf = '000.000.000-00'`)
  await db.query(
    `insert into clientes (id, user_id, nome, cpf, telefone) values ($1, $2, 'CLIENTE TESTE PERICIA', '000.000.000-00', '(61) 99999-1234')`,
    [clienteId, U.zeca.id]
  )
  await db.query(
    `insert into processos (id, user_id, cliente_id, beneficio, numero, status, esfera) values ($1, $2, $3, 'Auxílio por incapacidade temporária', '10099990020264013400', 'EM_ANALISE', 'JUDICIAL')`,
    [processoId, U.zeca.id, clienteId]
  )

  const hoje = new Date()
  const em10 = new Date(hoje.getTime() + 10 * 86400000)
  // Cai num dia útil: véspera útil fica simples de conferir.
  while (em10.getUTCDay() === 0 || em10.getUTCDay() === 6 || em10.getUTCDay() === 1) em10.setUTCDate(em10.getUTCDate() + 1)
  const dataPericia = em10.toISOString().slice(0, 10)
  const vespera = new Date(em10.getTime() - 86400000).toISOString().slice(0, 10)
  const emPrazo = new Date(hoje.getTime() + 5 * 86400000).toISOString().slice(0, 10)

  // D1: perícia marcada, com processo → tarefa do evento + aviso.
  // D2: só prazo → tarefa do prazo, sem aviso.
  // D3: perícia sem processo cadastrado → aviso sem WhatsApp.
  // D4: perícia cuja tarefa já existe → só o aviso nasce.
  const d = [910000001, 910000002, 910000003, 910000004]
  await db.query(
    `insert into comunicacoes_djen (user_id, djen_id, data_disponibilizacao, texto, numero_processo_mascara, destinatario, processo_id, prazo_estimado, prazo_dias, ia_evento_tipo, ia_evento_data, ia_evento_hora, ia_evento_local, ia_mensagem_cliente, ia_tipo_ato, ia_providencia)
     values
       ($1, $2, current_date, 'perícia designada', '1009999-00.2026.4.01.3400', 'CLIENTE TESTE PERICIA', $6, null, null, 'PERICIA', $7, '14:00', 'Central de Perícias da SJDF', 'Olá! Saiu a data da sua perícia.', 'Intimação para perícia', 'Levar o autor à perícia'),
       ($1, $3, current_date, 'prazo de 15 dias', '1009999-01.2026.4.01.3400', 'OUTRO CLIENTE', null, $8, 15, null, null, null, null, null, 'Despacho de emenda', 'Emendar a inicial'),
       ($1, $4, current_date, 'perícia sem processo', '1009999-02.2026.4.01.3400', 'TERCEIRO CLIENTE', null, null, null, 'PERICIA', $7, null, null, null, 'Intimação para perícia', 'Comparecer à perícia'),
       ($1, $5, current_date, 'perícia com tarefa', '1009999-03.2026.4.01.3400', 'QUARTO CLIENTE', null, null, null, 'AUDIENCIA', $7, '09:30', 'Sala de audiências', 'Olá! Audiência marcada.', 'Audiência', 'Comparecer')`,
    [U.zeca.id, d[0], d[1], d[2], d[3], processoId, dataPericia, emPrazo]
  )
  const jaTinha = await novaTarefa("NOVA D4 já tinha tarefa", "andamentos")
  await db.query(`update comunicacoes_djen set tarefa_id = $1 where djen_id = $2`, [jaTinha.id, d[3]])

  const antes = Number((await q(`select count(*) from tarefas`))[0].count)
  const r1 = await chamar("POST intimações→tarefas", U.zeca, "POST", "/api/intimacoes/tarefas", {})
  confere(r1.status === 200, `DJEN: mutirão devolveu ${r1.status} ${JSON.stringify(r1.corpo).slice(0, 200)}`)
  confere(r1.corpo.criadas === 3 && r1.corpo.avisos === 3, `DJEN: esperava 3 tarefas e 3 avisos (veio ${JSON.stringify(r1.corpo)})`)

  const linhas = await q(`select djen_id, tarefa_id, aviso_tarefa_id from comunicacoes_djen where djen_id = any($1::bigint[]) order by djen_id`, [d])
  confere(linhas.every((l) => l.tarefa_id) && linhas[0].aviso_tarefa_id && !linhas[1].aviso_tarefa_id && linhas[2].aviso_tarefa_id && linhas[3].aviso_tarefa_id,
    `DJEN: vínculos errados ${JSON.stringify(linhas)}`)

  // D1 — a tarefa do evento: vermelho › andamentos, Claude e Zeca, dia e hora da perícia, no calendário de perícias.
  const t1 = (await q(`select * from tarefas where id = $1`, [linhas[0].tarefa_id]))[0]
  confere(t1.setor === "VERMELHO" && t1.pasta === "ANDAMENTOS › PERÍCIA" && String(t1.data).slice(0, 10) === dataPericia && t1.hora === "14:00" && t1.processo_id === processoId,
    `D1: tarefa do evento errada ${JSON.stringify({ setor: t1.setor, pasta: t1.pasta, data: t1.data, hora: t1.hora })}`)
  confere(/Perícia \d\d\/\d\d às 14:00 — Central de Perícias da SJDF/.test(t1.titulo), `D1: título "${t1.titulo}"`)
  let p = await partesAbertas(t1.id)
  confere(p.length === 2 && p.every((x) => x.setor === "VERMELHO" && x.etapa === "andamentos") && p.some((x) => x.responsavel_id === U.claude.id) && p.some((x) => x.responsavel_id === U.zeca.id),
    `D1: evento deveria estar em Vermelho › Andamentos com Claude e Zeca (${JSON.stringify(p)})`)
  const tela = await chamar("GET lista", U.zeca, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")
  const naTela = ((tela.corpo.tarefas ?? []) as TarefaApi[]).find((t) => t.id === t1.id)
  confere(Boolean(naTela?.deIntimacao), "D1: a tarefa do evento deveria ser marcada como vinda da intimação")

  // D1 — o aviso: amarelo › judicial › andamentos, Claude e Zeca, na véspera, com mensagem e WhatsApp.
  const a1 = (await q(`select * from tarefas where id = $1`, [linhas[0].aviso_tarefa_id]))[0]
  confere(a1.setor === "AMARELO" && a1.pasta === "JUDICIAL › ANDAMENTOS" && String(a1.data).slice(0, 10) === vespera && a1.prioridade === "ALTA",
    `D1: aviso errado ${JSON.stringify({ setor: a1.setor, pasta: a1.pasta, data: a1.data, vespera })}`)
  confere(/^Avisar cliente da perícia/.test(a1.titulo) && a1.descricao.includes("WhatsApp (61) 99999-1234") && a1.descricao.includes("Saiu a data da sua perícia") && a1.descricao.includes("desligado"),
    `D1: o aviso deveria trazer WhatsApp, mensagem pronta e a trava (${a1.titulo} / ${String(a1.descricao).slice(0, 120)})`)
  p = await partesAbertas(a1.id)
  confere(p.length === 2 && p.every((x) => x.etapa === "jud-andamentos") && p.some((x) => x.responsavel_id === U.claude.id) && p.some((x) => x.responsavel_id === U.zeca.id),
    `D1: aviso deveria estar em Judicial › Andamentos com Claude e Zeca (${JSON.stringify(p)})`)

  // D2 — só prazo: no fluxo, sem aviso.
  const t2 = (await q(`select * from tarefas where id = $1`, [linhas[1].tarefa_id]))[0]
  p = await partesAbertas(t2.id)
  confere(t2.setor === "VERMELHO" && String(t2.data).slice(0, 10) === emPrazo && p.length === 2 && p.every((x) => x.etapa === "andamentos"),
    `D2: prazo deveria virar tarefa em Vermelho › Andamentos (${JSON.stringify({ data: t2.data, p })})`)

  // D3 — sem processo: aviso avisa que falta o WhatsApp e a mensagem padrão.
  const a3 = (await q(`select * from tarefas where id = $1`, [linhas[2].aviso_tarefa_id]))[0]
  confere(a3.descricao.includes("WhatsApp: não cadastrado") && a3.descricao.includes("Mensagem pronta:"), `D3: ${String(a3.descricao).slice(0, 160)}`)

  // D4 — tarefa já existia: só o aviso nasceu, e a tarefa antiga continua.
  confere(linhas[3].tarefa_id === jaTinha.id, "D4: a tarefa que já existia deveria ser mantida")
  const a4 = (await q(`select titulo from tarefas where id = $1`, [linhas[3].aviso_tarefa_id]))[0]
  confere(/^Avisar cliente da audiência/.test(a4.titulo), `D4: ${a4.titulo}`)

  // Rodar de novo não duplica nada.
  const r2 = await chamar("POST intimações→tarefas", U.zeca, "POST", "/api/intimacoes/tarefas", {})
  const depois = Number((await q(`select count(*) from tarefas`))[0].count)
  confere(r2.corpo.criadas === 0 && r2.corpo.avisos === 0 && depois === antes + 6, `DJEN: segunda rodada duplicou (${JSON.stringify(r2.corpo)}, ${antes} → ${depois})`)
  // Várias rodadas ao mesmo tempo também não.
  await db.query(`update comunicacoes_djen set tarefa_id = null, aviso_tarefa_id = null where djen_id = $1`, [d[0]])
  await db.query(`delete from tarefas where id in ($1, $2)`, [linhas[0].tarefa_id, linhas[0].aviso_tarefa_id])
  const corrida = await Promise.all([1, 2, 3, 4].map(() => chamar("POST intimações→tarefas (corrida)", U.zeca, "POST", "/api/intimacoes/tarefas", {})))
  const criadasNaCorrida = corrida.reduce((s, x) => s + Number(x.corpo.criadas ?? 0) + Number(x.corpo.avisos ?? 0), 0)
  const porOrigem = await q(`select origem_id, count(*) from tarefas where origem_id like 'djen:%' group by origem_id having count(*) > 1`)
  confere(porOrigem.length === 0 && criadasNaCorrida === 2, `DJEN: corrida de 4 rotinas criou ${criadasNaCorrida} (esperado 2) / duplicadas ${JSON.stringify(porOrigem)}`)

  // A trava do envio: nasce desligada; só o admin liga; fica registrado.
  const g = await chamar("GET configurações", U.tay, "GET", "/api/configuracoes")
  const cfg = ((g.corpo.configuracoes ?? []) as { chave: string; valor: unknown; padrao: boolean }[]).find((c) => c.chave === "aviso_cliente_whatsapp")
  confere(g.status === 200 && cfg?.valor === false && cfg?.padrao === false, `trava: deveria nascer gravada como false (${JSON.stringify(cfg)})`)
  const naoAdmin = await chamar("PATCH configurações", U.tay, "PATCH", "/api/configuracoes", { chave: "aviso_cliente_whatsapp", valor: true })
  confere(naoAdmin.status === 403, `trava: a Tay não pode ligar o envio (${naoAdmin.status})`)
  const liga = await chamar("PATCH configurações", U.zeca, "PATCH", "/api/configuracoes", { chave: "aviso_cliente_whatsapp", valor: true })
  const ligada = ((liga.corpo.configuracoes ?? []) as { chave: string; valor: unknown; atualizadaPor: { name: string } | null }[]).find((c) => c.chave === "aviso_cliente_whatsapp")
  confere(liga.status === 200 && ligada?.valor === true && ligada.atualizadaPor?.name === U.zeca.name, `trava: o Zeca deveria conseguir ligar (${JSON.stringify(ligada)})`)
  const aud = await q(`select count(*) from auditorias where acao = 'CONFIGURACAO_ALTERADA'`)
  confere(Number(aud[0].count) >= 1, "trava: a mudança deveria ir para a auditoria")
  const desliga = await chamar("PATCH configurações", U.zeca, "PATCH", "/api/configuracoes", { chave: "aviso_cliente_whatsapp", valor: false })
  confere(desliga.status === 200 && (await q(`select valor from configuracoes where chave = 'aviso_cliente_whatsapp'`))[0].valor === false, "trava: deveria voltar a false")
  const invalida = await chamar("PATCH configurações", U.zeca, "PATCH", "/api/configuracoes", { chave: "qualquer_coisa", valor: true })
  confere(invalida.status === 400, `trava: chave desconhecida deveria dar 400 (${invalida.status})`)
}

// ── Carga aleatória ───────────────────────────────────────

async function carga() {
  const estado = new Map<string, TarefaApi>()
  for (const t of await listaDaTela()) estado.set(t.id, t)
  const ids = [...estado.keys()]
  let feitas = 0

  const operacao = async () => {
    const id = sortear(ids)
    const t = estado.get(id)
    const quem = sortear(EQUIPE)
    if (!t) return
    const grupos = gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] }))
    const g = grupos.length ? sortear(grupos) : null
    const x = acaso()
    let r: Resposta | null = null

    if (x < 0.32 && g) {
      const destino = sortear(TODAS_ETAPAS)
      const resps = acaso() < 0.5 ? undefined : acaso() < 0.5 ? null : amostra(EQUIPE, 1 + Math.floor(acaso() * 3)).map((p) => p.id)
      r = await acao(quem, id, { acao: "mover", de: { setor: g.setor, etapa: g.etapa }, para: lugarDe(destino), ...(resps === undefined ? {} : { responsaveis: resps }) })
    } else if (x < 0.42) {
      r = await acao(quem, id, { acao: "adicionar", para: lugarDe(sortear(TODAS_ETAPAS)), responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) })
    } else if (x < 0.62 && g) {
      const parte = sortear(g.abertas)
      r = await acao(quem, id, { acao: "concluirParte", em: { setor: g.setor, etapa: g.etapa }, responsavelId: parte.responsavelId })
    } else if (x < 0.72 && g) {
      r = await acao(quem, id, { acao: "responsaveis", em: { setor: g.setor, etapa: g.etapa }, responsaveis: amostra(EQUIPE, Math.floor(acaso() * 4)).map((p) => p.id) })
    } else if (x < 0.76 && g) {
      r = await acao(quem, id, { acao: "concluirEtapa", em: { setor: g.setor, etapa: g.etapa } })
    } else if (x < 0.81) {
      r = await acao(quem, id, { acao: "concluirMinhaParte" })
    } else if (x < 0.91) {
      const y = acaso()
      const campos =
        y < 0.3 ? { status: acaso() < 0.5 ? "CONCLUIDA" : "PENDENTE" } : y < 0.65 ? { setor: sortear(TIMES_TAREFA) } : { responsavelId: acaso() < 0.2 ? null : sortear(EQUIPE).id }
      r = await chamar("PATCH por fora", quem, "PATCH", `/api/tarefas/${id}`, campos)
      // O PATCH não devolve as partes: a próxima ação nesta tarefa usa o estado velho, como na vida real.
    } else {
      const etapa = sortear(TODAS_ETAPAS)
      const n = await chamar("POST criar", quem, "POST", "/api/tarefas", {
        titulo: `NOVA carga ${feitas}`,
        data: new Date().toISOString().slice(0, 10),
        etapa,
        ...(acaso() < 0.5 ? { responsaveis: amostra(EQUIPE, 1 + Math.floor(acaso() * 2)).map((p) => p.id) } : {}),
      })
      const nova = n.corpo.tarefa as TarefaApi | undefined
      if (nova?.id) {
        estado.set(nova.id, nova)
        ids.push(nova.id)
      }
    }

    if (r?.status === 200 && r.corpo.tarefa) {
      const nova = r.corpo.tarefa as TarefaApi
      if (nova.status === "CONCLUIDA" || nova.status === "CANCELADA") estado.set(id, { ...nova, atribuicoes: [] })
      else estado.set(id, nova)
    }
    feitas++
  }

  const ini = performance.now()
  let proxima = 0
  await Promise.all(
    Array.from({ length: SIMULTANEAS }, async () => {
      while (proxima < N_OPERACOES) {
        proxima++
        await operacao()
      }
    })
  )
  return { feitas, segundos: (performance.now() - ini) / 1000 }
}

// ── Rodada ────────────────────────────────────────────────

async function main() {
  console.log(`Teste em escala do fluxo — ${N_TAREFAS} tarefas, ${N_OPERACOES} operações, ${SIMULTANEAS} ao mesmo tempo`)

  let t0 = performance.now()
  await semear(N_TAREFAS)
  console.log(`• banco semeado em ${((performance.now() - t0) / 1000).toFixed(1)}s`)

  // Antes de qualquer gravação, a tela já põe tudo no lugar pela pasta.
  const antes = await listaDaTela()
  const abertasBanco = Number((await db.query(`select count(*) from tarefas where origem_id like 'teste-escala:%' and status not in ('CONCLUIDA','CANCELADA')`)).rows[0].count)
  confere(antes.length === abertasBanco, `a lista deveria trazer as ${abertasBanco} tarefas abertas (trouxe ${antes.length})`)
  const amarelasPelaPasta = antes.filter((t) => t.pasta === "JUDICIAL › PROTOCOLO NOVO").every((t) =>
    gruposDa(atribuicoesDa({ ...t, atribuicoes: t.atribuicoes ?? [] })).every((g) => g.setor === "AMARELO" && g.etapa === "jud-protocolo")
  )
  confere(amarelasPelaPasta, "JUDICIAL › PROTOCOLO NOVO deveria aparecer em Amarelo › Judicial › Protocolo antes de gravar")

  console.log("• cenários do Zeca")
  await cenarios()
  await invariantes("cenários")

  console.log("• motor do DJEN (perícia → evento + aviso) e a trava do envio")
  await djenEAviso()
  await invariantes("DJEN")

  console.log("• trazer tudo para o fluxo (três administradores ao mesmo tempo)")
  const pend = await chamar("GET pendentes", U.zeca, "GET", "/api/tarefas/fluxo")
  t0 = performance.now()
  const sync = await Promise.all([1, 2, 3].map(() => chamar("POST trazer", U.zeca, "POST", "/api/tarefas/fluxo")))
  console.log(`  ${pend.corpo.semFluxo} pendentes; gravadas ${sync.map((s) => s.corpo.linhas).join(" + ")} linhas em ${((performance.now() - t0) / 1000).toFixed(1)}s`)
  const naoAdmin = await chamar("POST trazer (não admin)", U.tay, "POST", "/api/tarefas/fluxo")
  confere(naoAdmin.status === 403, `só o administrador pode trazer em lote (veio ${naoAdmin.status})`)
  const depois = await chamar("GET pendentes", U.zeca, "GET", "/api/tarefas/fluxo")
  confere(depois.corpo.semFluxo === 0, `depois de trazer, nada deveria faltar (faltam ${depois.corpo.semFluxo})`)
  const semLinha = (await db.query(`select count(*) from tarefas t where origem_id like 'teste-escala:%' and status = 'PENDENTE' and setor in ('VERMELHO','AZUL','AMARELO','ROSA') and not exists (select 1 from tarefa_atribuicoes a where a.tarefa_id = t.id)`)).rows[0].count
  confere(Number(semLinha) === 0, `${semLinha} tarefas abertas de time ficaram fora do fluxo`)
  const movidasPelaPasta = (await db.query(`select count(*) from tarefas t where origem_id like 'teste-escala:%' and pasta = 'JUDICIAL › PROTOCOLO NOVO' and status = 'PENDENTE' and setor <> 'AMARELO'`)).rows[0].count
  confere(Number(movidasPelaPasta) === 0, `${movidasPelaPasta} tarefas do JUDICIAL › PROTOCOLO NOVO continuam fora do amarelo depois de entrar no fluxo`)
  await invariantes("entrada no fluxo")

  console.log(`• carga: ${N_OPERACOES} operações aleatórias, ${SIMULTANEAS} ao mesmo tempo`)
  const c = await carga()
  console.log(`  ${c.feitas} operações em ${c.segundos.toFixed(1)}s (${(c.feitas / c.segundos).toFixed(0)}/s)`)
  const inv = await invariantes("depois da carga")

  const leituras: number[] = []
  for (let i = 0; i < 5; i++) leituras.push((await chamar("GET lista (medida)", U.zeca, "GET", "/api/tarefas?abertas=1&vinculos=1&atribuicoes=1")).ms)

  const linhas = (await db.query(`select count(*) filter (where fim_em is null) as abertas, count(*) as total from tarefa_atribuicoes`)).rows[0]
  console.log("\n── Resultado ──")
  console.log(`partes no banco: ${linhas.total} (${linhas.abertas} abertas, ${inv.gruposAbertos} cartões abertos)`)
  console.log(`leitura da tela: mediana ${percentil(leituras, 50).toFixed(0)} ms, pior ${Math.max(...leituras).toFixed(0)} ms`)
  for (const [op, st] of Object.entries(statusPorOp)) {
    const ms = tempos[op] ?? []
    console.log(`  ${op.padEnd(26)} ${JSON.stringify(st).padEnd(34)} p50 ${percentil(ms, 50).toFixed(0)}ms  p95 ${percentil(ms, 95).toFixed(0)}ms`)
  }
  console.log(`verificações: ${verificacoes}, falhas: ${falhas.length}, erros 5xx: ${erros5xx.length}`)
  for (const f of falhas.slice(0, 30)) console.log("  ✗ " + f)
  for (const e of erros5xx.slice(0, 10)) console.log("  5xx " + e)
  await db.end()
  process.exit(falhas.length || erros5xx.length ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await db.end()
  process.exit(1)
})
