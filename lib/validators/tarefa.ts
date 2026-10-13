import { z } from "zod"
import { TarefaStatusEnum, TarefaPrioridadeEnum, TimeTarefaEnum } from "./enums"

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
 * Levar várias tarefas para o lugar do fluxo novo de uma vez — o botão
 * "Mover" da faixa "fora do lugar". Cada movimento diz o time e a pasta
 * (a etapa) de uma tarefa.
 */
export const MoverTarefasSchema = z.object({
  movimentos: z
    .array(
      z.object({
        id: z.string().min(1),
        setor: TimeTarefaEnum,
        pasta: z.string().trim().min(1).max(200),
      })
    )
    .min(1, "Nada para mover")
    .max(1000, "Mova no máximo mil de cada vez"),
})
