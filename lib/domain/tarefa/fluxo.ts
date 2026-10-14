// ─────────────────────────────────────────────────────────
// Domínio: o fluxo do escritório, time por time
//
// Desenhado pelo Zeca no Lucid (13/10/2026, revisto em 14/10/2026). Cada
// time é uma cor e tem as suas etapas, na ordem em que o caso anda:
//
//   AZUL      Análise → Agendar vídeo → Aguardando assinatura
//             e, à parte, Acompanhamento (Tayane faz a triagem)
//   VERMELHO  Vídeos · Revisão da análise · Andamentos · Questões de
//             clientes (Zeca; o Claude ao lado nos andamentos e nas
//             questões)
//   AMARELO   Administrativo (Guilherme) e Judicial (Zeca por ora;
//             depois a Camille), cada um com
//             Pendente → Protocolo → Prioridade e, à parte, Andamentos
//             (as exigências do processo já protocolado)
//   ROSA      Agendar entrega → Entrega marcada (Zeca e Ryan: o cliente
//             ganhou benefício permanente e o escritório entrega em mãos)
//
// O Claude não é um time: é o "preto" do desenho, que atravessa todos —
// controle de prazos, fluxos, análises, atendimento e automações. Por
// isso ele aparece como responsável em quase toda etapa, ao lado de quem
// é daquele time.
//
// Quem responde por cada etapa vale pela cor do time e pela própria
// tarefa (o responsável está no cartão): as telas não escrevem nomes
// no alto das colunas do kanban.
//
// Onde a tarefa está mora em `tarefa_atribuicoes` (time, etapa e
// responsável — ver atribuicao.ts). Tarefa que ainda não entrou no
// fluxo é posta numa etapa pela lista do TickTick de onde veio
// ("JUDICIAL › PROTOCOLO NOVO", "TAY › TAREFAS DE ACOMPANHAMENTO"),
// pelas regras abaixo. O que nenhuma regra reconhece fica em "sem
// etapa" no time — nada some da tela por não ter etapa.
// ─────────────────────────────────────────────────────────

import type { TimeTarefa } from "./time"

export type EsferaAmarelo = "ADMINISTRATIVO" | "JUDICIAL"

export type EtapaId =
  | "analise"
  | "agendar-video"
  | "aguardando-assinatura"
  | "acompanhamento"
  | "videos"
  | "revisao-analise"
  | "andamentos"
  | "questoes-clientes"
  | "adm-pendente"
  | "adm-protocolo"
  | "adm-prioridade"
  | "adm-andamentos"
  | "jud-pendente"
  | "jud-protocolo"
  | "jud-prioridade"
  | "jud-andamentos"
  | "agendar-entrega"
  | "entrega-marcada"

/** Um próximo passo do fluxo, como ele está desenhado. */
export type Saida = {
  /** O que aconteceu para a tarefa sair daqui ("Caso bom"). */
  quando: string
  para: EtapaId
  /**
   * Aparece só no menu do cartão: concluir a etapa não pergunta por ela.
   * Para a saída rara de uma etapa que quase sempre só fecha (a maioria
   * dos andamentos se encerra ali; uns poucos viram entrega no rosa).
   */
  soNoMenu?: boolean
}

export type Etapa = {
  id: EtapaId
  time: TimeTarefa
  /** Só no amarelo: em que lado a etapa fica. */
  esfera?: EsferaAmarelo
  nome: string
  /** O pedaço do endereço: /times/azul/agendar-video. */
  slug: string
  /** O que a tarefa grava em `pasta` quando entra aqui pelo sistema. */
  pasta: string
  /** Quem cuida, como está no desenho. Texto — não é usuário do sistema. */
  responsaveis: string
  /** O que o cartão desta etapa precisa trazer, além do nome. */
  campo?: string
  /** O que acontece aqui, nas palavras do fluxo. Um item por passo. */
  regras: string[]
  saidas: Saida[]
  /**
   * Os responsáveis são alternativas, não partes: basta um concluir e a
   * etapa acaba para todos. É o caso da entrega — Zeca ou Ryan vai até o
   * cliente, não os dois. Sem isto, vale a regra geral: cada um conclui
   * a sua parte e a tarefa continua para os outros.
   */
  bastaUm?: boolean
}

