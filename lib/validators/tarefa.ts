import { z } from "zod"
import { TarefaStatusEnum, TarefaPrioridadeEnum, TimeTarefaEnum } from "./enums"
import { ETAPAS, type EtapaId } from "@/lib/domain/tarefa/fluxo"

/**
 * Id gravado pelo banco. `z.guid()` e não `uuid()`: o formato é o mesmo,
 * sem exigir a versão — ids criados à mão (seed, testes) também valem.
 */
const IdDoBanco = z.guid()

/** As etapas do fluxo (lib/domain/tarefa/fluxo.ts) — só elas são aceitas. */
export const EtapaIdEnum = z.enum(Object.keys(ETAPAS) as [EtapaId, ...EtapaId[]])

export const TarefaSchema = z.object({
  processoId: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data: z.string().min(1, "Data é obrigatória"),
  hora: z.string().optional(),
  status: TarefaStatusEnum.default("PENDENTE"),
  prioridade: TarefaPrioridadeEnum.default("MEDIA"),
  /// Time e responsável são opcionais: a tarefa nasce em qualquer
  /// tela e só depois entra no quadro. O campo se chama `setor` desde
  /// a migração; o nome na interface é time.
  setor: TimeTarefaEnum.nullish(),
  responsavelId: z.string().nullish(),
  /// A etapa do fluxo mora aqui ("AGENDAR VÍDEO", "JUDICIAL › PROTOCOLO")
  /// — ou a lista que veio do TickTick. Ver lib/domain/tarefa/fluxo.ts.
  pasta: z.string().trim().max(200).nullish(),
})

/**
 * Edição pontual pelo quadro de tarefas — trocar o time, passar para
 * outro responsável, marcar como concluída. Um PUT com o corpo pela
 * metade apagaria data, título e prioridade.
 */
export const TarefaPatchSchema = z
  .object({
    setor: TimeTarefaEnum.nullable().optional(),
    responsavelId: z.string().nullable().optional(),
    status: TarefaStatusEnum.optional(),
    prioridade: TarefaPrioridadeEnum.optional(),
    /** Mudar de etapa é gravar a pasta da etapa nova (junto do time). */
    pasta: z.string().trim().max(200).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Nada para atualizar",
  })

/**
 * Abrir uma dúvida a partir de uma tarefa.
 *
 * O título é a pergunta: no quadro é ele que aparece, e "Dúvida sobre
 * o caso" não diz a ninguém o que está travado. Data e responsável
 * são opcionais — quem pergunta muitas vezes não sabe para quem, e
 * herdar da tarefa mãe é melhor palpite que exigir a escolha na hora.
 */
export const DuvidaSchema = z.object({
  pergunta: z
    .string()
    .min(5, "Escreva a pergunta")
    .max(2000, "Pergunta longa demais"),
  responsavelId: z.string().nullish(),
  data: z.string().nullish(),
  prioridade: TarefaPrioridadeEnum.optional(),
})

/** Responder fecha a dúvida. Sem texto não há o que fechar. */
export const RespostaDuvidaSchema = z.object({
  resposta: z
    .string()
    .min(1, "Escreva a resposta")
    .max(5000, "Resposta longa demais"),
})

/**
 * Criar uma tarefa já dentro do fluxo: a etapa e quem responde por ela.
 * Sem responsáveis, valem os que a etapa indica.
 */
export const TarefaCriacaoSchema = TarefaSchema.extend({
  etapa: EtapaIdEnum.nullish(),
  responsaveis: z.array(IdDoBanco).max(10).nullish(),
})

/** Um lugar no fluxo: o time e, se houver, a etapa. */
export const LugarFluxoSchema = z
  .object({
    setor: TimeTarefaEnum,
    etapa: EtapaIdEnum.nullable(),
  })
  .refine((l) => l.etapa === null || ETAPAS[l.etapa].time === l.setor, {
    message: "A etapa não é deste time",
  })

const Responsaveis = z.array(IdDoBanco).max(10)

/**
 * As ações do fluxo sobre uma tarefa. Cada uma vira uma função do banco
 * (migration 20261013200000_fluxo_atribuicoes) que trava a tarefa antes
 * de mexer.
 */
export const AcaoFluxoSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("mover"),
    de: LugarFluxoSchema,
    para: LugarFluxoSchema,
    /** Nulo: os mesmos de antes. Ausente: os que a etapa de destino indica. */
    responsaveis: Responsaveis.nullable().optional(),
  }),
  z.object({
    acao: z.literal("adicionar"),
    para: LugarFluxoSchema,
    responsaveis: Responsaveis.optional(),
  }),
  z.object({
    acao: z.literal("concluirParte"),
    em: LugarFluxoSchema,
    responsavelId: IdDoBanco.nullable(),
  }),
  z.object({ acao: z.literal("concluirMinhaParte") }),
  z.object({
    acao: z.literal("concluirEtapa"),
    em: LugarFluxoSchema,
  }),
  z.object({
    acao: z.literal("responsaveis"),
    em: LugarFluxoSchema,
    responsaveis: Responsaveis,
  }),
])

export type AcaoFluxo = z.infer<typeof AcaoFluxoSchema>