export const ESFERA_AMARELO_LABEL: Record<EsferaAmarelo, string> = {
  ADMINISTRATIVO: "Administrativo",
  JUDICIAL: "Judicial",
}

export const SLUG_ESFERA: Record<EsferaAmarelo, string> = {
  ADMINISTRATIVO: "administrativo",
  JUDICIAL: "judicial",
}

export const ETAPAS: Record<EtapaId, Etapa> = {
  // ── Azul ───────────────────────────────────────────────
  analise: {
    id: "analise",
    time: "AZUL",
    nome: "Análise",
    slug: "analise",
    pasta: "ANÁLISE",
    responsaveis: "Claude",
    regras: [
      "O Claude analisa o caso com base nos documentos do Drive. São dois resultados.",
      "Caso bom: o próprio Claude passa a tarefa para Agendar vídeo e manda mensagem ao cliente dizendo que já podemos fazer a videochamada.",
      "Caso ruim: o Claude passa a tarefa para o vermelho, em Revisão da análise, com o Zeca como responsável — ele decide o que fazer.",
    ],
    saidas: [
      { quando: "Caso bom", para: "agendar-video" },
      { quando: "Caso ruim", para: "revisao-analise" },
    ],
  },
  "agendar-video": {
    id: "agendar-video",
    time: "AZUL",
    nome: "Agendar vídeo",
    slug: "agendar-video",
    pasta: "AGENDAR VÍDEO",
    responsaveis: "Claude e Tayane",
    campo: "Caso (ex.: BPC deficiente)",
    regras: [
      "Mandada a mensagem, a Tayane fica responsável pela tarefa até confirmar data e hora com o cliente.",
      "Confirmadas data e hora, o Claude volta a ser o responsável e agenda mensagem ao cliente às 8h do dia da chamada, pedindo nova confirmação.",
      "Depois disso a tarefa vai para o vermelho, em Vídeos.",
    ],
    saidas: [{ quando: "Data confirmada", para: "videos" }],
  },
  "aguardando-assinatura": {
    id: "aguardando-assinatura",
    time: "AZUL",
    nome: "Aguardando assinatura",
    slug: "aguardando-assinatura",
    pasta: "AGUARDANDO ASSINATURA",
    responsaveis: "Claude e Tayane",
    campo: "Tese (ex.: BPC deficiente · judicial · pendente ou protocolo)",
    regras: [
      "Depois da videochamada o Zeca envia o contrato e manda a tarefa para cá.",
      "O Claude acompanha se o contrato foi assinado.",
      "Assinado, o Claude manda para o amarelo — Administrativo ou Judicial, conforme a tese e o caso.",
    ],
    saidas: [
      { quando: "Assinado", para: "adm-pendente" },
      { quando: "Assinado", para: "adm-protocolo" },
      { quando: "Assinado", para: "jud-pendente" },
      { quando: "Assinado", para: "jud-protocolo" },
    ],
  },
  acompanhamento: {
    id: "acompanhamento",
    time: "AZUL",
    nome: "Acompanhamento",
    slug: "acompanhamento",
    pasta: "ACOMPANHAMENTO",
    responsaveis: "Claude e Tayane",
    campo: "Pendência antes da análise (ex.: enviar contribuição, laudo)",
    regras: [
      "Caso com boa chance de processo, mas com uma pendência importante — o Zeca decide isso na videochamada ou na revisão e manda para cá.",
      "O Claude e a Tayane acompanham a pendência e, quando ela se resolver, seguem para o contrato.",
    ],
    saidas: [{ quando: "Pendência resolvida", para: "aguardando-assinatura" }],
  },

  // ── Vermelho ───────────────────────────────────────────
  videos: {
    id: "videos",
    time: "VERMELHO",
    nome: "Vídeos",
    slug: "videos",
    pasta: "VÍDEOS",
    responsaveis: "Zeca",
    regras: [
      "O Zeca faz a videochamada.",
      "Fechou: envia o contrato ao cliente com a tese do processo escrita nesta tarefa e manda para o azul, em Aguardando assinatura, com o Claude como responsável.",
      "Ficou pendência: devolve para o azul, em Acompanhamento, para o Claude e a Tayane acompanharem e fazerem o contrato mais adiante.",
    ],
    saidas: [
      { quando: "Contrato enviado", para: "aguardando-assinatura" },
      { quando: "Ficou pendência", para: "acompanhamento" },
    ],
  },
  "revisao-analise": {
    id: "revisao-analise",
    time: "VERMELHO",
    nome: "Revisão da análise",
    slug: "revisao-analise",
    pasta: "REVISÃO DA ANÁLISE",
    responsaveis: "Zeca",
    regras: [
      "Não tem processo: o Zeca manda o caso para o banco de dados, com a explicação para o cliente — é só concluir a tarefa.",
      "Tem possibilidade: vai para o azul, em Agendar vídeo.",
      "Tem possibilidade, mas com pendência importante: vai para o azul, em Acompanhamento, para a Tayane e o Claude.",
    ],
    saidas: [
      { quando: "Tem possibilidade", para: "agendar-video" },
      { quando: "Com pendência", para: "acompanhamento" },
    ],
  },
  andamentos: {
    id: "andamentos",
    time: "VERMELHO",
    nome: "Andamentos",
    slug: "andamentos",
    pasta: "ANDAMENTOS",
    responsaveis: "Claude e Zeca",
    campo: "Andamento e caso",
    regras: [
      "Andamentos dos processos judiciais que pedem decisão ou ato do Zeca: intimação com prazo, perícia, sentença, acordo, recurso.",
      "Se o andamento é só uma exigência do processo (juntar documento, emendar, cumprir determinação), ele é do amarelo, em Judicial › Andamentos.",
      "Saiu benefício permanente para o cliente: a tarefa vai para o rosa, em Agendar entrega.",
    ],
    saidas: [
      { quando: "É exigência processual", para: "jud-andamentos", soNoMenu: true },
      { quando: "Benefício permanente concedido", para: "agendar-entrega", soNoMenu: true },
    ],
  },
  "questoes-clientes": {
    id: "questoes-clientes",
    time: "VERMELHO",
    nome: "Questões de clientes",
    slug: "questoes-clientes",
    pasta: "QUESTÕES DE CLIENTES",
    responsaveis: "Claude e Zeca",
    campo: "Dúvida e caso",
    regras: [
      "Pergunta de um cliente sobre o próprio caso — andamento, pagamento, documento, prazo — que o atendimento não soube responder na hora.",
      "O Claude responde o que já está nos documentos e nos andamentos; o que depende de decisão ou de parecer fica com o Zeca.",
      "Respondido ao cliente, a tarefa é concluída. A resposta vai para o banco de dados de dúvidas, para a próxima vez.",
      "A dúvida mostrou uma pendência do caso (laudo, contribuição): manda para o azul, em Acompanhamento.",
    ],
    saidas: [{ quando: "Virou pendência do caso", para: "acompanhamento", soNoMenu: true }],
  },

  // ── Amarelo · Administrativo ───────────────────────────
  "adm-pendente": {
    id: "adm-pendente",
    time: "AMARELO",
    esfera: "ADMINISTRATIVO",
    nome: "Pendente",
    slug: "pendente",
    pasta: "ADM › PENDENTE",
    responsaveis: "Claude e Guilherme",
    campo: "Pendência",
    regras: [
      "Contrato assinado, mas falta alguma coisa do cliente antes de protocolar.",
      "Resolvida a pendência, a tarefa sobe para Protocolo.",
    ],
    saidas: [{ quando: "Pendência resolvida", para: "adm-protocolo" }],
  },
  "adm-protocolo": {
    id: "adm-protocolo",
    time: "AMARELO",
    esfera: "ADMINISTRATIVO",
    nome: "Protocolo",
    slug: "protocolo",
    pasta: "ADM › PROTOCOLO",
    responsaveis: "Claude e Guilherme",
    regras: ["Requerimento pronto para protocolar no INSS."],
    saidas: [{ quando: "É prioridade", para: "adm-prioridade" }],
  },
  "adm-prioridade": {
    id: "adm-prioridade",
    time: "AMARELO",
    esfera: "ADMINISTRATIVO",
    nome: "Prioridade",
    slug: "prioridade",
    pasta: "ADM › PRIORIDADE",
    responsaveis: "Claude e Zeca",
    regras: ["Protocolos administrativos que passam na frente dos outros."],
    saidas: [],
  },
  "adm-andamentos": {
    id: "adm-andamentos",
    time: "AMARELO",
    esfera: "ADMINISTRATIVO",
    nome: "Andamentos",
    slug: "andamentos",
    pasta: "ADM › ANDAMENTOS",
    responsaveis: "Claude e Guilherme",
    campo: "Andamento de exigência processual e caso (ex.: maternidade, BPC)",
    regras: [
      "Requerimento já protocolado no INSS que pediu alguma coisa: exigência, documento, perícia a agendar, recurso de prazo.",
      "Prorrogação de auxílio-doença entra aqui também, com a data em que o pedido pode ser feito.",
      "Salário-maternidade sempre tem uma tarefa aqui: enviar ao cliente a contribuição que o INSS pede.",
      "Cumprida a exigência, a tarefa é concluída. Indeferido e o caso vai à Justiça: manda para Judicial › Protocolo.",
      "Saiu benefício definitivo (aposentadoria, BPC): a tarefa vai para o rosa, em Agendar entrega.",
    ],
    saidas: [
      { quando: "Indeferido, vai à Justiça", para: "jud-protocolo", soNoMenu: true },
      { quando: "Benefício definitivo concedido", para: "agendar-entrega", soNoMenu: true },
    ],
  },

  // ── Amarelo · Judicial ─────────────────────────────────
  // Responsáveis: o Claude e o Zeca, por ora. Quando a Camille entrar
  // no escritório, o Zeca sai daqui e ela entra — é trocar o texto de
  // `responsaveis` destas quatro etapas (e dar conta a ela no sistema).
  "jud-pendente": {
    id: "jud-pendente",
    time: "AMARELO",
    esfera: "JUDICIAL",
    nome: "Pendente",
    slug: "pendente",
    pasta: "JUDICIAL › PENDENTE",
    responsaveis: "Claude e Zeca",
    campo: "Pendência",
    regras: [
      "Contrato assinado, mas falta alguma coisa do cliente antes de distribuir a ação.",
      "Resolvida a pendência, a tarefa sobe para Protocolo.",
    ],
    saidas: [{ quando: "Pendência resolvida", para: "jud-protocolo" }],
  },
  "jud-protocolo": {
    id: "jud-protocolo",
    time: "AMARELO",
    esfera: "JUDICIAL",
    nome: "Protocolo",
    slug: "protocolo",
    pasta: "JUDICIAL › PROTOCOLO",
    responsaveis: "Claude e Zeca",
    regras: ["Petição pronta para protocolar."],
    saidas: [{ quando: "É prioridade", para: "jud-prioridade" }],
  },
  "jud-prioridade": {
    id: "jud-prioridade",
    time: "AMARELO",
    esfera: "JUDICIAL",
    nome: "Prioridade",
    slug: "prioridade",
    pasta: "JUDICIAL › PRIORIDADE",
    responsaveis: "Claude e Zeca",
    regras: ["Protocolos judiciais que passam na frente dos outros."],
    saidas: [],
  },
  "jud-andamentos": {
    id: "jud-andamentos",
    time: "AMARELO",
    esfera: "JUDICIAL",
    nome: "Andamentos",
    slug: "andamentos",
    pasta: "JUDICIAL › ANDAMENTOS",
    responsaveis: "Claude e Zeca",
    campo: "Andamento de exigência processual, caso e link do tribunal",
    regras: [
      "Ação já distribuída que pediu alguma coisa do escritório: emenda à inicial, juntada de documento, cumprimento de determinação, manifestação simples.",
      "O cartão traz o link do processo no tribunal, para abrir direto de onde a exigência veio.",
      "O andamento pede decisão do Zeca (prazo de recurso, perícia, sentença, acordo): é do vermelho, em Andamentos.",
      "Cumprida a exigência, a tarefa é concluída. Saiu benefício permanente: vai para o rosa, em Agendar entrega.",
    ],
    saidas: [
      { quando: "Precisa do Zeca", para: "andamentos", soNoMenu: true },
      { quando: "Benefício permanente concedido", para: "agendar-entrega", soNoMenu: true },
    ],
  },

  // ── Rosa · Entregas ────────────────────────────────────
  // Definido pelo Zeca em 14/10/2026: o rosa cuida das entregas. Cliente
  // que ganhou benefício permanente vem para cá, e alguém do escritório
  // vai pessoalmente visitá-lo e entregar o benefício. Responsáveis: o
  // Zeca (que também é do vermelho) e o Ryan (que cuida das concessões).
  // Um ou outro entrega — por isso `bastaUm`.
  "agendar-entrega": {
    id: "agendar-entrega",
    time: "ROSA",
    nome: "Agendar entrega",
    slug: "agendar-entrega",
    pasta: "AGENDAR ENTREGA",
    responsaveis: "Zeca e Ryan",
    bastaUm: true,
    campo: "Benefício concedido (ex.: aposentadoria por idade)",
    regras: [
      "O cliente ganhou benefício permanente — aposentadoria ou BPC, por exemplo. Benefício temporário, como o auxílio-doença, não vem para cá.",
      "A tarefa aparece para o Zeca e para o Ryan. Quem for entregar combina com o cliente o dia, a hora e o endereço da visita.",
      "Marcada a visita, a tarefa passa para Entrega marcada, com a data na tarefa. Se só um vai, deixe só ele em \"Responsáveis desta etapa\".",
    ],
    saidas: [{ quando: "Visita marcada", para: "entrega-marcada" }],
  },
  "entrega-marcada": {
    id: "entrega-marcada",
    time: "ROSA",
    nome: "Entrega marcada",
    slug: "entrega-marcada",
    pasta: "ENTREGA MARCADA",
    responsaveis: "Zeca e Ryan",
    bastaUm: true,
    campo: "Data, hora e endereço da visita",
    regras: [
      "Visita com dia e hora combinados com o cliente.",
      "Quem foi entrega o benefício e conclui a tarefa: entregue, ela fecha para os dois.",
      "O cliente desmarcou: mover de volta para Agendar entrega.",
    ],
    // Concluir aqui é "entregue": fecha a tarefa, sem a pergunta "para
    // onde vai?". A volta, se o cliente desmarcar, fica só no menu.
    saidas: [{ quando: "Cliente desmarcou", para: "agendar-entrega", soNoMenu: true }],
  },
}

/** As etapas de cada time, na ordem do desenho. */
export const ETAPAS_DO_TIME: Record<TimeTarefa, EtapaId[]> = {
  VERMELHO: ["videos", "revisao-analise", "andamentos", "questoes-clientes"],
  AZUL: ["analise", "agendar-video", "aguardando-assinatura", "acompanhamento"],
  AMARELO: [
    "adm-pendente",
    "adm-protocolo",
    "adm-prioridade",
    "adm-andamentos",
    "jud-pendente",
    "jud-protocolo",
    "jud-prioridade",
    "jud-andamentos",
  ],
  ROSA: ["agendar-entrega", "entrega-marcada"],
}

/** Nesta etapa basta um responsável concluir para ela acabar para todos? */
export function etapaBastaUm(id?: string | null): boolean {
  return Boolean(id && (ETAPAS as Record<string, Etapa | undefined>)[id]?.bastaUm)
}

export const ESFERAS_AMARELO: EsferaAmarelo[] = ["ADMINISTRATIVO", "JUDICIAL"]

export function etapasDaEsfera(esfera: EsferaAmarelo): EtapaId[] {
  return ETAPAS_DO_TIME.AMARELO.filter((id) => ETAPAS[id].esfera === esfera)
}

// ── Endereços ─────────────────────────────────────────────

export const SLUG_DO_TIME: Record<TimeTarefa, string> = {
  VERMELHO: "vermelho",
  AZUL: "azul",
  AMARELO: "amarelo",
  ROSA: "rosa",
}

export function timePorSlug(slug?: string | null): TimeTarefa | null {
  const achado = (Object.entries(SLUG_DO_TIME) as [TimeTarefa, string][]).find(([, s]) => s === slug)
  return achado ? achado[0] : null
}

export function esferaPorSlugAmarelo(slug?: string | null): EsferaAmarelo | null {
  if (slug === "administrativo") return "ADMINISTRATIVO"
  if (slug === "judicial") return "JUDICIAL"
  return null
}

/** /times/azul/agendar-video · /times/amarelo/judicial/protocolo */
export function enderecoDaEtapa(id: EtapaId): string {
  const e = ETAPAS[id]
  const time = SLUG_DO_TIME[e.time]
  return e.esfera ? `/times/${time}/${SLUG_ESFERA[e.esfera]}/${e.slug}` : `/times/${time}/${e.slug}`
}

export function enderecoDoTime(time: TimeTarefa): string {
  return `/times/${SLUG_DO_TIME[time]}`
}

/** A etapa de um time pelo pedaço do endereço (e a esfera, no amarelo). */
export function etapaPorSlug(
  time: TimeTarefa,
  slug: string,
  esfera?: EsferaAmarelo | null
): EtapaId | null {
  const id = ETAPAS_DO_TIME[time].find(
    (i) => ETAPAS[i].slug === slug && (ETAPAS[i].esfera ?? null) === (esfera ?? null)
  )
  return id ?? null
}

// ── Em que etapa a tarefa está ────────────────────────────

/** Sem acento, em caixa alta, sem emoji e sem pontuação solta. */
function normalizar(texto?: string | null) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** "JUDICIAL › …" → JUDICIAL; "ADM › …", "INSS …" → ADMINISTRATIVO. */
function esferaDe(pasta: string): EsferaAmarelo | null {
  if (/\bJUDICIA(L|IS)\b/.test(pasta)) return "JUDICIAL"
  if (/\bADM\b/.test(pasta) || /\bADMINISTRATIV/.test(pasta) || /\bINSS\b/.test(pasta)) return "ADMINISTRATIVO"
  return null
}

/** Etapa do amarelo pela pasta, sem olhar o time. A ordem importa:
 *  "PROTOCOLOS PENDENTES" é pendência antes de ser protocolo. */
type EtapaAmarela = "pendente" | "protocolo" | "prioridade" | "andamentos"

function etapaAmarelaDe(pasta: string): EtapaAmarela | null {
  if (/\bPENDEN/.test(pasta) || /\bFALTA DOC/.test(pasta) || /\bDEVOLVID/.test(pasta)) return "pendente"
  if (/\bPRIORI/.test(pasta)) return "prioridade"
  if (/\bPROTOCOL/.test(pasta) || /\bTRIAGEM\b/.test(pasta)) return "protocolo"
  if (/\bANDAMENTOS?\b/.test(pasta) || /\bEXIGENCIAS?\b/.test(pasta) || /\bPRORROGAC/.test(pasta)) return "andamentos"
  return null
}

function idAmarelo(esfera: EsferaAmarelo, etapa: EtapaAmarela): EtapaId {
  return `${esfera === "JUDICIAL" ? "jud" : "adm"}-${etapa}` as EtapaId
}

export type TarefaNoFluxo = {
  setor?: string | null
  pasta?: string | null
  titulo?: string | null
  tipo?: string | null
  /** A tarefa nasceu de uma intimação do DJEN. */
  deIntimacao?: boolean | null
}

/**
 * Em que etapa do próprio time a tarefa está — ou `null`, quando a
 * pasta não diz (ela aparece em "outras do time").
 */
export function etapaDaTarefa(t: TarefaNoFluxo): EtapaId | null {
  if (t.tipo === "DUVIDA") return null
  const p = normalizar(t.pasta)

  // Intimação do DJEN aberta no vermelho, sem pasta, é andamento.
  if (!p) return t.setor === "VERMELHO" && t.deIntimacao ? "andamentos" : null

  switch (t.setor) {
    case "AZUL":
      if (/\bASSINA/.test(p)) return "aguardando-assinatura"
      if (/\bAGEND/.test(p)) return "agendar-video"
      if (/\bACOMPANHAMENTO\b/.test(p)) return "acompanhamento"
      if (/\bANALISES?\b/.test(p) && !/\bREVIS/.test(p)) return "analise"
      return null

    case "VERMELHO":
      // Aguardando assinatura mora na lista de vídeos do TickTick, mas é
      // do azul: fica em "outras" até alguém mover (ver destinoNoFluxo).
      if (/\bASSINA/.test(p)) return null
      if (/\bREVIS/.test(p)) return "revisao-analise"
      if (/\bVIDEOS?\b/.test(p) || /\bVIDEOCHAMADAS?\b/.test(p)) return "videos"
      if (/\bQUESTO/.test(p) || /\bDUVIDAS?\b/.test(p)) return "questoes-clientes"
      if (/\bANDAMENTOS?\b/.test(p) || /\bINTIMAC/.test(p)) return "andamentos"
      return t.deIntimacao ? "andamentos" : null

    case "AMARELO": {
      const esfera = esferaDe(p)
      const etapa = etapaAmarelaDe(p)
      return esfera && etapa ? idAmarelo(esfera, etapa) : null
    }

    case "ROSA":
      if (/\bENTREGAS?\b/.test(p) && /\b(MARCAD|AGENDAD|CONFIRMAD)/.test(p)) return "entrega-marcada"
      if (/\bENTREG/.test(p)) return "agendar-entrega"
      return null

    default:
      return null
  }
}

/**
 * Para onde o fluxo novo manda uma tarefa que ainda está gravada no
 * time de antes — ou `null`, se ela já está no time certo.
 *
 * Só três casos, os que o desenho deixa sem dúvida:
 *  - pré-processual do ADM ou do JUDICIAL (pendente, protocolo novo,
 *    triagem) é do amarelo, ainda que o TickTick o tenha no vermelho;
 *  - aguardando assinatura é do azul, ainda que more na lista de
 *    vídeos do vermelho;
 *  - o parecer de análise que o Claude deixa para o Zeca é a revisão
 *    da análise, do vermelho, ainda que a coluna do TickTick seja azul.
 *
 * É a regra de entrada no fluxo (lib/domain/tarefa/atribuicao.ts):
 * enquanto a tarefa não tem linha gravada, a tela já a mostra no lugar
 * novo, e é ali que ela é gravada quando entra no fluxo. A tarefa em
 * si não muda até alguém agir nela (ou o administrador gravar todas).
 */
export function destinoNoFluxo(t: TarefaNoFluxo): EtapaId | null {
  if (t.tipo === "DUVIDA") return null
  const p = normalizar(t.pasta)
  if (!p) return null

  const esfera = esferaDe(p)
  const amarela = etapaAmarelaDe(p)
  // Andamento fica onde o TickTick deixou: o do vermelho é o que pede o
  // Zeca, o do amarelo é a exigência processual — a pasta não diz qual.
  if (esfera && amarela && amarela !== "andamentos" && t.setor !== "AMARELO") return idAmarelo(esfera, amarela)

  if (/\bASSINA/.test(p) && !esfera && t.setor !== "AZUL") return "aguardando-assinatura"

  if (
    t.setor === "AZUL" &&
    /\bANALISES?\b/.test(p) &&
    (/\bZECA\b/.test(p) || /\bPARECER\b/.test(normalizar(t.titulo)))
  ) {
    return "revisao-analise"
  }

  return null
}
